import React, { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { sendPasswordResetEmail, signInWithEmailAndPassword, signOut as firebaseSignOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { getUserProfile, resolveLoginEmail } from '../lib/db';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const getFriendlyAuthMessage = (error) => {
  const code = error?.code || '';

  if (code === 'auth/operation-not-allowed') {
    return 'Password reset is disabled in Firebase Authentication. Enable the Email/Password provider in the Firebase console.';
  }

  if (code === 'auth/invalid-email') {
    return 'That email address is not valid.';
  }

  if (code === 'auth/too-many-requests') {
    return 'Too many reset attempts were made. Please wait a moment and try again.';
  }

  if (code === 'auth/network-request-failed') {
    return 'Network error while contacting Firebase. Check your internet connection and try again.';
  }

  return error?.message || 'Something went wrong. Please try again.';
};

const Login = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('institution');
  const [institutionIdentifier, setInstitutionIdentifier] = useState('');
  const [institutionPassword, setInstitutionPassword] = useState('');
  const [parentStudentIdentifier, setParentStudentIdentifier] = useState('');
  const [parentStudentPassword, setParentStudentPassword] = useState('');
  const [showInstitutionPassword, setShowInstitutionPassword] = useState(false);
  const [showParentPassword, setShowParentPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to="/dashboard" />;
  }

  const handleLogin = async (accountType) => {
    const identifier = accountType === 'institution' ? institutionIdentifier : parentStudentIdentifier;
    const password = accountType === 'institution' ? institutionPassword : parentStudentPassword;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const resolvedEmail = await resolveLoginEmail(accountType, identifier);
      const credentials = await signInWithEmailAndPassword(auth, resolvedEmail, password);
      const profile = await getUserProfile(credentials.user.uid);

      if (profile?.status === 'suspended') {
        await firebaseSignOut(auth);
        throw new Error('This account has been suspended. Contact support to reactivate it.');
      }
    } catch (err) {
      console.error(err);
      setError(getFriendlyAuthMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (accountType) => {
    const identifier = accountType === 'institution' ? institutionIdentifier : parentStudentIdentifier;
    const actionCodeSettings = typeof window !== 'undefined'
      ? { url: `${window.location.origin}/login` }
      : undefined;

    setError('');
    setSuccess('');
    try {
      const resolvedEmail = await resolveLoginEmail(accountType, identifier);
      await sendPasswordResetEmail(auth, resolvedEmail, actionCodeSettings);
      setSuccess(`Password reset request accepted for ${resolvedEmail}. Check inbox and spam folders.`);
    } catch (err) {
      console.error(err);
      setError(getFriendlyAuthMessage(err));
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <h2>Welcome Back</h2>
          <p>Please enter your details to log in</p>
        </div>

        <div className="login-tabs">
          <button
            type="button"
            className={`login-tab ${activeTab === 'institution' ? 'active institution' : ''}`}
            onClick={() => setActiveTab('institution')}
          >
            Institution
          </button>
          <button
            type="button"
            className={`login-tab ${activeTab === 'parent_student' ? 'active parent-student' : ''}`}
            onClick={() => setActiveTab('parent_student')}
          >
            Parent / Student
          </button>
        </div>

        {error && <div className="login-error">{error}</div>}
        {success && <div className="login-success">{success}</div>}

        {activeTab === 'institution' ? (
          <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleLogin('institution'); }}>
            <div className="field">
              <label>School Code / Email</label>
              <input
                type="text"
                value={institutionIdentifier}
                onChange={(e) => setInstitutionIdentifier(e.target.value)}
                placeholder="Enter school code or email"
                required
              />
            </div>
            <div className="field pass-container">
              <label>Password</label>
              <input
                type={showInstitutionPassword ? 'text' : 'password'}
                value={institutionPassword}
                onChange={(e) => setInstitutionPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button type="button" className="toggle-btn" onClick={() => setShowInstitutionPassword((prev) => !prev)}>
                {showInstitutionPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button type="button" className="forgot-pass" onClick={() => handlePasswordReset('institution')}>
              Forgot password?
            </button>
            <button className="btn-login institution-btn" type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Login to Dashboard'}
            </button>
          </form>
        ) : (
          <form className="login-form orange-theme" onSubmit={(e) => { e.preventDefault(); handleLogin('parent_student'); }}>
            <div className="field">
              <label>Email / Phone Number / Admin No</label>
              <input
                type="text"
                value={parentStudentIdentifier}
                onChange={(e) => setParentStudentIdentifier(e.target.value)}
                placeholder="e.g. parent@example.com or 0712345678 or 4501"
                required
              />
            </div>
            <div className="field pass-container">
              <label>Password</label>
              <input
                type={showParentPassword ? 'text' : 'password'}
                value={parentStudentPassword}
                onChange={(e) => setParentStudentPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
              <button type="button" className="toggle-btn" onClick={() => setShowParentPassword((prev) => !prev)}>
                {showParentPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            <button type="button" className="forgot-pass orange-link" onClick={() => handlePasswordReset('parent_student')}>
              Forgot password?
            </button>
            <button className="btn-login parent-student-btn" type="submit" disabled={loading}>
              {loading ? 'Signing In...' : 'Access Account'}
            </button>
          </form>
        )}

        <div className="login-footer">
          Don't have an account? <Link to="/register">Sign up</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
