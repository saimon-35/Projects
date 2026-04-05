import { useEffect, useState } from "react";
import { apiUrl } from "./api.js";
import "./App.css";

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(apiUrl("/api/products"));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setProducts(Array.isArray(data.products) ? data.products : []);
      } catch (e) {
        if (!cancelled) setError(e?.message || "Failed to load products");
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
    <main className="products-page">
      <h1>Products</h1>
      {!import.meta.env.VITE_API_URL && (
        <p className="env-warn">
          Set <code>VITE_API_URL</code> in <code>.env.development</code> (e.g.{" "}
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
            <li key={p.id} className="product-card">
              <h2>{p.name}</h2>
              <p className="price">${Number(p.price).toFixed(2)}</p>
              {p.description ? <p className="desc">{p.description}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}