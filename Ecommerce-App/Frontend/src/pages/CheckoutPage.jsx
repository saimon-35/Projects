import { useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { loadStripe } from '@stripe/stripe-js';
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js';
import { useCart } from '../context/cart.js';
import { useAuth } from '../context/AuthContext';
import { confirmOrder, createPaymentIntent, getProfile } from '../api.js';
import './CheckoutPage.css';

// Initialise Stripe outside of render to avoid recreating on every render
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

// ─── Inner form (has access to Stripe hooks) ──────────────────────────────────
function PaymentForm({ amount, onSuccess }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setProcessing(true);
    setPaymentError('');

    // 1. Confirm the payment with Stripe
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // avoid full-page redirect for card payments
      confirmParams: {
        return_url: window.location.origin + '/order-success',
      },
    });

    if (error) {
      setPaymentError(error.message || 'Payment failed. Please try again.');
      setProcessing(false);
      return;
    }

    // 2. Tell our backend to create the Order record
    try {
      const data = await confirmOrder(paymentIntent.id);
      onSuccess(data.order);
    } catch (err) {
      // Order creation failed, but payment succeeded – surface this clearly
      setPaymentError(
        'Payment was taken but we could not record your order. ' +
          'Please contact support with reference: ' + paymentIntent.id
      );
      setProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="payment-form">
      <div className="stripe-element-wrapper">
        <PaymentElement
          options={{
            layout: 'tabs',
            
          }}
        />
      </div>

      {paymentError && (
        <div className="payment-error" role="alert">
          <span className="error-icon">⚠</span>
          {paymentError}
        </div>
      )}

      <button
        type="submit"
        className="pay-btn"
        disabled={!stripe || processing}
      >
        {processing ? (
          <span className="btn-inner">
            <span className="spinner" />
            Processing…
          </span>
        ) : (
          <span className="btn-inner">
            <span className="lock-icon">🔒</span>
            Pay ${amount.toFixed(2)}
          </span>
        )}
      </button>

      <p className="stripe-badge">
        Secured by <strong>Stripe</strong> · SSL encrypted
      </p>
    </form>
  );
}

// ─── Page shell ───────────────────────────────────────────────────────────────
export default function CheckoutPage() {
  const navigate = useNavigate();
  const { cart, getCartTotal, clearCart } = useCart();
  const { user } = useAuth();
  const total = getCartTotal();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [intentAmount, setIntentAmount] = useState(0);
  const [loadingIntent, setLoadingIntent] = useState(false);
  const [initError, setInitError] = useState('');
  const [step, setStep] = useState('address'); // 'address' | 'payment' | 'success'
  const [completedOrder, setCompletedOrder] = useState(null);

  // Redirect if not logged in or cart is empty
  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    if (cart.length === 0 && step !== 'success') { navigate('/cart'); return; }
  }, [user, cart, navigate, step]);

  // Load addresses
  useEffect(() => {
    if (!user) return;
    getProfile()
      .then((data) => {
        const addrs = Array.isArray(data.addresses) ? data.addresses : [];
        setAddresses(addrs);
        const def = addrs.find((a) => a.is_default);
        setSelectedAddressId(String(def?.id || addrs[0]?.id || ''));
      })
      .catch(() => setAddresses([]));
  }, [user]);

  const handleProceedToPayment = (async () => {
    if (!selectedAddressId) {
      setInitError('Please select a shipping address.');
      return;
    }
    setLoadingIntent(true);
    setInitError('');
    try {
      const data = await createPaymentIntent({
        address_id: Number(selectedAddressId),
        items: cart.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      });
      setClientSecret(data.clientSecret);
      setIntentAmount(data.amount);
      setStep('payment');
    } catch (err) {
      setInitError(err?.message || 'Could not initialise payment. Please try again.');
    } finally {
      setLoadingIntent(false);
    }
  });

  const handlePaymentSuccess = (order) => {
    clearCart();
    setCompletedOrder(order);
    setStep('success');
  };

  // ── Success screen ────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="checkout-page">
        <div className="success-screen">
          <div className="success-icon-wrap">
            <span className="success-checkmark">✓</span>
          </div>
          <h1>Order Confirmed!</h1>
          <p className="success-sub">
            Thank you for your purchase. Your order has been placed successfully.
          </p>
          {completedOrder && (
            <div className="success-order-box">
              <p className="order-ref">Order #{completedOrder.id}</p>
              <p className="order-total">
                Total: <strong>${Number(completedOrder.total_amount).toFixed(2)}</strong>
              </p>
            </div>
          )}
          <div className="success-actions">
            <button className="btn-primary" onClick={() => navigate('/profile')}>
              View Orders
            </button>
            <button className="btn-ghost" onClick={() => navigate('/')}>
              Continue Shopping
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedAddress = addresses.find((a) => String(a.id) === selectedAddressId);

  return (
    <div className="checkout-page">
      {/* ── Progress bar ───────────────────────────────────────────────── */}
      <div className="checkout-progress">
        <div className={`progress-step ${step === 'address' || step === 'payment' ? 'active' : ''}`}>
          <span className="step-num">1</span>
          <span className="step-label">Shipping</span>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${step === 'payment' ? 'active' : ''}`}>
          <span className="step-num">2</span>
          <span className="step-label">Payment</span>
        </div>
      </div>

      <div className="checkout-layout">
        {/* ── Left column ──────────────────────────────────────────────── */}
        <div className="checkout-main">
          {step === 'address' && (
            <section className="checkout-section">
              <h2>Shipping Address</h2>

              {addresses.length === 0 ? (
                <div className="no-address-notice">
                  <p>You have no saved addresses.</p>
                  <button className="btn-ghost" onClick={() => navigate('/profile')}>
                    Add an address in Profile →
                  </button>
                </div>
              ) : (
                <div className="address-options">
                  {addresses.map((addr) => (
                    <label
                      key={addr.id}
                      className={`address-option ${String(addr.id) === selectedAddressId ? 'selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name="address"
                        value={addr.id}
                        checked={String(addr.id) === selectedAddressId}
                        onChange={() => setSelectedAddressId(String(addr.id))}
                      />
                      <div className="address-option-body">
                        <strong>{addr.full_name}</strong>
                        {addr.is_default && <span className="default-tag">Default</span>}
                        <p>{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}</p>
                        <p>{addr.city}, {addr.state} {addr.postal_code}</p>
                        <p>{addr.country} · {addr.phone}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}

              {initError && (
                <div className="payment-error" role="alert">
                  <span className="error-icon">⚠</span>
                  {initError}
                </div>
              )}

              <button
                className="pay-btn"
                onClick={handleProceedToPayment}
                disabled={loadingIntent || addresses.length === 0}
              >
                {loadingIntent ? (
                  <span className="btn-inner"><span className="spinner" /> Preparing…</span>
                ) : (
                  <span className="btn-inner">Continue to Payment →</span>
                )}
              </button>
            </section>
          )}

          {step === 'payment' && clientSecret && (
            <section className="checkout-section">
              <button className="back-link" onClick={() => setStep('address')}>
                ← Change address
              </button>
              <h2>Payment Details</h2>

              {selectedAddress && (
                <div className="shipping-summary">
                  <p className="ship-label">Shipping to</p>
                  <p><strong>{selectedAddress.full_name}</strong></p>
                  <p>{selectedAddress.line1}, {selectedAddress.city}, {selectedAddress.country}</p>
                </div>
              )}

              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#aa3bff',
                      colorBackground: '#ffffff',
                      colorText: '#1a1a2e',
                      colorDanger: '#dc3545',
                      fontFamily: '"DM Sans", system-ui, sans-serif',
                      borderRadius: '10px',
                      spacingUnit: '5px',
                    },
                  },
                }}
              >
                <PaymentForm
                  amount={intentAmount}
                  onSuccess={handlePaymentSuccess}
                />
              </Elements>
            </section>
          )}
        </div>

        {/* ── Right column – order summary ──────────────────────────────── */}
        <aside className="order-summary">
          <h2>Order Summary</h2>
          <ul className="summary-items">
            {cart.map((item) => (
              <li key={item.id} className="summary-item">
                <div className="summary-item-info">
                  <span className="summary-item-qty">{item.quantity}×</span>
                  <span className="summary-item-name">{item.name}</span>
                </div>
                <span className="summary-item-price">
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
          <div className="summary-divider" />
          <div className="summary-total">
            <span>Total</span>
            <strong>${total.toFixed(2)}</strong>
          </div>
          <p className="summary-note">
            Taxes and shipping included · All prices in USD
          </p>
        </aside>
      </div>
    </div>
  );
}