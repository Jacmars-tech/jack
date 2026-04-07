import { db } from './firebase';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    updateDoc,
    where,
    writeBatch
} from 'firebase/firestore';

export const ORDER_STATUSES = ['pending', 'paid', 'processing', 'delivered', 'cancelled'];
export const USER_STATUSES = ['active', 'suspended'];
export const ACCESS_ROLES = ['customer', 'admin'];

const toDateOrNull = (value) => {
    if (value?.toDate) return value.toDate();
    if (value instanceof Date) return value;
    return null;
};

const normalizeImageArray = (images) => {
    if (!Array.isArray(images)) return [];
    return images
        .filter((item) => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean);
};

const prepareProductPayload = (input = {}) => {
    const parsedPrice = Number(input.price);
    const parsedStock = Number(input.stock);
    const parsedImages = normalizeImageArray(
        Array.isArray(input.images)
            ? input.images
            : [input.image_url || input.image].filter(Boolean)
    );
    const primaryImage = input.image_url || input.image || parsedImages[0] || '';

    return {
        name: (input.name || '').trim(),
        description: (input.description || '').trim(),
        category: (input.category || '').trim(),
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        stock: Number.isFinite(parsedStock) ? parsedStock : 0,
        featured: Boolean(input.featured),
        image: primaryImage,
        image_url: primaryImage,
        images: parsedImages.length > 0 ? parsedImages : (primaryImage ? [primaryImage] : [])
    };
};

const normalizeProduct = (id, raw = {}) => {
    const parsedPrice = Number(raw.price);
    const parsedStock = Number(raw.stock);
    const parsedImages = normalizeImageArray(raw.images);
    const primaryImage = raw.image_url || raw.image || parsedImages[0] || '';

    return {
        id,
        ...raw,
        price: Number.isFinite(parsedPrice) ? parsedPrice : 0,
        stock: Number.isFinite(parsedStock) ? parsedStock : 0,
        featured: Boolean(raw.featured),
        image_url: primaryImage,
        images: parsedImages.length > 0 ? parsedImages : (primaryImage ? [primaryImage] : []),
        created_at: toDateOrNull(raw.created_at),
        updated_at: toDateOrNull(raw.updated_at)
    };
};

const normalizeOrder = (snapshotDoc) => {
    const data = snapshotDoc.data();
    const items = Array.isArray(data.items) ? data.items : [];

    return {
        id: snapshotDoc.id,
        ...data,
        items: items.map((item) => ({
            ...item,
            quantity: Number(item.quantity) || 0,
            price: Number(item.price) || 0
        })),
        subtotal: Number(data.subtotal) || 0,
        delivery_fee: Number(data.delivery_fee) || 0,
        total: Number(data.total) || 0,
        status: ORDER_STATUSES.includes(data.status) ? data.status : 'pending',
        created_at: toDateOrNull(data.created_at),
        updated_at: toDateOrNull(data.updated_at)
    };
};

const sortByCreatedAtDesc = (a, b) => {
    const aTime = a.created_at instanceof Date ? a.created_at.getTime() : 0;
    const bTime = b.created_at instanceof Date ? b.created_at.getTime() : 0;
    return bTime - aTime;
};

const normalizePhone = (value) => {
    const cleaned = String(value || '').trim().replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+254')) {
        return `0${cleaned.slice(4)}`;
    }

    if (cleaned.startsWith('254')) {
        return `0${cleaned.slice(3)}`;
    }

    return cleaned;
};
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeToken = (value) => String(value || '').trim().toLowerCase();

const prepareUserProfilePayload = (input = {}) => {
    const email = normalizeEmail(input.email);
    const institutionEmail = normalizeEmail(input.institutionEmail || input.officialEmail);
    const phone = normalizePhone(input.phone);
    const schoolCode = String(input.schoolCode || '').trim();
    const adminNo = String(input.adminNo || '').trim();

    return {
        accountType: input.accountType || 'parent_student',
        role: input.role || 'customer',
        accessRole: ACCESS_ROLES.includes(input.accessRole) ? input.accessRole : 'customer',
        displayName: String(input.displayName || input.fullName || input.institutionName || '').trim(),
        fullName: String(input.fullName || '').trim(),
        institutionName: String(input.institutionName || '').trim(),
        officialEmail: institutionEmail,
        email,
        phone,
        county: String(input.county || '').trim(),
        poBox: String(input.poBox || '').trim(),
        schoolCode,
        adminNo,
        status: USER_STATUSES.includes(input.status) ? input.status : 'active',
        email_search: email,
        officialEmail_search: institutionEmail,
        phone_search: phone,
        schoolCode_search: normalizeToken(schoolCode),
        adminNo_search: normalizeToken(adminNo)
    };
};

const normalizeUserProfile = (id, raw = {}) => ({
    id,
    uid: raw.uid || id,
    accountType: raw.accountType || 'parent_student',
    role: raw.role || 'customer',
    accessRole: ACCESS_ROLES.includes(raw.accessRole) ? raw.accessRole : 'customer',
    displayName: raw.displayName || raw.fullName || raw.institutionName || '',
    fullName: raw.fullName || '',
    institutionName: raw.institutionName || '',
    officialEmail: raw.officialEmail || '',
    email: raw.email || '',
    phone: raw.phone || '',
    county: raw.county || '',
    poBox: raw.poBox || '',
    schoolCode: raw.schoolCode || '',
    adminNo: raw.adminNo || '',
    loginLookupIds: Array.isArray(raw.loginLookupIds) ? raw.loginLookupIds : [],
    status: USER_STATUSES.includes(raw.status) ? raw.status : 'active',
    created_at: toDateOrNull(raw.created_at),
    updated_at: toDateOrNull(raw.updated_at)
});

const hashToken = async (value) => {
    const data = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
};

const buildLookupEntries = async (uid, payload) => {
    const candidates = [
        ['phone', payload.phone ? normalizePhone(payload.phone) : ''],
        ['schoolCode', payload.schoolCode ? normalizeToken(payload.schoolCode) : ''],
        ['adminNo', payload.adminNo ? normalizeToken(payload.adminNo) : '']
    ].filter(([, value]) => value);

    const lookups = [];
    for (const [type, value] of candidates) {
        const id = await hashToken(`${type}:${value}`);
        lookups.push({
            id,
            data: {
                uid,
                type,
                email: payload.email,
                accountType: payload.accountType,
                status: payload.status,
                created_at: serverTimestamp(),
                updated_at: serverTimestamp()
            }
        });
    }
    return lookups;
};

const getLookupEmail = async (lookupId) => {
    const lookupSnapshot = await getDoc(doc(db, 'login_lookup', lookupId));
    if (!lookupSnapshot.exists()) return null;

    const lookupData = lookupSnapshot.data();
    if (lookupData.status === 'suspended') {
        throw new Error('This account has been suspended. Contact support to reactivate it.');
    }

    return lookupData.email;
};

/**
 * PRODUCTS
 */
export async function getProducts() {
    const snapshot = await getDocs(collection(db, 'products'));
    return snapshot.docs
        .map((d) => normalizeProduct(d.id, d.data()))
        .sort(sortByCreatedAtDesc);
}

export async function getProductById(id) {
    const docRef = doc(db, 'products', id);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) throw new Error('Product not found');
    return normalizeProduct(docSnap.id, docSnap.data());
}

export async function createProduct(productData) {
    const payload = prepareProductPayload(productData);
    const docRef = await addDoc(collection(db, 'products'), {
        ...payload,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    });
    return { id: docRef.id, ...payload };
}

export async function updateProduct(productId, productData) {
    const payload = prepareProductPayload(productData);
    await updateDoc(doc(db, 'products', productId), {
        ...payload,
        updated_at: serverTimestamp()
    });
    return { id: productId, ...payload };
}

export async function deleteProduct(productId) {
    await deleteDoc(doc(db, 'products', productId));
}

async function applyInventoryAdjustments(items = []) {
    const batch = writeBatch(db);
    let hasWrites = false;

    for (const item of items) {
        const productId = item.product_id;
        const qty = Number(item.quantity) || 0;
        if (!productId || qty <= 0) continue;

        const productRef = doc(db, 'products', productId);
        const productSnap = await getDoc(productRef);
        if (!productSnap.exists()) continue;

        const currentStock = Number(productSnap.data().stock) || 0;
        const nextStock = Math.max(0, currentStock - qty);

        batch.update(productRef, {
            stock: nextStock,
            updated_at: serverTimestamp()
        });
        hasWrites = true;
    }

    if (hasWrites) {
        await batch.commit();
    }
}

/**
 * ORDERS
 */
export async function createOrder(orderData) {
    await applyInventoryAdjustments(orderData.items || []);

    const orderRef = await addDoc(collection(db, 'orders'), {
        ...orderData,
        status: ORDER_STATUSES.includes(orderData.status) ? orderData.status : 'pending',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    });
    return {
        id: orderRef.id,
        ...orderData,
        status: ORDER_STATUSES.includes(orderData.status) ? orderData.status : 'pending'
    };
}

export async function getUserOrders(userId) {
    const snapshot = await getDocs(query(
        collection(db, 'orders'),
        where('user_id', '==', userId)
    ));

    return snapshot.docs
        .map(normalizeOrder)
        .sort(sortByCreatedAtDesc);
}

export async function getAllOrders() {
    const snapshot = await getDocs(collection(db, 'orders'));
    return snapshot.docs
        .map(normalizeOrder)
        .sort(sortByCreatedAtDesc);
}

export async function updateOrderStatus(orderId, status) {
    if (!ORDER_STATUSES.includes(status)) {
        throw new Error('Invalid order status.');
    }

    await updateDoc(doc(db, 'orders', orderId), {
        status,
        updated_at: serverTimestamp()
    });
}

/**
 * USER PROFILES
 */
export async function createUserProfile(uid, profileData) {
    const payload = prepareUserProfilePayload(profileData);
    const profileRef = doc(db, 'user_profiles', uid);
    const lookupEntries = await buildLookupEntries(uid, payload);
    const batch = writeBatch(db);

    batch.set(profileRef, {
        uid,
        ...payload,
        loginLookupIds: lookupEntries.map((entry) => entry.id),
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
    });

    lookupEntries.forEach((entry) => {
        batch.set(doc(db, 'login_lookup', entry.id), entry.data);
    });

    await batch.commit();
    return { uid, ...payload };
}

export async function getUserProfile(uid) {
    if (!uid) return null;
    const snapshot = await getDoc(doc(db, 'user_profiles', uid));
    if (!snapshot.exists()) return null;
    return normalizeUserProfile(snapshot.id, snapshot.data());
}

export async function updateUserProfile(uid, profileData) {
    const payload = prepareUserProfilePayload(profileData);
    const profileRef = doc(db, 'user_profiles', uid);
    const currentSnapshot = await getDoc(profileRef);
    const currentData = currentSnapshot.exists() ? currentSnapshot.data() : null;
    const lookupEntries = await buildLookupEntries(uid, payload);
    const nextLookupIds = lookupEntries.map((entry) => entry.id);
    const batch = writeBatch(db);

    (currentData?.loginLookupIds || []).forEach((lookupId) => {
        if (!nextLookupIds.includes(lookupId)) {
            batch.delete(doc(db, 'login_lookup', lookupId));
        }
    });

    lookupEntries.forEach((entry) => {
        batch.set(doc(db, 'login_lookup', entry.id), entry.data);
    });

    batch.set(profileRef, {
        ...payload,
        loginLookupIds: nextLookupIds,
        updated_at: serverTimestamp()
    }, { merge: true });

    await batch.commit();
    return { uid, ...payload };
}

export async function getAllUserProfiles() {
    const snapshot = await getDocs(collection(db, 'user_profiles'));
    return snapshot.docs
        .map((docSnap) => normalizeUserProfile(docSnap.id, docSnap.data()))
        .sort(sortByCreatedAtDesc);
}

export async function updateUserStatus(uid, status) {
    if (!USER_STATUSES.includes(status)) {
        throw new Error('Invalid user status.');
    }

    const profileRef = doc(db, 'user_profiles', uid);
    const profileSnapshot = await getDoc(profileRef);

    if (!profileSnapshot.exists()) {
        throw new Error('User profile not found.');
    }

    const profileData = profileSnapshot.data();
    const batch = writeBatch(db);

    const lookupEntries = await buildLookupEntries(uid, {
        ...profileData,
        status
    });

    batch.update(profileRef, {
        status,
        updated_at: serverTimestamp()
    });

    lookupEntries.forEach((entry) => {
        batch.set(doc(db, 'login_lookup', entry.id), entry.data);
    });

    await batch.commit();
}

export async function resolveLoginEmail(accountType, identifier) {
    const rawIdentifier = String(identifier || '').trim();
    if (!rawIdentifier) {
        throw new Error('Enter your login identifier first.');
    }

    if (rawIdentifier.includes('@')) {
        return normalizeEmail(rawIdentifier);
    }

    const token = normalizeToken(rawIdentifier);

    if (accountType === 'institution') {
        const lookupId = await hashToken(`schoolCode:${token}`);
        const lookupEmail = await getLookupEmail(lookupId);
        if (lookupEmail) {
            return lookupEmail;
        }
    }

    const phoneLookupId = await hashToken(`phone:${normalizePhone(rawIdentifier)}`);
    const phoneLookupEmail = await getLookupEmail(phoneLookupId);
    if (phoneLookupEmail) {
        return phoneLookupEmail;
    }

    const adminLookupId = await hashToken(`adminNo:${token}`);
    const adminLookupEmail = await getLookupEmail(adminLookupId);
    if (adminLookupEmail) {
        return adminLookupEmail;
    }

    throw new Error('We could not find an account matching that identifier.');
}
