import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/cart';
import './CartButton.css';

export default function CartButton() {
  const navigate = useNavigate();
  const { getCartCount } = useCart();
  const count = getCartCount();

  return (
    <button className="cart-button" onClick={() => navigate('/cart')}>
      <span className="cart-icon">🛒</span>
      {count > 0 && <span className="cart-badge">{count}</span>}
    </button>
  );
}
