const API_BASE = '/api';

async function apiRequest(method, endpoint, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${endpoint}`, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'API Error');
  return data;
}

const API = {
  // Products
  getProducts: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest('GET', `/products${q ? '?' + q : ''}`);
  },
  getProduct: (id) => apiRequest('GET', `/products/${id}`),
  getProductByBarcode: (barcode) => apiRequest('GET', `/products/barcode/${encodeURIComponent(barcode)}`),
  getLowStock: (threshold = 5) => apiRequest('GET', `/products/low-stock?threshold=${threshold}`),
  createProduct: (data) => apiRequest('POST', '/products', data),
  updateProduct: (id, data) => apiRequest('PUT', `/products/${id}`, data),
  updateStock: (id, stock) => apiRequest('PATCH', `/products/${id}/stock`, { stock }),
  deleteProduct: (id) => apiRequest('DELETE', `/products/${id}`),

  // Customers
  getCustomers: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest('GET', `/customers${q ? '?' + q : ''}`);
  },
  getCustomer: (id) => apiRequest('GET', `/customers/${id}`),
  getCustomerOrders: (id) => apiRequest('GET', `/customers/${id}/orders`),
  createCustomer: (data) => apiRequest('POST', '/customers', data),
  updateCustomer: (id, data) => apiRequest('PUT', `/customers/${id}`, data),
  deleteCustomer: (id) => apiRequest('DELETE', `/customers/${id}`),

  // Orders
  getOrders: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest('GET', `/orders${q ? '?' + q : ''}`);
  },
  getOrder: (id) => apiRequest('GET', `/orders/${id}`),
  createOrder: (data) => apiRequest('POST', '/orders', data),
  deleteOrder: (id) => apiRequest('DELETE', `/orders/${id}`),

  // Settings
  getSettings: () => apiRequest('GET', '/settings'),
  updateSettings: (data) => apiRequest('PUT', '/settings', data),

  // Reports
  getSalesReport: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest('GET', `/reports/sales${q ? '?' + q : ''}`);
  },
  getStockValue: () => apiRequest('GET', '/reports/stock-value'),
  getPriceHistory: (id) => apiRequest('GET', `/reports/price-history/${id}`),

  // Purchases
  getPurchases: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return apiRequest('GET', `/purchases${q ? '?' + q : ''}`);
  },
  createPurchase: (data) => apiRequest('POST', '/purchases', data),

  // Returns
  returnItems: (orderId, items) => apiRequest('POST', `/orders/${orderId}/return`, { items }),

  // Categories
  getCategories: () => apiRequest('GET', '/categories'),
  createCategory: (d) => apiRequest('POST', '/categories', d),
  updateCategory: (id, d) => apiRequest('PUT', `/categories/${id}`, d),
  deleteCategory: (id) => apiRequest('DELETE', `/categories/${id}`),

  // Backup
  exportBackup: () => apiRequest('GET', '/backup/export'),
  getStats: () => apiRequest('POST', '/backup/stats'),

  // Bulk
  bulkUpdate: (data) => apiRequest('POST', '/products/bulk-update', data),
  getNearExpiry: (days) => apiRequest('GET', `/products/near-expiry?days=${days}`),
  getLowStockByMin: () => apiRequest('GET', '/products/low-stock-by-min'),
};
