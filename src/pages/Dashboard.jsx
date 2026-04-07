import React, { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import {
    ArrowRight,
    ChevronRight,
    LayoutDashboard,
    Settings,
    ShieldCheck,
    ShoppingBag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { KENYA_COUNTIES } from '../lib/counties';
import { getUserOrders, updateUserProfile } from '../lib/db';
import './Dashboard.css';

const DASHBOARD_LINKS = [
    {
        id: 'overview',
        label: 'Overview',
        to: '/dashboard',
        icon: LayoutDashboard
    },
    {
        id: 'orders',
        label: 'Orders',
        to: '/dashboard/orders',
        icon: ShoppingBag
    },
    {
        id: 'settings',
        label: 'Settings',
        to: '/dashboard/settings',
        icon: Settings
    }
];

const formatDate = (value) => {
    if (!value) return 'Pending confirmation';
    if (value instanceof Date) return value.toLocaleString();
    return String(value);
};

const resolveDashboardSection = (pathname) => {
    const normalizedPath = pathname.replace(/\/+$/, '') || '/dashboard';

    if (normalizedPath === '/dashboard' || normalizedPath === '/dashboard/overview') {
        return 'overview';
    }

    if (normalizedPath === '/dashboard/orders') {
        return 'orders';
    }

    if (normalizedPath === '/dashboard/settings') {
        return 'settings';
    }

    return null;
};

const getDisplayName = (profile, fallbackEmail) => {
    return profile?.displayName
        || profile?.fullName
        || profile?.institutionName
        || fallbackEmail
        || 'Customer';
};

const Dashboard = () => {
    const location = useLocation();
    const { user, profile, userStatus, isAdmin } = useAuth();
    const [orders, setOrders] = useState(null);
    const [orderError, setOrderError] = useState('');
    const [profileForm, setProfileForm] = useState({
        displayName: '',
        institutionName: '',
        phone: '',
        county: '',
        poBox: '',
        schoolCode: '',
        adminNo: ''
    });
    const [saveMessage, setSaveMessage] = useState('');
    const [saveError, setSaveError] = useState('');
    const [savingProfile, setSavingProfile] = useState(false);

    const activeSection = useMemo(() => resolveDashboardSection(location.pathname), [location.pathname]);

    useEffect(() => {
        let mounted = true;

        if (!user) return undefined;

        getUserOrders(user.uid)
            .then((data) => {
                if (!mounted) return;
                setOrders(data);
                setOrderError('');
            })
            .catch((err) => {
                console.error(err);
                if (!mounted) return;
                setOrderError('Could not load your orders from Firebase.');
                setOrders([]);
            });

        return () => {
            mounted = false;
        };
    }, [user]);

    useEffect(() => {
        if (!profile) return;

        setProfileForm({
            displayName: profile.fullName || profile.displayName || '',
            institutionName: profile.institutionName || '',
            phone: profile.phone || '',
            county: profile.county || '',
            poBox: profile.poBox || '',
            schoolCode: profile.schoolCode || '',
            adminNo: profile.adminNo || ''
        });
    }, [profile]);

    const totalSpent = useMemo(() => {
        return (orders || []).reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    }, [orders]);

    const recentOrders = useMemo(() => {
        return (orders || []).slice(0, 3);
    }, [orders]);

    const loadingOrders = orders === null && !orderError;
    const displayName = getDisplayName(profile, user?.email);

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!activeSection) {
        return <Navigate to="/dashboard" replace />;
    }

    const handleProfileChange = (field) => (event) => {
        setProfileForm((prev) => ({ ...prev, [field]: event.target.value }));
    };

    const handleSaveProfile = async (event) => {
        event.preventDefault();
        if (!profile) return;

        setSavingProfile(true);
        setSaveMessage('');
        setSaveError('');

        try {
            await updateUserProfile(user.uid, {
                ...profile,
                displayName: profileForm.displayName,
                fullName: profile.accountType === 'parent_student' ? profileForm.displayName : '',
                institutionName: profile.accountType === 'institution' ? profileForm.displayName : profileForm.institutionName,
                email: profile.email,
                institutionEmail: profile.officialEmail,
                phone: profileForm.phone,
                county: profileForm.county,
                poBox: profileForm.poBox,
                schoolCode: profileForm.schoolCode,
                adminNo: profileForm.adminNo,
                accountType: profile.accountType,
                role: profile.role,
                accessRole: profile.accessRole,
                status: profile.status
            });
            setSaveMessage('Profile updated successfully.');
        } catch (err) {
            console.error(err);
            setSaveError(`Could not save profile: ${err.message}`);
        } finally {
            setSavingProfile(false);
        }
    };

    const renderOrderList = (orderList, compact = false) => {
        if (loadingOrders) {
            return (
                <div className="empty-state dashboard-surface">
                    <p>Loading your orders...</p>
                </div>
            );
        }

        if (orderError) {
            return (
                <div className="empty-state dashboard-surface">
                    <p>{orderError}</p>
                </div>
            );
        }

        if ((orderList?.length || 0) === 0) {
            return (
                <div className="empty-state dashboard-surface">
                    <p>You have not placed any orders yet.</p>
                    <Link to="/categories" className="empty-state-link">
                        Browse products <ArrowRight size={16} />
                    </Link>
                </div>
            );
        }

        return (
            <div className={`orders-list ${compact ? 'compact-orders-list' : ''}`}>
                {orderList.map((order) => (
                    <article key={order.id} className="order-card dashboard-surface">
                        <div className="order-card-head">
                            <div>
                                <span className="order-label">Order</span>
                                <h3>#{order.id.slice(0, 8)}</h3>
                                <p>{formatDate(order.created_at)}</p>
                            </div>
                            <span className={`status-pill status-${order.status || 'pending'}`}>
                                {(order.status || 'pending').toUpperCase()}
                            </span>
                        </div>
                        <div className="order-card-grid">
                            <div>
                                <span>Total</span>
                                <strong>KSh {(Number(order.total) || 0).toLocaleString()}</strong>
                            </div>
                            <div>
                                <span>Items</span>
                                <strong>{order.items?.length || 0}</strong>
                            </div>
                            <div>
                                <span>Delivery</span>
                                <strong>{order.customer?.city || 'Not set'}</strong>
                            </div>
                            <div>
                                <span>Payment</span>
                                <strong>{order.payment?.method ? String(order.payment.method).toUpperCase() : 'M-PESA'}</strong>
                            </div>
                        </div>
                    </article>
                ))}
            </div>
        );
    };

    return (
        <div className="container dashboard-page">
            <div className="dashboard-shell">
                <aside className="dashboard-sidebar">
                    <div className="dashboard-profile-card">
                        <span className="dashboard-eyebrow">My Account</span>
                        <h2>{displayName}</h2>
                        <p>{profile?.accountType === 'institution' ? 'Institution account' : 'Parent / student account'}</p>
                        <div className="dashboard-sidebar-meta">
                            <span className={`status-pill ${userStatus === 'active' ? 'status-active' : 'status-suspended'}`}>
                                {userStatus === 'active' ? 'Active' : 'Suspended'}
                            </span>
                            {isAdmin && (
                                <span className="status-pill status-admin">
                                    <ShieldCheck size={14} /> Admin
                                </span>
                            )}
                        </div>
                    </div>

                    <nav className="dashboard-nav" aria-label="Dashboard sections">
                        {DASHBOARD_LINKS.map((item) => {
                            const Icon = item.icon;
                            return (
                                <NavLink
                                    key={item.id}
                                    to={item.to}
                                    end={item.id === 'overview'}
                                    className={({ isActive }) => `dashboard-nav-link${isActive ? ' active' : ''}`}
                                >
                                    <span className="dashboard-nav-icon">
                                        <Icon size={18} />
                                    </span>
                                    <span>{item.label}</span>
                                    <ChevronRight size={16} className="dashboard-nav-arrow" />
                                </NavLink>
                            );
                        })}
                    </nav>

                    {isAdmin && (
                        <Link to="/admin" className="dashboard-admin-link">
                            Open Admin Console <ArrowRight size={16} />
                        </Link>
                    )}
                </aside>

                <section className="dashboard-content">
                    {userStatus === 'suspended' && (
                        <div className="empty-state warning-state">
                            <p>Your account is currently suspended. Please contact support for assistance.</p>
                        </div>
                    )}

                    {activeSection === 'overview' && (
                        <>
                            <div className="dashboard-hero dashboard-surface">
                                <div>
                                    <span className="dashboard-eyebrow">Overview</span>
                                    <h1>Welcome back, {displayName}</h1>
                                    <p>
                                        Track your orders, update your account details, and keep your buying flow smooth
                                        from both desktop and mobile.
                                    </p>
                                </div>
                                <div className="dashboard-hero-meta">
                                    <span>Account Email</span>
                                    <strong>{profile?.email || user.email}</strong>
                                </div>
                            </div>

                            <div className="stats-grid">
                                <div className="stat-card dashboard-surface">
                                    <h3>Total Orders</h3>
                                    <p className="stat-num">{orders?.length || 0}</p>
                                </div>
                                <div className="stat-card dashboard-surface">
                                    <h3>Total Spent</h3>
                                    <p className="stat-num">KSh {totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="stat-card dashboard-surface">
                                    <h3>Latest Status</h3>
                                    <p className="stat-num smaller">{recentOrders[0]?.status || 'No orders yet'}</p>
                                </div>
                            </div>

                            <div className="dashboard-quick-grid">
                                <Link to="/categories" className="quick-card dashboard-surface">
                                    <span className="dashboard-eyebrow">Shop</span>
                                    <h3>Browse Products</h3>
                                    <p>Jump back into the store and keep shopping without losing your place.</p>
                                    <span className="quick-card-link">Open catalog <ArrowRight size={16} /></span>
                                </Link>
                                <Link to="/dashboard/orders" className="quick-card dashboard-surface">
                                    <span className="dashboard-eyebrow">Orders</span>
                                    <h3>Track Purchases</h3>
                                    <p>See payment progress, delivery updates, and your most recent order activity.</p>
                                    <span className="quick-card-link">View orders <ArrowRight size={16} /></span>
                                </Link>
                                <Link to="/dashboard/settings" className="quick-card dashboard-surface">
                                    <span className="dashboard-eyebrow">Profile</span>
                                    <h3>Update Details</h3>
                                    <p>Keep your phone, institution, and contact information current for checkout.</p>
                                    <span className="quick-card-link">Edit settings <ArrowRight size={16} /></span>
                                </Link>
                            </div>

                            <div className="dashboard-section">
                                <div className="section-head">
                                    <div>
                                        <span className="dashboard-eyebrow">Recent Activity</span>
                                        <h2>Recent Orders</h2>
                                    </div>
                                    <Link to="/dashboard/orders" className="section-link">
                                        See all <ArrowRight size={16} />
                                    </Link>
                                </div>
                                {renderOrderList(recentOrders, true)}
                            </div>
                        </>
                    )}

                    {activeSection === 'orders' && (
                        <div className="dashboard-section">
                            <div className="section-head">
                                <div>
                                    <span className="dashboard-eyebrow">Orders</span>
                                    <h1>Order History</h1>
                                    <p>Every order, payment stage, and delivery update in one place.</p>
                                </div>
                            </div>
                            {renderOrderList(orders)}
                        </div>
                    )}

                    {activeSection === 'settings' && (
                        <div className="dashboard-section">
                            <div className="section-head">
                                <div>
                                    <span className="dashboard-eyebrow">Settings</span>
                                    <h1>Profile Settings</h1>
                                    <p>These details are used during checkout, contact, and order follow-up.</p>
                                </div>
                            </div>

                            <div className="profile-panel dashboard-surface">
                                {saveMessage && <div className="save-banner success">{saveMessage}</div>}
                                {saveError && <div className="save-banner error">{saveError}</div>}

                                <form className="profile-form" onSubmit={handleSaveProfile}>
                                    <div className="profile-grid">
                                        <div className="form-group">
                                            <label>{profile?.accountType === 'institution' ? 'Institution Name' : 'Full Name'}</label>
                                            <input
                                                type="text"
                                                value={profileForm.displayName}
                                                onChange={handleProfileChange('displayName')}
                                                required
                                            />
                                        </div>

                                        {profile?.accountType === 'parent_student' && (
                                            <div className="form-group">
                                                <label>Institution Name</label>
                                                <input
                                                    type="text"
                                                    value={profileForm.institutionName}
                                                    onChange={handleProfileChange('institutionName')}
                                                    required
                                                />
                                            </div>
                                        )}

                                        <div className="form-group">
                                            <label>Phone Number</label>
                                            <input
                                                type="tel"
                                                value={profileForm.phone}
                                                onChange={handleProfileChange('phone')}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>County</label>
                                            <select value={profileForm.county} onChange={handleProfileChange('county')} required>
                                                <option value="">Select county...</option>
                                                {KENYA_COUNTIES.map((county) => (
                                                    <option key={county} value={county}>{county}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {profile?.accountType === 'institution' && (
                                            <div className="form-group">
                                                <label>P.O. Box</label>
                                                <input type="text" value={profileForm.poBox} onChange={handleProfileChange('poBox')} />
                                            </div>
                                        )}

                                        {profile?.accountType === 'institution' && (
                                            <div className="form-group">
                                                <label>School Code</label>
                                                <input
                                                    type="text"
                                                    value={profileForm.schoolCode}
                                                    onChange={handleProfileChange('schoolCode')}
                                                    required
                                                />
                                            </div>
                                        )}

                                        {profile?.accountType === 'parent_student' && (
                                            <div className="form-group">
                                                <label>Admin / Student Number</label>
                                                <input type="text" value={profileForm.adminNo} onChange={handleProfileChange('adminNo')} />
                                            </div>
                                        )}

                                        <div className="form-group readonly-field">
                                            <label>Account Email</label>
                                            <input type="text" value={profile?.email || user.email || ''} readOnly />
                                        </div>
                                    </div>

                                    <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                                        {savingProfile ? 'Saving...' : 'Save Profile'}
                                    </button>
                                </form>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default Dashboard;
