import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = (e) => {
    e.stopPropagation(); // Prevent navigation when clicking add to cart
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  return (
    <li className="product-card" onClick={handleCardClick}>
      <div className="product-card-content">
        {product.image && (
          <div className="product-image-container">
            <img src={product.image} alt={product.name} className="product-image" />
          </div>
        )}
        <h2>{product.name}</h2>
        <p className="price">${Number(product.price).toFixed(2)}</p>
        {product.description && <p className="desc">{product.description}</p>}
      </div>
      <button
        className={`add-to-cart-btn ${added ? 'added' : ''}`}
        onClick={handleAddToCart}
        disabled={added}
      >
        {added ? '✓ Added!' : 'Add to Cart'}
      </button>
    </li>
  );
}