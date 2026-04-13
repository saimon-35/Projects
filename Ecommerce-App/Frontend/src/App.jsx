import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import ProductsPage from './pages/ProductsPage';
import CartPage from './pages/CartPage';
import AdminPage from './pages/AdminPage';
import CartButton from './components/CartButton';
import ProductDetailPage from './pages/ProductDetailPage';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <CartProvider>
        <div className="app">
          <header className="app-header">
            <Link to="/" className="logo">
              <h1>🛍️ E-Shop</h1>
            </Link>
            <nav className="app-nav">
              <Link to="/" className="nav-link">
                Store
              </Link>
              <Link to="/admin" className="nav-link">
                Admin
              </Link>
              <CartButton />
            </nav>
          </header>

          <Routes>
            <Route path="/" element={<ProductsPage />} />
            <Route path="/cart" element={<CartPage />} />
             <Route path="/product/:id" element={<ProductDetailPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Routes>
        </div>
      </CartProvider>
    </BrowserRouter>
  );
}
