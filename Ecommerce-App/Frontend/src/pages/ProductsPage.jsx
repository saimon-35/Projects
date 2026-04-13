import { useEffect, useState } from 'react';
import ProductCard from '../components/ProductCard';
import { getProducts } from '../api.js';
import './ProductsPage.css';

export default function ProductsPage() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getProducts();
        if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load products');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="products-page">
      <h1>Products</h1>
      {!import.meta.env.VITE_API_URL && (
        <p className="env-warn">
          Set <code>VITE_API_URL</code> in <code>.env.development</code> (e.g.{' '}
          <code>http://127.0.0.1:5000</code>) and restart Vite.
        </p>
      )}
      {loading && <p>Loading…</p>}
      {error && (
        <p role="alert">
          Error: {error}
        </p>
      )}
      {!loading && !error && (
        <ul className="product-grid">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </ul>
      )}
    </div>
  );
}
