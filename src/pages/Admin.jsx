import React, { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { PlusCircle, LayoutDashboard, Package, ShoppingBag, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  ORDER_STATUSES,
  USER_STATUSES,
  createProduct,
  deleteProduct,
  getAllOrders,
  getAllUserProfiles,
  getProducts,
  updateOrderStatus,
  updateUserStatus,
  updateProduct
} from '../lib/db';
import './Admin.css';

const parseImageUrls = (rawValue) => {
  return rawValue
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const formatDate = (value) => {
  if (!value) return 'Unknown';
  if (value instanceof Date) return value.toLocaleString();
  return String(value);
};

const initialFormState = {
  productName: '',
  description: '',
  price: '',
  category: '',
  stock: '',
  featured: false,
  imageUrls: ''
};

const Admin = () => {
  const { user, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [savingProduct, setSavingProduct] = useState(false);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [userProfiles, setUserProfiles] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [formData, setFormData] = useState(initialFormState);
  const [editingProductId, setEditingProductId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const loadData = async () => {
    setLoadingData(true);
    setError('');
    try {
      const [productData, orderData, profileData] = await Promise.all([getProducts(), getAllOrders(), getAllUserProfiles()]);
      setProducts(productData);
      setOrders(orderData);
      setUserProfiles(profileData);
    } catch (err) {
      console.error(err);
      setError(`Failed to load admin data: ${err.message}`);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user || !isAdmin) return;
    loadData();
  }, [user, isAdmin]);

  const resetForm = () => {
    setFormData(initialFormState);
    setEditingProductId('');
  };

  const handleChange = (field) => (event) => {
    const value = field === 'featured' ? event.target.checked : event.target.value;
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleStockBump = (delta) => {
    setFormData((prev) => {
      const next = Math.max(0, Number(prev.stock || 0) + delta);
      return { ...prev, stock: String(next) };
    });
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    setError('');
    setSuccess('');

    try {
      const images = parseImageUrls(formData.imageUrls);
      if (images.length === 0) {
        throw new Error('Add at least one public Cloudinary URL.');
      }

      const payload = {
        name: formData.productName,
        description: formData.description,
        price: formData.price,
        category: formData.category,
        stock: formData.stock,
        featured: formData.featured,
        images
      };

      if (editingProductId) {
        await updateProduct(editingProductId, payload);
        setSuccess('Product updated successfully.');
      } else {
        await createProduct(payload);
        setSuccess('Product created successfully.');
      }

      resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(`Failed to save product: ${err.message}`);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleEditProduct = (product) => {
    setEditingProductId(product.id);
    setFormData({
      productName: product.name || '',
      description: product.description || '',
      price: String(product.price || ''),
      category: product.category || '',
      stock: String(product.stock || ''),
      featured: Boolean(product.featured),
      imageUrls: (product.images || [product.image_url]).filter(Boolean).join('\n')
    });
    setActiveTab('products');
    setSuccess('');
    setError('');
  };

  const handleDeleteProduct = async (product) => {
    const confirmed = window.confirm(`Delete "${product.name}" permanently?`);
    if (!confirmed) return;

    setError('');
    setSuccess('');
    try {
      await deleteProduct(product.id);
      setSuccess('Product deleted.');
      if (editingProductId === product.id) resetForm();
      await loadData();
    } catch (err) {
      console.error(err);
      setError(`Failed to delete product: ${err.message}`);
    }
  };

  const handleOrderStatusChange = async (orderId, nextStatus) => {
    setError('');
    setSuccess('');
    try {
      await updateOrderStatus(orderId, nextStatus);
      setSuccess(`Order status updated to ${nextStatus}.`);
      setOrders((prev) => prev.map((order) => (
        order.id === orderId ? { ...order, status: nextStatus } : order
      )));
    } catch (err) {
      console.error(err);
      setError(`Failed to update order: ${err.message}`);
    }
  };

  const handleUserStatusChange = async (uid, nextStatus) => {
    setError('');
    setSuccess('');
    try {
      await updateUserStatus(uid, nextStatus);
      setSuccess(`User status updated to ${nextStatus}.`);
      setUserProfiles((prev) => prev.map((profile) => (
        profile.uid === uid ? { ...profile, status: nextStatus } : profile
      )));
    } catch (err) {
      console.error(err);
      setError(`Failed to update user: ${err.message}`);
    }
  };

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'all') return orders;
    return orders.filter((order) => order.status === statusFilter);
  }, [orders, statusFilter]);

  const dashboardStats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
    const pending = orders.filter((order) => order.status === 'pending').length;
    const processing = orders.filter((order) => order.status === 'processing').length;
    const lowStockProducts = products.filter((product) => Number(product.stock) <= 5).length;
    return { totalRevenue, pending, processing, lowStockProducts, totalUsers: userProfiles.length };
  }, [orders, products, userProfiles]);

  const managedUsers = useMemo(() => {
    return userProfiles.map((profile) => {
      const userOrders = orders.filter((order) => order.user_id === profile.uid);
      const totalSpent = userOrders.reduce((sum, order) => sum + (Number(order.total) || 0), 0);
      return {
        ...profile,
        orderCount: userOrders.length,
        totalSpent
      };
    });
  }, [orders, userProfiles]);

  if (!user || !isAdmin) return <Navigate to="/dashboard" />;

  return (
    <div className="container admin-container">
      <h2>Admin Dashboard</h2>

      {success && <div className="success-alert">{success}</div>}
      {error && <div className="error-alert">{error}</div>}

      <div className="admin-shell">
        <aside className="admin-sidebar">
          <button className={activeTab === 'overview' ? 'active' : ''} onClick={() => setActiveTab('overview')}>
            <LayoutDashboard size={18} /> Overview
          </button>
          <button className={activeTab === 'products' ? 'active' : ''} onClick={() => setActiveTab('products')}>
            <Package size={18} /> Products
          </button>
          <button className={activeTab === 'orders' ? 'active' : ''} onClick={() => setActiveTab('orders')}>
            <ShoppingBag size={18} /> Orders
          </button>
          <button className={activeTab === 'customers' ? 'active' : ''} onClick={() => setActiveTab('customers')}>
            <Users size={18} /> Users
          </button>
        </aside>

        <section className="admin-main">
          {loadingData ? (
            <div className="admin-card"><p>Loading admin data...</p></div>
          ) : (
            <>
              {activeTab === 'overview' && (
                <div className="admin-card">
                  <h3>Store Snapshot</h3>
                  <div className="admin-stats-grid">
                    <div className="admin-stat"><span>Total Products</span><strong>{products.length}</strong></div>
                    <div className="admin-stat"><span>Total Orders</span><strong>{orders.length}</strong></div>
                    <div className="admin-stat"><span>Total Users</span><strong>{dashboardStats.totalUsers}</strong></div>
                    <div className="admin-stat"><span>Revenue</span><strong>KSh {dashboardStats.totalRevenue.toLocaleString()}</strong></div>
                    <div className="admin-stat"><span>Pending Orders</span><strong>{dashboardStats.pending}</strong></div>
                    <div className="admin-stat"><span>Processing</span><strong>{dashboardStats.processing}</strong></div>
                    <div className="admin-stat"><span>Low Stock (&lt;=5)</span><strong>{dashboardStats.lowStockProducts}</strong></div>
                  </div>
                </div>
              )}

              {activeTab === 'products' && (
                <>
                  <div className="admin-card">
                    <h3><PlusCircle size={20} /> {editingProductId ? 'Edit Product' : 'Add Product'}</h3>

                    <form className="admin-form" onSubmit={handleSaveProduct}>
                      <div className="form-group">
                        <label>Product Name</label>
                        <input type="text" value={formData.productName} onChange={handleChange('productName')} required />
                      </div>

                      <div className="form-group">
                        <label>Description</label>
                        <textarea value={formData.description} onChange={handleChange('description')} rows="3" />
                      </div>

                      <div className="form-row">
                        <div className="form-group">
                          <label>Price (KSh)</label>
                          <input type="number" min="0" value={formData.price} onChange={handleChange('price')} required />
                        </div>
                        <div className="form-group">
                          <label>Stock</label>
                          <div className="stock-input-row">
                            <input type="number" min="0" value={formData.stock} onChange={handleChange('stock')} required />
                            <div className="stock-quick">
                              {[1, 5, 10].map((step) => (
                                <button type="button" key={step} onClick={() => handleStockBump(step)} className="small-btn">
                                  +{step}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label>Category</label>
                        <input type="text" value={formData.category} onChange={handleChange('category')} required />
                      </div>

                      <div className="form-group upload-group">
                        <label>Cloudinary Image URLs</label>
                        <div className="upload-box cloudinary-box">
                          <p className="cloudinary-hint">Paste one or more public URLs separated by comma or new lines.</p>
                          <textarea
                            value={formData.imageUrls}
                            onChange={handleChange('imageUrls')}
                            rows="4"
                            placeholder="https://res.cloudinary.com/.../image/upload/...jpg"
                            required
                          />
                        </div>
                      </div>

                      <div className="form-group checkbox-group">
                        <label className="checkbox-label">
                          <input type="checkbox" checked={formData.featured} onChange={handleChange('featured')} />
                          Show as featured on homepage
                        </label>
                      </div>

                      <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={savingProduct}>
                          {savingProduct ? 'Saving...' : (editingProductId ? 'Update Product' : 'Add Product')}
                        </button>
                        {editingProductId && (
                          <button type="button" className="btn btn-secondary" onClick={resetForm}>Cancel Edit</button>
                        )}
                      </div>
                    </form>
                  </div>

                  <div className="admin-card">
                    <h3>Manage Products</h3>
                    <div className="admin-table">
                      <div className="admin-table-head">
                        <span>Product</span>
                        <span>Price</span>
                        <span>Stock</span>
                        <span>Featured</span>
                        <span>Actions</span>
                      </div>
                      {products.length === 0 ? (
                        <div className="admin-table-empty">No products found. Add your first product above.</div>
                      ) : (
                        products.map((product) => (
                          <div className="admin-table-row" key={product.id}>
                            <span>{product.name}</span>
                            <span>KSh {Number(product.price || 0).toLocaleString()}</span>
                            <span>{product.stock}</span>
                            <span>{product.featured ? 'Yes' : 'No'}</span>
                            <span className="action-cell">
                              <button className="small-btn edit" onClick={() => handleEditProduct(product)}>Edit</button>
                              <button className="small-btn delete" onClick={() => handleDeleteProduct(product)}>Delete</button>
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'orders' && (
                <div className="admin-card">
                  <h3>Manage Orders</h3>
                  <div className="order-controls">
                    <label>Status Filter</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="all">All statuses</option>
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>

                  <div className="admin-table">
                    <div className="admin-table-head orders">
                      <span>Order</span>
                      <span>Customer</span>
                      <span>Amount</span>
                      <span>Status</span>
                      <span>Date</span>
                    </div>
                    {filteredOrders.length === 0 ? (
                      <div className="admin-table-empty">No orders match your current filter.</div>
                    ) : (
                      filteredOrders.map((order) => (
                        <div className="admin-table-row orders" key={order.id}>
                          <span>#{order.id.slice(0, 8)}</span>
                          <span>{order.customer?.name || order.customer?.email || 'Unknown'}</span>
                          <span>KSh {(Number(order.total) || 0).toLocaleString()}</span>
                          <span>
                            <select
                              value={order.status}
                              onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                              className={`status-select status-${order.status}`}
                            >
                              {ORDER_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </span>
                          <span>{formatDate(order.created_at)}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'customers' && (
                <div className="admin-card">
                  <h3>Users</h3>
                    <div className="admin-table">
                      <div className="admin-table-head customers">
                        <span>User</span>
                        <span>Type</span>
                        <span>Access</span>
                        <span>Email</span>
                        <span>Status</span>
                        <span>Orders</span>
                        <span>Total Spent</span>
                    </div>
                    {managedUsers.length === 0 ? (
                      <div className="admin-table-empty">No user records yet.</div>
                    ) : (
                      managedUsers.map((profile) => (
                        <div key={profile.uid} className="admin-table-row customers">
                          <span>{profile.displayName || profile.institutionName || profile.fullName || 'Unknown'}</span>
                          <span>{profile.role}</span>
                          <span>{profile.accessRole || 'customer'}</span>
                          <span>{profile.email || profile.officialEmail || 'N/A'}</span>
                          <span>
                            <select
                              value={profile.status}
                              onChange={(e) => handleUserStatusChange(profile.uid, e.target.value)}
                              className={`status-select status-${profile.status}`}
                            >
                              {USER_STATUSES.map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </span>
                          <span>{profile.orderCount}</span>
                          <span>KSh {profile.totalSpent.toLocaleString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default Admin;
