import { useState } from 'react';
import { useCart } from '../context/cart';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const handleAddToCart = () => {
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  return (
    <li className="product-card">
      <h2>{product.name}</h2>
      <p className="price">${Number(product.price).toFixed(2)}</p>
      {product.description && <p className="desc">{product.description}</p>}
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