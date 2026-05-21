const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('token');
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export function getProducts(searchParams = {}) {
  const { search, minPrice, maxPrice } = searchParams;
  let url = '/api/products';
  
  const queryParams = [];
  if (search) queryParams.push(`search=${encodeURIComponent(search)}`);
  if (minPrice !== undefined) queryParams.push(`min_price=${minPrice}`);
  if (maxPrice !== undefined) queryParams.push(`max_price=${maxPrice}`);
  
  if (queryParams.length > 0) {
    url += '?' + queryParams.join('&');
  }
  
  return request(url);
}

export function searchProducts(params = {}) {
  const {
    q = '',
    category = 'all',
    sort = 'relevance',
    page = 1,
    perPage = 12,
  } = params;

  const queryParams = new URLSearchParams();
  if (q) queryParams.set('q', q);
  queryParams.set('category', category || 'all');
  queryParams.set('sort', sort || 'relevance');
  queryParams.set('page', String(page || 1));
  queryParams.set('per_page', String(perPage || 12));

  return request(`/api/products/search?${queryParams.toString()}`);
}

export function getProduct(id) {
  return request(`/api/products/${id}`);
}

export function createProduct(payload) {
  return request('/api/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateProduct(id, payload) {
  return request(`/api/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export function deleteProduct(id) {
  return request(`/api/products/${id}`, {
    method: 'DELETE',
  });
}

export function getAdminDashboard() {
  return request('/api/admin/dashboard');
}

export function getProfile() {
  return request('/api/profile');
}

export function createAddress(payload) {
  return request('/api/profile/addresses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function deleteAddress(id) {
  return request(`/api/profile/addresses/${id}`, {
    method: 'DELETE',
  });
}

export function addToWishlist(productId) {
  return request('/api/profile/wishlist', {
    method: 'POST',
    body: JSON.stringify({ product_id: productId }),
  });
}

export function removeFromWishlist(productId) {
  return request(`/api/profile/wishlist/${productId}`, {
    method: 'DELETE',
  });
}

// ─── Legacy direct-order (kept for non-payment flows) ────────────────────────
export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Upload a product image (multipart/form-data).
 * Returns { url, filename }
 */
export function uploadProductImage(file) {
  const token = localStorage.getItem('token');
  const formData = new FormData();
  formData.append('image', file);

  return fetch(apiUrl('/api/upload/product-image'), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      // Do NOT set Content-Type here – browser sets it with the boundary
    },
    body: formData,
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      return data;
    });
}

// ─── Stripe payment flow ──────────────────────────────────────────────────────

/**
 * Ask the backend to create a Stripe PaymentIntent.
 * Returns { clientSecret, amount, currency }
 */
export function createPaymentIntent(payload) {
  return request('/api/payments/create-intent', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * After Stripe confirms payment on the client, tell the backend to
 * create the Order record and return it.
 * Returns { order, message }
 */
export function confirmOrder(paymentIntentId) {
  return request('/api/payments/confirm-order', {
    method: 'POST',
    body: JSON.stringify({ payment_intent_id: paymentIntentId }),
  });
}
