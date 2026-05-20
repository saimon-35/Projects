import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart.js';
import './ProductCard.css';

export default function ProductCard({
  product,
  isWishlisted = false,
  onToggleWishlist,
  wishlistBusy = false,
}) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  };

  const handleCardClick = () => navigate(`/product/${product.id}`);

  const handleWishlistClick = (e) => {
    e.stopPropagation();
    if (onToggleWishlist) onToggleWishlist(product.id, isWishlisted);
  };

  return (
    <div className="product-card" onClick={handleCardClick}>
      {/* Image */}
      <div className="product-card-image">
        {product.image ? (
          <img src={product.image} alt={product.name} className="product-image" loading="lazy" />
        ) : (
          <div className="product-no-image">
            <span>📦</span>
          </div>
        )}

        {/* Overlay actions on hover */}
        <div className="product-card-overlay">
          <button
            className="overlay-view-btn"
            onClick={handleCardClick}
          >
            Quick View →
          </button>
        </div>

        {/* Wishlist */}
        {onToggleWishlist && (
          <button
            type="button"
            className={`wishlist-btn ${isWishlisted ? 'active' : ''}`}
            onClick={handleWishlistClick}
            disabled={wishlistBusy}
            aria-label={isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}
          >
            {isWishlisted ? '♥' : '♡'}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="product-card-body">
        <div className="product-card-meta">
          <h2 className="product-card-name">{product.name}</h2>
          <span className="product-card-price">${Number(product.price).toFixed(2)}</span>
        </div>

        {product.description && (
          <p className="product-card-desc">{product.description}</p>
        )}

        <div className="product-card-rating" aria-label={`${product.rating || 4.5} out of 5 stars`}>
          <span className="rating-stars" aria-hidden="true">★★★★★</span>
          <span className="rating-value">{Number(product.rating || 4.5).toFixed(1)}</span>
        </div>

        <button
          className={`add-to-cart-btn ${added ? 'added' : ''}`}
          onClick={handleAddToCart}
          disabled={added}
        >
          <span className="btn-label">
            {added ? (
              <>
                <span className="btn-check">✓</span> Added to Cart
              </>
            ) : (
              'Add to Cart'
            )}
          </span>
        </button>
      </div>
    </div>
  );
}
