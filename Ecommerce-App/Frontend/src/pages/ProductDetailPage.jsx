import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiUrl } from '../api.js';
import { useCart } from '../context/cart';
import './ProductDetailPage.css';

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProduct() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl(`/api/products/${id}`));
        if (!res.ok) {
          if (res.status === 404) {
            throw new Error('Product not found');
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (!cancelled) setProduct(data.product);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load product');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProduct();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const handleAddToCart = () => {
    if (!product) return;
    
    // Add multiple quantities
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleQuantityChange = (delta) => {
    setQuantity((prev) => Math.max(1, prev + delta));
  };

  if (loading) {
    return (
      <div className="product-detail-page">
        <div className="loading-container">
          <p>Loading product...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="product-detail-page">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => navigate('/')} className="back-btn">
            ← Back to Products
          </button>
        </div>
      </div>
    );
  }

  if (!product) {
    return null;
  }

  return (
    <div className="product-detail-page">
      <button onClick={() => navigate('/')} className="back-btn">
        ← Back to Products
      </button>

      <div className="product-detail-container">
        <div className="product-image-section">
          {product.image ? (
            <img src={product.image} alt={product.name} className="detail-image" />
          ) : (
            <div className="no-image">
              <span>📦</span>
              <p>No image available</p>
            </div>
          )}
        </div>

        <div className="product-info-section">
          <h1>{product.name}</h1>
          
          <div className="price-section">
            <span className="price">${Number(product.price).toFixed(2)}</span>
          </div>

          <div className="description-section">
            <h3>Description</h3>
            <p>{product.description || 'No description available.'}</p>
          </div>

          <div className="purchase-section">
            <div className="quantity-selector">
              <label>Quantity:</label>
              <div className="quantity-controls">
                <button 
                  onClick={() => handleQuantityChange(-1)}
                  className="qty-btn"
                  disabled={quantity <= 1}
                >
                  −
                </button>
                <span className="quantity-display">{quantity}</span>
                <button 
                  onClick={() => handleQuantityChange(1)}
                  className="qty-btn"
                >
                  +
                </button>
              </div>
            </div>

            <button
              className={`add-to-cart-btn-large ${added ? 'added' : ''}`}
              onClick={handleAddToCart}
              disabled={added}
            >
              {added ? '✓ Added to Cart!' : 'Add to Cart'}
            </button>

            <button
              className="buy-now-btn"
              onClick={() => {
                handleAddToCart();
                setTimeout(() => navigate('/cart'), 500);
              }}
            >
              Buy Now
            </button>
          </div>

          <div className="product-meta">
            <div className="meta-item">
              <strong>Product ID:</strong> {product.id}
            </div>
            <div className="meta-item">
              <strong>Availability:</strong> <span className="in-stock">In Stock</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
