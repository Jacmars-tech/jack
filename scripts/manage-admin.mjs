import { createHash, randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

const ADMIN_ACCESS_ROLE = 'admin';
const DEFAULT_ACCESS_ROLE = 'customer';

const parseArgs = (argv) => {
    const options = {};
    const positionals = [];

    for (let index = 0; index < argv.length; index += 1) {
        const token = argv[index];

        if (!token.startsWith('--')) {
            positionals.push(token);
            continue;
        }

        const key = token.slice(2);
        const next = argv[index + 1];

        if (!next || next.startsWith('--')) {
            options[key] = true;
            continue;
        }

        options[key] = next;
        index += 1;
    }

    return { options, positionals };
};

const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeToken = (value) => String(value || '').trim().toLowerCase();
const hashToken = (value) => createHash('sha256').update(value).digest('hex');

const printUsage = () => {
    console.log(`
Usage:
  node scripts/manage-admin.mjs grant --email you@example.com --service-account C:\\path\\service-account.json
  node scripts/manage-admin.mjs revoke --email you@example.com --service-account C:\\path\\service-account.json
  node scripts/manage-admin.mjs check --email you@example.com --service-account C:\\path\\service-account.json
  node scripts/manage-admin.mjs reset-link --email you@example.com --service-account C:\\path\\service-account.json

Options:
  --email             Firebase Auth email address for the target user
  --uid               Firebase Auth UID for the target user
  --service-account   Path to the Firebase Admin SDK JSON key
  --display-name      Optional display name used when bootstrapping a new admin user

Behavior:
  - grant: creates the Auth user automatically if it does not exist yet
  - grant: creates a minimal editable user_profiles document if missing
  - grant: writes user_profiles/{uid}.accessRole = admin
  - revoke: writes user_profiles/{uid}.accessRole = customer
  - check: reads the current accessRole from user_profiles
  - reset-link: generates a password reset link without relying on email delivery

You can also set FIREBASE_SERVICE_ACCOUNT_PATH instead of passing --service-account.
`);
};

const bootstrapAdminSdk = async (serviceAccountPath) => {
    const resolvedPath = path.resolve(serviceAccountPath);
    const rawKey = await readFile(resolvedPath, 'utf8');
    const serviceAccount = JSON.parse(rawKey);

    if (!getApps().length) {
        initializeApp({
            credential: cert(serviceAccount)
        });
    }

    return {
        auth: getAuth(),
        db: getFirestore(),
        projectId: serviceAccount.project_id || 'unknown-project'
    };
};

const makeTemporaryPassword = () => `${randomBytes(9).toString('base64url')}Aa1!`;

const makeBootstrapProfile = (userRecord, displayNameOverride = '', accessRole = ADMIN_ACCESS_ROLE) => {
    const email = normalizeEmail(userRecord.email);
    const emailLocalPart = email.split('@')[0] || 'admin';
    const displayName = String(displayNameOverride || userRecord.displayName || 'Admin Account').trim();
    const institutionName = displayName || emailLocalPart;
    const schoolCode = `ADMIN-${userRecord.uid.slice(0, 6).toUpperCase()}`;
    const schoolCodeSearch = normalizeToken(schoolCode);
    const schoolCodeLookupId = hashToken(`schoolCode:${schoolCodeSearch}`);

    return {
        profile: {
            uid: userRecord.uid,
            accountType: 'institution',
            role: 'institution',
            accessRole,
            displayName: institutionName,
            fullName: '',
            institutionName,
            officialEmail: email,
            email,
            phone: '',
            county: '',
            poBox: '',
            schoolCode,
            adminNo: '',
            status: 'active',
            email_search: email,
            officialEmail_search: email,
            phone_search: '',
            schoolCode_search: schoolCodeSearch,
            adminNo_search: '',
            loginLookupIds: [schoolCodeLookupId],
            created_at: FieldValue.serverTimestamp(),
            updated_at: FieldValue.serverTimestamp()
        },
        lookup: {
            id: schoolCodeLookupId,
            data: {
                uid: userRecord.uid,
                type: 'schoolCode',
                email,
                accountType: 'institution',
                status: 'active',
                created_at: FieldValue.serverTimestamp(),
                updated_at: FieldValue.serverTimestamp()
            }
        },
        schoolCode
    };
};

const getUserByIdentifier = async (auth, { email, uid }) => {
    if (uid) {
        return auth.getUser(uid);
    }

    return auth.getUserByEmail(email);
};

const ensureUserRecord = async (auth, { email, uid, displayName }) => {
    try {
        const userRecord = await getUserByIdentifier(auth, { email, uid });
        return {
            userRecord,
            created: false,
            resetLink: ''
        };
    } catch (error) {
        if (error.code !== 'auth/user-not-found' || !email) {
            throw error;
        }

        const temporaryPassword = makeTemporaryPassword();
        const createdUser = await auth.createUser({
            email,
            password: temporaryPassword,
            displayName: displayName || 'Admin Account'
        });
        const resetLink = await auth.generatePasswordResetLink(email);

        return {
            userRecord: createdUser,
            created: true,
            resetLink
        };
    }
};

const ensureProfileAccessRole = async (db, userRecord, displayName, accessRole) => {
    const profileRef = db.collection('user_profiles').doc(userRecord.uid);
    const profileSnapshot = await profileRef.get();

    if (profileSnapshot.exists) {
        const profileData = profileSnapshot.data();

        await profileRef.set({
            accessRole,
            updated_at: FieldValue.serverTimestamp()
        }, { merge: true });

        return {
            createdProfile: false,
            schoolCode: profileData.schoolCode || '',
            previousAccessRole: profileData.accessRole || DEFAULT_ACCESS_ROLE
        };
    }

    const bootstrapProfile = makeBootstrapProfile(userRecord, displayName, accessRole);
    const batch = db.batch();

    batch.set(profileRef, bootstrapProfile.profile);
    batch.set(db.collection('login_lookup').doc(bootstrapProfile.lookup.id), bootstrapProfile.lookup.data);
    await batch.commit();

    return {
        createdProfile: true,
        schoolCode: bootstrapProfile.schoolCode,
        previousAccessRole: DEFAULT_ACCESS_ROLE
    };
};

const updateProfileAccessRole = async (db, uid, accessRole) => {
    const profileRef = db.collection('user_profiles').doc(uid);
    const profileSnapshot = await profileRef.get();

    if (!profileSnapshot.exists) {
        return {
            profileExists: false,
            previousAccessRole: DEFAULT_ACCESS_ROLE
        };
    }

    const profileData = profileSnapshot.data();

    await profileRef.set({
        accessRole,
        updated_at: FieldValue.serverTimestamp()
    }, { merge: true });

    return {
        profileExists: true,
        previousAccessRole: profileData.accessRole || DEFAULT_ACCESS_ROLE
    };
};

const readProfileAccessRole = async (db, uid) => {
    const profileSnapshot = await db.collection('user_profiles').doc(uid).get();

    if (!profileSnapshot.exists) {
        return {
            exists: false,
            accessRole: DEFAULT_ACCESS_ROLE
        };
    }

    const profileData = profileSnapshot.data();
    return {
        exists: true,
        accessRole: profileData.accessRole || DEFAULT_ACCESS_ROLE,
        schoolCode: profileData.schoolCode || ''
    };
};

const main = async () => {
    const { options, positionals } = parseArgs(process.argv.slice(2));
    const command = String(positionals[0] || 'grant').toLowerCase();
    const email = normalizeEmail(options.email);
    const uid = String(options.uid || '').trim();
    const displayName = String(options['display-name'] || options.displayName || '').trim();
    const serviceAccountPath =
        String(options['service-account'] || options.serviceAccount || process.env.FIREBASE_SERVICE_ACCOUNT_PATH || '').trim();

    if (!serviceAccountPath || (!email && !uid)) {
        printUsage();
        process.exit(1);
    }

    if (!['grant', 'revoke', 'check', 'reset-link'].includes(command)) {
        console.error(`Unsupported command: ${command}`);
        printUsage();
        process.exit(1);
    }

    const { auth, db, projectId } = await bootstrapAdminSdk(serviceAccountPath);

    if (command === 'grant') {
        const { userRecord, created, resetLink } = await ensureUserRecord(auth, { email, uid, displayName });
        const { createdProfile, schoolCode, previousAccessRole } = await ensureProfileAccessRole(
            db,
            userRecord,
            displayName,
            ADMIN_ACCESS_ROLE
        );

        console.log(`Granted admin access in project ${projectId} to ${userRecord.email || userRecord.uid}.`);
        console.log(`Previous access role: ${previousAccessRole}`);
        console.log(`Current access role: ${ADMIN_ACCESS_ROLE}`);

        if (created) {
            console.log(`Created Firebase Auth user: ${userRecord.uid}`);
        }

        if (createdProfile) {
            console.log(`Created bootstrap profile with school code: ${schoolCode}`);
        }

        if (resetLink) {
            console.log(`Password reset link: ${resetLink}`);
        }

        return;
    }

    const userRecord = await getUserByIdentifier(auth, { email, uid });

    if (command === 'revoke') {
        const { profileExists, previousAccessRole } = await updateProfileAccessRole(
            db,
            userRecord.uid,
            DEFAULT_ACCESS_ROLE
        );

        if (!profileExists) {
            console.log(`User ${userRecord.email || userRecord.uid} exists in Auth but has no Firestore profile yet.`);
            return;
        }

        console.log(`Revoked admin access in project ${projectId} from ${userRecord.email || userRecord.uid}.`);
        console.log(`Previous access role: ${previousAccessRole}`);
        console.log(`Current access role: ${DEFAULT_ACCESS_ROLE}`);
        return;
    }

    if (command === 'reset-link') {
        if (!userRecord.email) {
            throw new Error('This user does not have an email address in Firebase Auth.');
        }

        const resetLink = await auth.generatePasswordResetLink(userRecord.email);
        console.log(`Password reset link for ${userRecord.email}:`);
        console.log(resetLink);
        return;
    }

    const profileAccess = await readProfileAccessRole(db, userRecord.uid);

    if (!profileAccess.exists) {
        console.log(`${userRecord.email || userRecord.uid} exists in Auth but has no user_profiles document in ${projectId}.`);
        return;
    }

    console.log(`${userRecord.email || userRecord.uid} has accessRole=${profileAccess.accessRole} in ${projectId}.`);
    if (profileAccess.schoolCode) {
        console.log(`School code: ${profileAccess.schoolCode}`);
    }
};

main().catch((error) => {
    console.error('Admin setup failed.');
    console.error(error.message || error);
    process.exit(1);
});
