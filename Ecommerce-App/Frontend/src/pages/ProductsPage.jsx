import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { addToWishlist, getProducts, getProfile, removeFromWishlist } from '../api.js';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/cart.js';
import './ProductsPage.css';

const CATEGORIES = ['All', 'Audio', 'Cables', 'Keyboards', 'Accessories'];

export default function ProductsPage() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wishlistIds, setWishlistIds] = useState([]);
  const [wishlistBusyId, setWishlistBusyId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [searchFocused, setSearchFocused] = useState(false);

  const heroRef = useRef(null);
  const gridRef = useRef(null);

  // Parallax on hero
  useEffect(() => {
    const handleScroll = () => {
      if (!heroRef.current) return;
      const y = window.scrollY;
      heroRef.current.style.setProperty('--parallax-y', `${y * 0.35}px`);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection observer for grid reveal
  useEffect(() => {
    if (!gridRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.08 }
    );
    const cards = gridRef.current.querySelectorAll('.product-card');
    cards.forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [products]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const params = {};
        if (searchTerm) params.search = searchTerm;
        if (minPrice !== '') params.minPrice = parseFloat(minPrice);
        if (maxPrice !== '') params.maxPrice = parseFloat(maxPrice);
        const data = await getProducts(params);
        if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [searchTerm, minPrice, maxPrice]);

  useEffect(() => {
    let cancelled = false;
    async function loadWishlist() {
      if (!user) { setWishlistIds([]); return; }
      try {
        const data = await getProfile();
        if (!cancelled) {
          setWishlistIds(
            (data.wishlist || []).map((item) => item.product?.id).filter(Boolean)
          );
        }
      } catch {
        if (!cancelled) setWishlistIds([]);
      }
    }
    loadWishlist();
    return () => { cancelled = true; };
  }, [user]);

  const handleToggleWishlist = async (productId, isWishlisted) => {
    setWishlistBusyId(productId);
    try {
      if (isWishlisted) {
        await removeFromWishlist(productId);
        setWishlistIds((c) => c.filter((id) => id !== productId));
      } else {
        await addToWishlist(productId);
        setWishlistIds((c) => (c.includes(productId) ? c : [...c, productId]));
      }
    } catch (e) {
      setError(e?.message || 'Failed to update wishlist');
    } finally {
      setWishlistBusyId(null);
    }
  };

  const resetFilters = () => {
    setSearchTerm('');
    setMinPrice('');
    setMaxPrice('');
    setActiveCategory('All');
    setSortBy('default');
  };

  // Sort products
  const getSorted = (list) => {
    const copy = [...list];
    if (sortBy === 'price-asc') return copy.sort((a, b) => a.price - b.price);
    if (sortBy === 'price-desc') return copy.sort((a, b) => b.price - a.price);
    if (sortBy === 'name') return copy.sort((a, b) => a.name.localeCompare(b.name));
    return copy;
  };

  const displayProducts = getSorted(products);
  const hasFilters = searchTerm || minPrice || maxPrice || activeCategory !== 'All' || sortBy !== 'default';

  const scrollToGrid = () => {
    gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="products-page">

      {/* ── HERO ──────────────────────────────────────────────────────── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-bg">
          <div className="hero-orb hero-orb-1" />
          <div className="hero-orb hero-orb-2" />
          <div className="hero-orb hero-orb-3" />
          <div className="hero-grid-lines" />
        </div>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="eyebrow-dot" />
            New Collection · 2025
          </div>
          <h1 className="hero-title">
            <span className="hero-title-line">Gear That</span>
            <span className="hero-title-line hero-title-accent">Performs.</span>
          </h1>
          <p className="hero-subtitle">
            Premium tech accessories engineered for those who demand the best.
            From studio-grade audio to mechanical precision.
          </p>
          <div className="hero-ctas">
            <button className="cta-primary" onClick={scrollToGrid}>
              Shop Collection
              <span className="cta-arrow">→</span>
            </button>
            {!user && (
              <button className="cta-ghost" onClick={() => navigate('/register')}>
                Join for Perks
              </button>
            )}
          </div>
          <div className="hero-stats">
            <div className="stat">
              <strong>500+</strong>
              <span>Products</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <strong>50k+</strong>
              <span>Customers</span>
            </div>
            <div className="stat-divider" />
            <div className="stat">
              <strong>4.9★</strong>
              <span>Rating</span>
            </div>
          </div>
        </div>

        <div className="hero-scroll-hint" onClick={scrollToGrid}>
          <div className="scroll-mouse">
            <div className="scroll-wheel" />
          </div>
          <span>Scroll</span>
        </div>
      </section>

      {/* ── TRUST BAR ─────────────────────────────────────────────────── */}
      <div className="trust-bar">
        {[
          { icon: '🚚', text: 'Free shipping over $50' },
          { icon: '↩', text: '30-day returns' },
          { icon: '🔒', text: 'Secure checkout' },
          { icon: '🎧', text: '24/7 support' },
        ].map((item) => (
          <div key={item.text} className="trust-item">
            <span className="trust-icon">{item.icon}</span>
            <span>{item.text}</span>
          </div>
        ))}
      </div>

      {/* ── CATEGORY PILLS ────────────────────────────────────────────── */}
      <section className="categories-section">
        <div className="section-header">
          <h2 className="section-title">Browse by Category</h2>
          <div className="section-line" />
        </div>
        <div className="category-pills">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              className={`category-pill ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>
      </section>

      {/* ── SEARCH + FILTERS ──────────────────────────────────────────── */}
      <section className="filters-section">
        <div className="search-bar-wrap">
          <div className={`search-bar ${searchFocused ? 'focused' : ''}`}>
            <span className="search-icon">⌕</span>
            <input
              type="text"
              placeholder="Search products…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="search-input"
            />
            {searchTerm && (
              <button className="search-clear" onClick={() => setSearchTerm('')}>✕</button>
            )}
          </div>
        </div>

        <div className="filter-row">
          <div className="price-filters">
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                min="0"
                className="price-input"
              />
            </div>
            <span className="price-sep">—</span>
            <div className="price-input-wrap">
              <span className="price-prefix">$</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
                className="price-input"
              />
            </div>
          </div>

          <select
            className="sort-select"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="default">Sort: Featured</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
            <option value="name">Name: A → Z</option>
          </select>

          {hasFilters && (
            <button className="reset-btn" onClick={resetFilters}>
              ✕ Clear all
            </button>
          )}
        </div>
      </section>

      {/* ── PRODUCTS GRID ─────────────────────────────────────────────── */}
      <section className="grid-section" ref={gridRef}>
        <div className="grid-header">
          {!loading && !error && (
            <p className="results-label">
              {displayProducts.length === 0
                ? 'No products found'
                : `${displayProducts.length} product${displayProducts.length !== 1 ? 's' : ''}`}
            </p>
          )}
        </div>

        {!import.meta.env.VITE_API_URL && (
          <div className="env-warn">
            Set <code>VITE_API_URL</code> in <code>.env.development</code> and restart Vite.
          </div>
        )}

        {loading && (
          <div className="loading-grid">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-img" />
                <div className="skeleton-line" style={{ width: '70%' }} />
                <div className="skeleton-line" style={{ width: '40%' }} />
                <div className="skeleton-line" style={{ width: '55%' }} />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="error-state">
            <span className="error-icon-lg">⚠</span>
            <p>{error}</p>
            <button className="retry-btn" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}

        {!loading && !error && displayProducts.length === 0 && (
          <div className="empty-state">
            <span className="empty-icon">🔍</span>
            <h3>No products match your search</h3>
            <p>Try adjusting your filters or browse all products.</p>
            <button className="cta-primary small" onClick={resetFilters}>
              Clear filters
            </button>
          </div>
        )}

        {!loading && !error && displayProducts.length > 0 && (
          <ul className="product-grid">
            {displayProducts.map((p, i) => (
              <li
                key={p.id}
                className="product-card-wrapper"
                style={{ '--stagger': i }}
              >
                <ProductCard
                  product={p}
                  isWishlisted={wishlistIds.includes(p.id)}
                  onToggleWishlist={user ? handleToggleWishlist : undefined}
                  wishlistBusy={wishlistBusyId === p.id}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── NEWSLETTER BANNER ─────────────────────────────────────────── */}
      <section className="newsletter-section">
        <div className="newsletter-inner">
          <div className="newsletter-text">
            <h2>Stay in the loop.</h2>
            <p>Get early access to drops, deals, and new arrivals.</p>
          </div>
          <div className="newsletter-form">
            <input type="email" placeholder="your@email.com" className="newsletter-input" />
            <button className="newsletter-btn">Subscribe</button>
          </div>
        </div>
      </section>

    </div>
  );
}