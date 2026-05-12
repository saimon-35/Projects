const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export function apiUrl(path) {
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

async function request(path, options = {}) {
  // Get token from localStorage
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
    // If we get a 401 Unauthorized, remove the token
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

export function createOrder(payload) {
  return request('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
