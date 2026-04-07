import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from "firebase/auth";
import { getUserProfile } from '../lib/db';

const AuthContext = createContext({
    user: null,
    profile: null,
    userStatus: 'active',
    isAdmin: false,
    signOut: async () => { },
    loading: true,
});

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [userStatus, setUserStatus] = useState('active');
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            setUser(currentUser);
            if (currentUser) {
                try {
                    const profileData = await getUserProfile(currentUser.uid);
                    setProfile(profileData);
                    setUserStatus(profileData?.status || 'active');
                    setIsAdmin(profileData?.accessRole === 'admin');
                } catch (e) {
                    console.error("Profile lookup failed", e);
                    setProfile(null);
                    setUserStatus('active');
                    setIsAdmin(false);
                }
            } else {
                setProfile(null);
                setUserStatus('active');
                setIsAdmin(false);
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, profile, userStatus, isAdmin, signOut, loading }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
    return useContext(AuthContext);
};
