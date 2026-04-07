import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { KENYA_COUNTIES } from '../lib/counties';
import { createUserProfile } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import './Register.css';

const INITIAL_INSTITUTION = {
    institutionName: '',
    officialEmail: '',
    phone: '',
    poBox: '',
    county: '',
    schoolCode: '',
    password: '',
    confirmPassword: ''
};

const INITIAL_PARENT_STUDENT = {
    role: 'parent',
    fullName: '',
    institutionName: '',
    phone: '',
    county: '',
    adminNo: '',
    email: '',
    password: '',
    confirmPassword: ''
};

const Register = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('institution');
    const [institutionForm, setInstitutionForm] = useState(INITIAL_INSTITUTION);
    const [parentStudentForm, setParentStudentForm] = useState(INITIAL_PARENT_STUDENT);
    const [showInstitutionPassword, setShowInstitutionPassword] = useState(false);
    const [showInstitutionConfirm, setShowInstitutionConfirm] = useState(false);
    const [showParentPassword, setShowParentPassword] = useState(false);
    const [showParentConfirm, setShowParentConfirm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (user) {
        return <Navigate to="/dashboard" />;
    }

    const handleInstitutionChange = (field) => (event) => {
        setInstitutionForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleParentStudentChange = (field) => (event) => {
        setParentStudentForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const registerInstitution = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (institutionForm.password !== institutionForm.confirmPassword) {
                throw new Error('Institution passwords do not match.');
            }

            const credentials = await createUserWithEmailAndPassword(
                auth,
                institutionForm.officialEmail.trim(),
                institutionForm.password
            );

            await updateProfile(credentials.user, {
                displayName: institutionForm.institutionName.trim()
            });

            await createUserProfile(credentials.user.uid, {
                accountType: 'institution',
                role: 'institution',
                displayName: institutionForm.institutionName,
                institutionName: institutionForm.institutionName,
                institutionEmail: institutionForm.officialEmail,
                email: institutionForm.officialEmail,
                phone: institutionForm.phone,
                county: institutionForm.county,
                poBox: institutionForm.poBox,
                schoolCode: institutionForm.schoolCode,
                status: 'active'
            });

            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const registerParentStudent = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError('');

        try {
            if (parentStudentForm.password !== parentStudentForm.confirmPassword) {
                throw new Error('Passwords do not match.');
            }

            const credentials = await createUserWithEmailAndPassword(
                auth,
                parentStudentForm.email.trim(),
                parentStudentForm.password
            );

            await updateProfile(credentials.user, {
                displayName: parentStudentForm.fullName.trim()
            });

            await createUserProfile(credentials.user.uid, {
                accountType: 'parent_student',
                role: parentStudentForm.role,
                displayName: parentStudentForm.fullName,
                fullName: parentStudentForm.fullName,
                institutionName: parentStudentForm.institutionName,
                email: parentStudentForm.email,
                phone: parentStudentForm.phone,
                county: parentStudentForm.county,
                adminNo: parentStudentForm.adminNo,
                status: 'active'
            });

            navigate('/dashboard');
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="register-page">
            <div className="register-card">
                <div className="register-header">
                    <h2>Create Your Account</h2>
                    <p>Register as an institution, parent, or student using the details from your sample flow.</p>
                </div>

                <div className="register-tabs">
                    <button
                        type="button"
                        className={`register-tab ${activeTab === 'institution' ? 'active institution' : ''}`}
                        onClick={() => setActiveTab('institution')}
                    >
                        Institution
                    </button>
                    <button
                        type="button"
                        className={`register-tab ${activeTab === 'parent_student' ? 'active parent-student' : ''}`}
                        onClick={() => setActiveTab('parent_student')}
                    >
                        Parent / Student
                    </button>
                </div>

                {error && <div className="register-error">{error}</div>}

                {activeTab === 'institution' ? (
                    <form className="register-form" onSubmit={registerInstitution}>
                        <div className="field">
                            <label>Institution Name</label>
                            <input type="text" value={institutionForm.institutionName} onChange={handleInstitutionChange('institutionName')} placeholder="e.g. Nairobi High School" required />
                        </div>
                        <div className="field">
                            <label>Official Email</label>
                            <input type="email" value={institutionForm.officialEmail} onChange={handleInstitutionChange('officialEmail')} placeholder="admin@school.ac.ke" required />
                        </div>
                        <div className="field">
                            <label>Phone Number</label>
                            <input type="tel" value={institutionForm.phone} onChange={handleInstitutionChange('phone')} placeholder="0716..." required />
                        </div>
                        <div className="field">
                            <label>P.O. Box</label>
                            <input type="text" value={institutionForm.poBox} onChange={handleInstitutionChange('poBox')} placeholder="100-..." />
                        </div>
                        <div className="field">
                            <label>County</label>
                            <select value={institutionForm.county} onChange={handleInstitutionChange('county')} required>
                                <option value="">Select county...</option>
                                {KENYA_COUNTIES.map((county) => (
                                    <option key={county} value={county}>{county}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field">
                            <label>School Code</label>
                            <input type="text" value={institutionForm.schoolCode} onChange={handleInstitutionChange('schoolCode')} placeholder="Enter your official school code" required />
                        </div>
                        <div className="field pass-container">
                            <label>Create Password</label>
                            <input type={showInstitutionPassword ? 'text' : 'password'} value={institutionForm.password} onChange={handleInstitutionChange('password')} required />
                            <button type="button" className="toggle-btn" onClick={() => setShowInstitutionPassword((prev) => !prev)}>
                                {showInstitutionPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <div className="field pass-container">
                            <label>Confirm Password</label>
                            <input type={showInstitutionConfirm ? 'text' : 'password'} value={institutionForm.confirmPassword} onChange={handleInstitutionChange('confirmPassword')} required />
                            <button type="button" className="toggle-btn" onClick={() => setShowInstitutionConfirm((prev) => !prev)}>
                                {showInstitutionConfirm ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <button className="btn-submit" type="submit" disabled={loading}>
                            {loading ? 'Creating Institution...' : 'Register Institution'}
                        </button>
                    </form>
                ) : (
                    <form className="register-form orange-theme" onSubmit={registerParentStudent}>
                        <div className="field">
                            <label>I am a:</label>
                            <select value={parentStudentForm.role} onChange={handleParentStudentChange('role')}>
                                <option value="parent">Parent / Guardian</option>
                                <option value="student">Student</option>
                            </select>
                        </div>
                        <div className="field">
                            <label>Full Name</label>
                            <input type="text" value={parentStudentForm.fullName} onChange={handleParentStudentChange('fullName')} placeholder="Enter your official name" required />
                        </div>
                        <div className="field">
                            <label>Institution Name</label>
                            <input type="text" value={parentStudentForm.institutionName} onChange={handleParentStudentChange('institutionName')} placeholder="School or institution name" required />
                        </div>
                        <div className="field">
                            <label>Phone Number</label>
                            <input type="tel" value={parentStudentForm.phone} onChange={handleParentStudentChange('phone')} placeholder="0712 345 678" required />
                        </div>
                        <div className="field">
                            <label>Admin / Student Number</label>
                            <input type="text" value={parentStudentForm.adminNo} onChange={handleParentStudentChange('adminNo')} placeholder="Optional but useful for login" />
                        </div>
                        <div className="field">
                            <label>Recovery Email</label>
                            <input type="email" value={parentStudentForm.email} onChange={handleParentStudentChange('email')} placeholder="Used for password reset and account recovery" required />
                        </div>
                        <div className="field">
                            <label>County of Residence</label>
                            <select value={parentStudentForm.county} onChange={handleParentStudentChange('county')} required>
                                <option value="">Select county...</option>
                                {KENYA_COUNTIES.map((county) => (
                                    <option key={county} value={county}>{county}</option>
                                ))}
                            </select>
                        </div>
                        <div className="field pass-container">
                            <label>Create Password</label>
                            <input type={showParentPassword ? 'text' : 'password'} value={parentStudentForm.password} onChange={handleParentStudentChange('password')} required />
                            <button type="button" className="toggle-btn" onClick={() => setShowParentPassword((prev) => !prev)}>
                                {showParentPassword ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <div className="field pass-container">
                            <label>Confirm Password</label>
                            <input type={showParentConfirm ? 'text' : 'password'} value={parentStudentForm.confirmPassword} onChange={handleParentStudentChange('confirmPassword')} required />
                            <button type="button" className="toggle-btn" onClick={() => setShowParentConfirm((prev) => !prev)}>
                                {showParentConfirm ? 'Hide' : 'Show'}
                            </button>
                        </div>
                        <button className="btn-submit" type="submit" disabled={loading}>
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>
                    </form>
                )}

                <div className="register-footer">
                    Already have an account? <Link to="/login">Login here</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
