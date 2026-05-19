import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart.js';
import './CartButton.css';

export default function CartButton() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const count = getCartCount();

  return (
    <button className="cart-button" onClick={() => navigate('/cart')} aria-label={`Cart with ${count} items`}>
      <span className="cart-icon" aria-hidden="true">Cart</span>
      {count > 0 && <span className="cart-badge">{count}</span>}
    </button>
  );
}
