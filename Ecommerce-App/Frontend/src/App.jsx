import { useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  useNavigate,
  useSearchParams,
  Navigate,
} from 'react-router-dom';

import { CartProvider } from './context/CartContext';
import { AuthProvider, useAuth } from './context/AuthContext';

import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import AdminPage from './pages/AdminPage';
import CartButton from './components/CartButton';
import ProductDetailPage from './pages/ProductDetailPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import CheckoutPage from './pages/CheckoutPage';
import SearchResultsPage from './pages/SearchResultsPage';
import DeliveryDashboard from './pages/DeliveryDashboard';
import AdminDeliveryPanel from './pages/AdminDeliveryPanel';

import { PRODUCT_DEPARTMENTS } from './searchConfig';

import './App.css';

function Header() {
  const { user, logout } = useAuth();

  const navigate = useNavigate();

  const [searchParams] = useSearchParams();

  const [searchQuery, setSearchQuery] = useState(
    searchParams.get('q') || ''
  );

  const [selectedCategory, setSelectedCategory] = useState(
    searchParams.get('category') || 'all'
  );

  const handleSearch = (event) => {
    event.preventDefault();

    const query = searchQuery.trim();

    const params = new URLSearchParams();

    if (query) params.set('q', query);

    params.set('category', selectedCategory || 'all');

    navigate(`/search?${params.toString()}`);
  };

  return (
    <header className="app-header">
      <Link to="/" className="logo" aria-label="E-Shop home">
        <span className="logo-mark">E</span>
        <span className="logo-text">E-Shop</span>
      </Link>

      <form className="header-search" onSubmit={handleSearch} role="search">
        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          aria-label="Select department"
        >
          {PRODUCT_DEPARTMENTS.map((department) => (
            <option key={department.value} value={department.value}>
              {department.label}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Search for products, brands and more"
          aria-label="Search products"
        />

        <button type="submit">Search</button>
      </form>

      <nav className="app-nav" aria-label="Primary navigation">
        {user ? (
          <>
            <Link to="/profile" className="nav-action">
              <span className="nav-action-kicker">
                Hello, {user.username}
              </span>

              <span className="nav-action-label">Account</span>
            </Link>

            <button onClick={logout} className="nav-action logout-button">
              <span className="nav-action-kicker">Account</span>
              <span className="nav-action-label">Logout</span>
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="nav-action">
              <span className="nav-action-kicker">
                Hello, sign in
              </span>

              <span className="nav-action-label">Account</span>
            </Link>

            <Link to="/register" className="nav-register">
              Register
            </Link>
          </>
        )}

        <Link to="/profile" className="nav-action orders-link">
          <span className="nav-action-kicker">Returns</span>
          <span className="nav-action-label">& Orders</span>
        </Link>

        {/* ADMIN */}
        {user?.is_admin && (
          <>
            <Link to="/admin" className="nav-action admin-link">
              <span className="nav-action-kicker">Seller</span>
              <span className="nav-action-label">Admin</span>
            </Link>

            <Link
              to="/admin/delivery"
              className="nav-action delivery-link"
            >
              <span className="nav-action-kicker">Manage</span>
              <span className="nav-action-label">Delivery</span>
            </Link>
          </>
        )}

        {/* DELIVERY MAN */}
        {user?.role === 'delivery_man' && (
          <Link
            to="/delivery-dashboard"
            className="nav-action delivery-dashboard-link"
          >
            <span className="nav-action-kicker">Delivery</span>
            <span className="nav-action-label">Dashboard</span>
          </Link>
        )}

        <CartButton />
      </nav>
    </header>
  );
}

function ProtectedAdminRoute({ children }) {
  const { user } = useAuth();

  if (!user?.is_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function ProtectedDeliveryRoute({ children }) {
  const { user } = useAuth();

  if (user?.role !== 'delivery_man') {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="app">
            <Header />

            <Routes>
              <Route path="/" element={<ProductsPage />} />

              <Route
                path="/search"
                element={<SearchResultsPage />}
              />

              <Route path="/cart" element={<CartPage />} />

              <Route
                path="/product/:id"
                element={<ProductDetailPage />}
              />

              <Route
                path="/admin"
                element={
                  <ProtectedAdminRoute>
                    <AdminPage />
                  </ProtectedAdminRoute>
                }
              />

              <Route
                path="/admin/delivery"
                element={
                  <ProtectedAdminRoute>
                    <AdminDeliveryPanel />
                  </ProtectedAdminRoute>
                }
              />

              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/register"
                element={<RegisterPage />}
              />

              <Route
                path="/profile"
                element={<ProfilePage />}
              />

              <Route
                path="/checkout"
                element={<CheckoutPage />}
              />

              <Route
                path="/delivery-dashboard"
                element={
                  <ProtectedDeliveryRoute>
                    <DeliveryDashboard />
                  </ProtectedDeliveryRoute>
                }
              />
            </Routes>
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}