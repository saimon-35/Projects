import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createProduct,
  deleteProduct,
  getAdminDashboard,
  getProducts,
  updateProduct,
} from '../api.js';
import ImageUploader from '../components/ImageUploader';
import './AdminPage.css';

const emptyForm = { name: '', price: '', description: '', image: '' };

const NAV_ITEMS = [
  { id: 'overview',  icon: '⊞', label: 'Overview' },
  { id: 'products',  icon: '◫', label: 'Products' },
  { id: 'orders',    icon: '◳', label: 'Orders' },
  { id: 'customers', icon: '◎', label: 'Customers' },
  { id: 'analytics', icon: '◈', label: 'Analytics' },
  { id: 'settings',  icon: '◉', label: 'Settings' },
];

const money = (value) => `$${Number(value || 0).toLocaleString(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

const shortDate = (value) => value
  ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  : 'Never';

// Tiny sparkline SVG
function Sparkline({ values = [], color = '#10b981', height = 36 }) {
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 100, h = height;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  });
  const areaPath = `M${pts[0]} L${pts.join(' L')} L${w},${h} L0,${h} Z`;
  const linePath = `M${pts.join(' L')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="sparkline">
      <defs>
        <linearGradient id={`g-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#g-${color.replace('#','')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Metric card
function MetricCard({ label, value, delta, color, sparkData, icon, prefix = '' }) {
  const positive = delta >= 0;
  return (
    <div className="metric-card">
      <div className="metric-top">
        <div className="metric-icon" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        <span className={`metric-delta ${positive ? 'up' : 'down'}`}>
          {positive ? '↑' : '↓'} {Math.abs(delta)}%
        </span>
      </div>
      <div className="metric-value">{prefix}{value}</div>
      <div className="metric-label">{label}</div>
      <div className="metric-spark">
        <Sparkline values={sparkData} color={color} />
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [activeNav, setActiveNav] = useState('overview');
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [blocked, setBlocked] = useState(false);
  const [imageMode, setImageMode] = useState('upload');
  const [searchQ, setSearchQ] = useState('');
  const [orderSearchQ, setOrderSearchQ] = useState('');
  const [customerSearchQ, setCustomerSearchQ] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (!user.is_admin) {
      setBlocked(true);
      const t = setTimeout(() => navigate('/', { replace: true }), 3000);
      return () => clearTimeout(t);
    }
    loadAdminData();
  }, [user, navigate]);

  // Auto-clear success message
  useEffect(() => {
    if (!success) return;
    const t = setTimeout(() => setSuccess(''), 3500);
    return () => clearTimeout(t);
  }, [success]);

  async function loadProducts() {
    setLoading(true);
    setError('');
    try {
      const data = await getProducts();
      setProducts(Array.isArray(data.products) ? data.products : []);
    } catch (e) {
      setError(e?.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }

  async function loadAdminData() {
    setLoading(true);
    setDashboardLoading(true);
    setError('');
    try {
      const [productsData, dashboardData] = await Promise.all([
        getProducts(),
        getAdminDashboard(),
      ]);
      setProducts(Array.isArray(productsData.products) ? productsData.products : []);
      setDashboard(dashboardData);
    } catch (e) {
      setError(e?.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
      setDashboardLoading(false);
    }
  }

  function openCreateForm() {
    setForm(emptyForm);
    setEditingId(null);
    setImageMode('upload');
    setShowForm(true);
    setError('');
    setSuccess('');
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm({
      name: product.name || '',
      price: String(product.price ?? ''),
      description: product.description || '',
      image: product.image || '',
    });
    setImageMode(
      product.image && !product.image.startsWith('/static/uploads/') ? 'url' : 'upload'
    );
    setShowForm(true);
    setError('');
    setSuccess('');
    setActiveNav('products');
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((c) => ({ ...c, [name]: value }));
  }

  function handleImageUploaded(url) {
    setForm((c) => ({ ...c, image: url }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      if (editingId) {
        const data = await updateProduct(editingId, form);
        setProducts((c) => c.map((p) => (p.id === editingId ? data.product : p)));
        setSuccess('Product updated successfully');
      } else {
        const data = await createProduct(form);
        setProducts((c) => [...c, data.product].sort((a, b) => a.id - b.id));
        setSuccess('Product created successfully');
      }
      getAdminDashboard().then(setDashboard).catch(() => {});
      closeForm();
    } catch (e) {
      setError(e?.message || 'Failed to save product');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId) {
    setError('');
    try {
      await deleteProduct(productId);
      setProducts((c) => c.filter((p) => p.id !== productId));
      setSuccess('Product deleted');
      setDeleteConfirm(null);
      getAdminDashboard().then(setDashboard).catch(() => {});
      if (editingId === productId) closeForm();
    } catch (e) {
      setError(e?.message || 'Failed to delete');
    }
  }

  // Filtered products
  const filtered = useMemo(() => {
    if (!searchQ.trim()) return products;
    const q = searchQ.toLowerCase();
    return products.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [products, searchQ]);

  // Live backend-driven dashboard data
  const orders = dashboard?.orders || [];
  const customers = dashboard?.customers || [];
  const analytics = dashboard?.analytics || {};
  const summary = dashboard?.summary || {};

  const filteredOrders = useMemo(() => {
    const q = orderSearchQ.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter((order) => (
      String(order.id).includes(q)
      || order.customer?.username?.toLowerCase().includes(q)
      || order.customer?.email?.toLowerCase().includes(q)
      || order.status?.toLowerCase().includes(q)
    ));
  }, [orders, orderSearchQ]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearchQ.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((customer) => (
      customer.username?.toLowerCase().includes(q)
      || customer.email?.toLowerCase().includes(q)
    ));
  }, [customers, customerSearchQ]);

  const metrics = [
    { label: 'Total Revenue', value: money(summary.totalRevenue), delta: summary.revenueDelta || 0, color: '#10b981', prefix: '', icon: 'Revenue', sparkData: analytics.revenueByDay || [0,0,0,0,0,0,0] },
    { label: 'Total Orders', value: summary.totalOrders || 0, delta: summary.ordersDelta || 0, color: '#6366f1', prefix: '', icon: 'Orders', sparkData: analytics.ordersByDay || [0,0,0,0,0,0,0] },
    { label: 'Products Listed', value: products.length, delta: 0, color: '#f59e0b', prefix: '', icon: 'Items', sparkData: [0,0,0,0,0,0,products.length] },
    { label: 'Avg Order Value', value: money(summary.avgOrderValue), delta: 0, color: '#ef4444', prefix: '', icon: 'AOV', sparkData: analytics.revenueByDay || [0,0,0,0,0,0,0] },
  ];

  /*
  const unusedLegacyMetrics = [
    { label: 'Total Revenue',   value: '$24,580', delta: 12.4, color: '#10b981', prefix: '', icon: '◈', sparkData: [30,45,35,60,52,75,68,82,70,90,85,95] },
    { label: 'Total Orders',    value: '1,284',   delta: 8.1,  color: '#6366f1', prefix: '', icon: '◳', sparkData: [20,35,28,45,38,55,48,62,55,70,65,75] },
    { label: 'Products Listed', value: products.length, delta: 0, color: '#f59e0b', prefix: '', icon: '◫', sparkData: [10,10,12,12,14,14,14,16,16,18,18,products.length] },
    { label: 'Avg Order Value', value: '$19.14',  delta: -2.3, color: '#ef4444', prefix: '', icon: '◎', sparkData: [22,19,24,21,18,20,17,19,21,18,20,19] },
  ];
  */

  if (blocked) {
    return (
      <div className="admin-blocked">
        <div className="blocked-icon">⛔</div>
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
        <p className="blocked-redirect">Redirecting to home…</p>
      </div>
    );
  }

  return (
    <div className={`admin-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>

      {/* ── SIDEBAR ─────────────────────────────────────────────── */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">E</div>
          {sidebarOpen && <span className="brand-name">E-Shop</span>}
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => {
                setActiveNav(item.id);
                if (item.id !== 'products') setShowForm(false);
              }}
              title={!sidebarOpen ? item.label : ''}
            >
              <span className="nav-icon">{item.icon}</span>
              {sidebarOpen && <span className="nav-label">{item.label}</span>}
              {sidebarOpen && activeNav === item.id && <span className="nav-pip" />}
            </button>
          ))}
        </nav>

        <button className="sidebar-toggle" onClick={() => setSidebarOpen((o) => !o)}>
          {sidebarOpen ? '◂' : '▸'}
        </button>

        <div className="sidebar-user">
          <div className="user-avatar">{user?.username?.[0]?.toUpperCase()}</div>
          {sidebarOpen && (
            <div className="user-info">
              <span className="user-name">{user?.username}</span>
              <span className="user-role">Administrator</span>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ────────────────────────────────────────── */}
      <main className="admin-main">

        {/* Top bar */}
        <header className="admin-topbar">
          <div className="topbar-left">
            <h1 className="topbar-title">
              {activeNav === 'overview' && 'Dashboard'}
              {activeNav === 'products' && 'Products'}
              {activeNav === 'orders' && 'Orders'}
              {activeNav === 'customers' && 'Customers'}
              {activeNav === 'analytics' && 'Analytics'}
              {activeNav === 'settings' && 'Settings'}
            </h1>
            <span className="topbar-date">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </span>
          </div>
          <div className="topbar-right">
            <button className="topbar-btn" onClick={() => navigate('/')} title="View store">
              ↗ View Store
            </button>
            {activeNav === 'products' && (
              <button className="topbar-btn primary" onClick={openCreateForm}>
                + Add Product
              </button>
            )}
          </div>
        </header>

        {/* Toast */}
        {(success || error) && (
          <div className={`admin-toast ${error ? 'toast-error' : 'toast-success'}`}>
            <span>{error ? '⚠ ' : '✓ '}{error || success}</span>
            <button onClick={() => { setError(''); setSuccess(''); }}>✕</button>
          </div>
        )}

        {/* ── OVERVIEW TAB ────────────────────────────────────── */}
        {activeNav === 'overview' && (
          <div className="tab-content">
            {/* Metric cards */}
            <div className="metrics-grid">
              {metrics.map((m) => <MetricCard key={m.label} {...m} />)}
            </div>

            {/* Quick actions + recent products */}
            <div className="overview-grid">
              <section className="overview-card">
                <div className="card-header">
                  <h2>Recent Products</h2>
                  <button className="text-btn" onClick={() => setActiveNav('products')}>
                    View all →
                  </button>
                </div>
                {loading ? (
                  <div className="mini-skeleton-list">
                    {[1,2,3].map(i => <div key={i} className="mini-skeleton-row" />)}
                  </div>
                ) : (
                  <ul className="recent-products-list">
                    {products.slice(-5).reverse().map((p) => (
                      <li key={p.id} className="recent-product-item" onClick={() => startEdit(p)}>
                        <div className="recent-product-img">
                          {p.image
                            ? <img src={p.image} alt={p.name} />
                            : <span>📦</span>
                          }
                        </div>
                        <div className="recent-product-info">
                          <span className="recent-product-name">{p.name}</span>
                          <span className="recent-product-desc">
                            {p.description ? p.description.slice(0, 50) + (p.description.length > 50 ? '…' : '') : 'No description'}
                          </span>
                        </div>
                        <span className="recent-product-price">${Number(p.price).toFixed(2)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="overview-card">
                <div className="card-header">
                  <h2>Quick Actions</h2>
                </div>
                <div className="quick-actions">
                  {[
                    { icon: '＋', label: 'Add Product', desc: 'Create a new listing', action: () => { setActiveNav('products'); openCreateForm(); } },
                    { icon: '↻', label: 'Sync Inventory', desc: 'Refresh product data', action: loadAdminData },
                    { icon: '↗', label: 'Visit Store', desc: 'See the live storefront', action: () => navigate('/') },
                    { icon: '◈', label: 'View Analytics', desc: 'Revenue & traffic', action: () => setActiveNav('analytics') },
                  ].map((qa) => (
                    <button key={qa.label} className="quick-action-item" onClick={qa.action}>
                      <span className="qa-icon">{qa.icon}</span>
                      <div className="qa-text">
                        <span className="qa-label">{qa.label}</span>
                        <span className="qa-desc">{qa.desc}</span>
                      </div>
                      <span className="qa-arrow">→</span>
                    </button>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── PRODUCTS TAB ────────────────────────────────────── */}
        {activeNav === 'products' && (
          <div className="tab-content">
            <div className="products-layout">

              {/* Product table */}
              <section className="products-table-section">
                <div className="table-toolbar">
                  <div className="table-search">
                    <span className="search-icon-sm">⌕</span>
                    <input
                      type="text"
                      placeholder="Search products…"
                      value={searchQ}
                      onChange={(e) => setSearchQ(e.target.value)}
                      className="table-search-input"
                    />
                    {searchQ && <button className="search-clear-sm" onClick={() => setSearchQ('')}>✕</button>}
                  </div>
                  <span className="table-count">{filtered.length} items</span>
                </div>

                {loading ? (
                  <div className="table-skeleton">
                    {[1,2,3,4].map(i => <div key={i} className="table-skeleton-row" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="table-empty">
                    <span>📦</span>
                    <p>{searchQ ? 'No products match your search.' : 'No products yet.'}</p>
                    {!searchQ && <button className="topbar-btn primary" onClick={openCreateForm}>Add your first product</button>}
                  </div>
                ) : (
                  <div className="admin-table-wrap">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Price</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map((p) => (
                          <tr key={p.id} className={editingId === p.id ? 'row-editing' : ''}>
                            <td>
                              <div className="product-cell">
                                <div className="product-thumb">
                                  {p.image
                                    ? <img src={p.image} alt={p.name} />
                                    : <span>📦</span>
                                  }
                                </div>
                                <div className="product-cell-info">
                                  <span className="product-cell-name">{p.name}</span>
                                  <span className="product-cell-desc">
                                    {p.description
                                      ? p.description.slice(0, 60) + (p.description.length > 60 ? '…' : '')
                                      : <em>No description</em>
                                    }
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td>
                              <span className="price-badge">${Number(p.price).toFixed(2)}</span>
                            </td>
                            <td>
                              <span className="status-badge active">Active</span>
                            </td>
                            <td>
                              <div className="row-actions">
                                <button className="action-btn edit" onClick={() => startEdit(p)}>
                                  Edit
                                </button>
                                <button
                                  className="action-btn delete"
                                  onClick={() => setDeleteConfirm(p)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Form panel — slides in from right */}
              {showForm && (
                <aside className="product-form-panel">
                  <div className="form-panel-header">
                    <h2>{editingId ? 'Edit Product' : 'New Product'}</h2>
                    <button className="form-close-btn" onClick={closeForm}>✕</button>
                  </div>

                  <form onSubmit={handleSubmit} className="product-form">
                    <div className="form-field">
                      <label>Product Name *</label>
                      <input
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="e.g. Wireless Headphones Pro"
                        required
                      />
                    </div>

                    <div className="form-field">
                      <label>Price (USD) *</label>
                      <div className="price-input-wrap">
                        <span className="price-symbol">$</span>
                        <input
                          name="price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.price}
                          onChange={handleChange}
                          placeholder="0.00"
                          required
                        />
                      </div>
                    </div>

                    <div className="form-field">
                      <label>Description</label>
                      <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        placeholder="Describe your product…"
                        rows="4"
                      />
                    </div>

                    <div className="form-field">
                      <label>Product Image</label>
                      <div className="image-mode-tabs">
                        <button
                          type="button"
                          className={`mode-tab ${imageMode === 'upload' ? 'active' : ''}`}
                          onClick={() => setImageMode('upload')}
                        >Upload file</button>
                        <button
                          type="button"
                          className={`mode-tab ${imageMode === 'url' ? 'active' : ''}`}
                          onClick={() => setImageMode('url')}
                        >Paste URL</button>
                      </div>

                      {imageMode === 'upload' ? (
                        <ImageUploader currentUrl={form.image} onUploaded={handleImageUploaded} />
                      ) : (
                        <input
                          name="image"
                          value={form.image}
                          onChange={handleChange}
                          placeholder="https://example.com/image.jpg"
                        />
                      )}

                      {form.image && (
                        <div className="image-preview-strip">
                          <img src={form.image} alt="Preview" />
                          <span>Preview</span>
                        </div>
                      )}
                    </div>

                    {error && <div className="form-error">⚠ {error}</div>}

                    <div className="form-actions">
                      <button type="button" className="btn-secondary" onClick={closeForm}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? <span className="btn-spinner" /> : null}
                        {saving ? 'Saving…' : editingId ? 'Update Product' : 'Create Product'}
                      </button>
                    </div>
                  </form>
                </aside>
              )}
            </div>
          </div>
        )}

        {/* ── PLACEHOLDER TABS ────────────────────────────────── */}
        {activeNav === 'orders' && (
          <div className="tab-content">
            <section className="products-table-section">
              <div className="table-toolbar">
                <div className="table-search">
                  <input type="text" placeholder="Search orders..." value={orderSearchQ} onChange={(e) => setOrderSearchQ(e.target.value)} className="table-search-input" />
                </div>
                <span className="table-count">{filteredOrders.length} orders</span>
              </div>
              {dashboardLoading ? (
                <div className="table-skeleton">{[1,2,3].map(i => <div key={i} className="table-skeleton-row" />)}</div>
              ) : filteredOrders.length === 0 ? (
                <div className="table-empty"><span>Orders</span><p>No orders found.</p></div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Total</th><th>Status</th><th>Date</th></tr></thead>
                    <tbody>{filteredOrders.map((order) => (
                      <tr key={order.id}>
                        <td><span className="price-badge">#{order.id}</span></td>
                        <td><div className="product-cell-info"><span className="product-cell-name">{order.customer?.username || 'Unknown'}</span><span className="product-cell-desc">{order.customer?.email || 'No email'}</span></div></td>
                        <td>{order.item_count}</td>
                        <td><span className="price-badge">{money(order.total_amount)}</span></td>
                        <td><span className="status-badge active">{order.status}</span></td>
                        <td>{shortDate(order.created_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeNav === 'customers' && (
          <div className="tab-content">
            <section className="products-table-section">
              <div className="table-toolbar">
                <div className="table-search">                  
                  <input type="text" placeholder="Search customers..." value={customerSearchQ} onChange={(e) => setCustomerSearchQ(e.target.value)} className="table-search-input" />
                </div>
                <span className="table-count">{filteredCustomers.length} customers</span>
              </div>
              {dashboardLoading ? (
                <div className="table-skeleton">{[1,2,3].map(i => <div key={i} className="table-skeleton-row" />)}</div>
              ) : filteredCustomers.length === 0 ? (
                <div className="table-empty"><span>Customers</span><p>No customers found.</p></div>
              ) : (
                <div className="admin-table-wrap">
                  <table className="admin-table">
                    <thead><tr><th>Customer</th><th>Role</th><th>Orders</th><th>Total Spent</th><th>Addresses</th><th>Joined</th></tr></thead>
                    <tbody>{filteredCustomers.map((customer) => (
                      <tr key={customer.id}>
                        <td><div className="product-cell-info"><span className="product-cell-name">{customer.username}</span><span className="product-cell-desc">{customer.email}</span></div></td>
                        <td><span className={`status-badge ${customer.is_admin ? 'warning' : 'active'}`}>{customer.is_admin ? 'Admin' : 'Customer'}</span></td>
                        <td>{customer.orders_count}</td>
                        <td><span className="price-badge">{money(customer.total_spent)}</span></td>
                        <td>{customer.addresses_count}</td>
                        <td>{shortDate(customer.created_at)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {activeNav === 'analytics' && (
          <div className="tab-content">
            <div className="metrics-grid">{metrics.map((m) => <MetricCard key={m.label} {...m} />)}</div>
            <div className="overview-grid">
              <section className="overview-card">
                <div className="card-header"><h2>Top Products</h2></div>
                {(analytics.topProducts || []).length === 0 ? (
                  <div className="table-empty"><p>No sales data yet.</p></div>
                ) : (
                  <ul className="recent-products-list">{analytics.topProducts.map((item) => (
                    <li key={item.product_id} className="recent-product-item">
                      <div className="recent-product-img">{item.image ? <img src={item.image} alt={item.name} /> : <span>Item</span>}</div>
                      <div className="recent-product-info"><span className="recent-product-name">{item.name}</span><span className="recent-product-desc">{item.quantity} sold</span></div>
                      <span className="recent-product-price">{money(item.revenue)}</span>
                    </li>
                  ))}</ul>
                )}
              </section>
              <section className="overview-card">
                <div className="card-header"><h2>Last 7 Days Revenue</h2></div>
                <div className="analytics-chart"><Sparkline values={analytics.revenueByDay || []} color="#10b981" height={120} /></div>
              </section>
            </div>
          </div>
        )}

        {activeNav === 'settings' && (
          <div className="tab-content">
            <section className="overview-card settings-panel">
              <div className="card-header"><h2>Store Settings</h2></div>
              <div className="settings-grid">
                <div><span>Store name</span><strong>E-Shop</strong></div>
                <div><span>Products</span><strong>{products.length}</strong></div>
                <div><span>Orders</span><strong>{summary.totalOrders || 0}</strong></div>
                <div><span>Customers</span><strong>{summary.totalCustomers || 0}</strong></div>
              </div>
              <p className="settings-note">These values come from the live backend. Editable settings can be added when a store settings model exists.</p>
            </section>
          </div>
        )}

        {false && ['orders', 'customers', 'analytics', 'settings'].includes(activeNav) && (
          <div className="tab-content">
            <div className="placeholder-tab">
              <div className="placeholder-icon">
                {activeNav === 'orders' && '◳'}
                {activeNav === 'customers' && '◎'}
                {activeNav === 'analytics' && '◈'}
                {activeNav === 'settings' && '◉'}
              </div>
              <h2>
                {activeNav.charAt(0).toUpperCase() + activeNav.slice(1)}
              </h2>
              <p>This section is coming soon. Stay tuned for updates.</p>
              <button className="topbar-btn" onClick={() => setActiveNav('overview')}>
                ← Back to Overview
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── DELETE CONFIRM MODAL ────────────────────────────────── */}
      {deleteConfirm && (
        <div className="modal-backdrop" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-icon">🗑</div>
            <h3>Delete product?</h3>
            <p>
              "<strong>{deleteConfirm.name}</strong>" will be permanently removed.
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
