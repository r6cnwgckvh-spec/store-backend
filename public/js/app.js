// ======= STATE =======
let state = {
  cart: [],
  customer: { id: null, name: '', phone: '' },
  customers_cache: [],
};
let currentPage = 'home';

// ======= HELPERS =======
function $(id) { return document.getElementById(id); }
function formatCurrency(n) {
  const sym = (cachedSettings && cachedSettings.currency_symbol) || '\u20B9';
  return sym + Number(n).toFixed(2);
}
function formatDate(d) {
  return new Date(d).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function stockStatus(stock) {
  if (stock <= 0) return { label: 'Out of Stock', cls: 'stock-out' };
  if (stock <= 5) return { label: 'Low Stock', cls: 'stock-low' };
  return { label: 'In Stock', cls: 'stock-in' };
}
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function showToast(msg, duration = 2500) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}
function goBack() {
  window.history.back();
}
function toggleMenu() {
  $('sideMenu').classList.toggle('hidden');
  $('menuOverlay').classList.toggle('hidden');
}
function hideMenu() {
  $('sideMenu').classList.add('hidden');
  $('menuOverlay').classList.add('hidden');
}
function updateCartBadge() {
  const badge = $('cartBadge');
  if (!badge) return;
  const count = state.cart.reduce((s, i) => s + i.quantity, 0);
  if (count > 0) {
    badge.textContent = count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

// ======= ROUTING =======
function navigate(page) {
  window.location.hash = '#' + page;
}

window.addEventListener('hashchange', handleRoute);
window.addEventListener('load', () => {
  if (!window.location.hash) {
    window.location.hash = '#home';
  } else {
    handleRoute();
  }
});

function handleRoute() {
  const hash = window.location.hash.slice(1) || 'home';
  currentPage = hash;

  const qmark = hash.indexOf('?');
  const pathOnly = qmark >= 0 ? hash.slice(0, qmark) : hash;
  const queryStr = qmark >= 0 ? hash.slice(qmark + 1) : '';

  const parts = pathOnly.split('/');
  const base = parts[0];
  const id = parts[1];

  // Store query params for screens to use
  window._routeQuery = queryStr;

  // Show/hide back button
  const backBtn = $('backBtn');
  backBtn.style.display = (base !== 'home' && hash !== 'home') ? 'block' : 'none';

  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === base);
  });

  // Update title
  const titles = {
    home: 'Dashboard', products: 'Products', cart: 'Cart & Billing',
    orders: 'Order History', customers: 'Customers', scan: 'Scan Barcode',
    settings: 'Store Settings', reports: 'Sales Reports', purchases: 'Stock In',
    categories: 'Categories', backup: 'Backup & Restore',
  };
  const pageTitle = hash.includes('add') ? 'Add New' :
    hash.includes('edit') ? 'Edit Product' :
    base === 'products' && id ? 'Product Details' :
    base === 'customers' && id ? 'Customer Details' :
    base === 'orders' && id ? 'Order Details' :
    titles[base] || 'Store Manager';
  $('pageTitle').textContent = pageTitle;

  // Render
  const main = $('main');
  if (base === 'home') renderHome(main);
  else if (base === 'products') {
    if (!id) renderProducts(main);
    else if (id === 'add' || id === 'edit') renderProductForm(main, id);
    else renderProductDetail(main, id);
  } else if (base === 'scan') { navigate('home'); openScanner('add'); }
  else if (base === 'cart') renderCart(main);
  else if (base === 'orders') {
    if (!id) renderOrders(main);
    else renderOrderDetail(main, id);
  } else if (base === 'customers') {
    if (!id) renderCustomers(main);
    else if (id === 'add') renderCustomerForm(main);
    else renderCustomerDetail(main, id);
  } else if (base === 'settings') {
    renderSettings(main);
  } else if (base === 'reports') {
    renderReports(main);
  } else if (base === 'purchases') {
    if (!id) renderPurchases(main);
    else renderPurchaseForm(main);
  } else if (base === 'categories') {
    renderCategories(main);
  } else if (base === 'backup') {
    renderBackup(main);
  } else {
    renderHome(main);
  }
}

// ======= HOME =======
async function renderHome(el) {
  el.innerHTML = '<div class="empty-state"><div class="icon">&#128476;</div><h3>Loading...</h3></div>';

  try {
    const [products, lowStock, orders] = await Promise.all([
      API.getProducts({}),
      API.getLowStock(10),
      API.getOrders({ limit: 5 }),
    ]);

    const inStock = products.filter(p => p.stock > 0 && p.stock > 5).length;
    const low = products.filter(p => p.stock > 0 && p.stock <= 5).length;
    const out = products.filter(p => p.stock <= 0).length;

    el.innerHTML = `
      <div class="stats-row">
        <div class="stat-card" style="border-left-color:#007bff">
          <div class="value" style="color:#007bff">${products.length}</div>
          <div class="label">Products</div>
        </div>
        <div class="stat-card" style="border-left-color:#ffc107">
          <div class="value" style="color:#ffc107">${low}</div>
          <div class="label">Low Stock</div>
        </div>
        <div class="stat-card" style="border-left-color:#dc3545">
          <div class="value" style="color:#dc3545">${out}</div>
          <div class="label">Out of Stock</div>
        </div>
      </div>

      <div class="quick-actions">
        <button class="action-btn" onclick="openScanner('add')">
          <span class="icon">&#128247;</span> Scan &amp; Add
        </button>
        <button class="action-btn" onclick="openScanner('sell')">
          <span class="icon">&#128722;</span> Scan &amp; Sell
        </button>
        <button class="action-btn" onclick="navigate('products')">
          <span class="icon">&#128230;</span> Inventory
        </button>
        <button class="action-btn" onclick="navigate('orders')">
          <span class="icon">&#128203;</span> Orders
        </button>
      </div>

      ${lowStock.length > 0 ? `
        <div class="section-title">&#9888; Low Stock Alerts</div>
        ${lowStock.map(p => `
          <div class="product-item" onclick="navigate('products/${p.id}')">
            <div class="product-info">
              <div class="name">${escapeHtml(p.name)}</div>
              <div class="barcode">${escapeHtml(p.barcode)}</div>
            </div>
            <div class="product-right">
              <span class="stock-badge ${stockStatus(p.stock).cls}">${p.stock} left</span>
            </div>
          </div>
        `).join('')}
      ` : ''}

      <div class="section-title">&#128195; Recent Orders</div>
      ${orders.length === 0 ? '<div class="empty-state"><p>No orders yet</p></div>' :
        orders.map(o => `
          <div class="order-item" onclick="navigate('orders/${o.id}')">
            <div class="order-header">
              <span class="order-id">Order #${o.id}</span>
            </div>
            <div class="order-customer">${escapeHtml(o.customer_name || 'Walk-in Customer')}</div>
            <div class="order-date">${formatDate(o.created_at)}</div>
            <div class="order-footer">
              <span class="items-count">${o.items_count} items</span>
              <span class="amount">${formatCurrency(o.total_amount)}</span>
            </div>
          </div>
        `).join('')
      }
    `;
  } catch (e) {
    el.innerHTML = `<div class="empty-state"><div class="icon">&#9888;</div><h3>Could not connect</h3><p>Make sure the server is running</p></div>`;
  }
}

// ======= PRODUCTS =======
async function renderProducts(el) {
  el.innerHTML = `
    <div class="search-bar">
      <input class="form-control" id="productSearch" placeholder="Search by name or barcode..." oninput="searchProducts()">
    </div>
    <button class="btn btn-primary btn-block" onclick="navigate('products/add')" style="margin-bottom:12px">
      &#10133; Add Product
    </button>
    <button class="btn btn-secondary btn-block" onclick="openScanner('add')" style="margin-bottom:16px">
      &#128247; Scan Barcode to Add
    </button>
    <div id="productList"></div>
  `;
  await searchProducts();
}

window.searchProducts = async function() {
  const el = $('productList');
  const search = $('productSearch')?.value || '';
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

  try {
    const products = await API.getProducts({ search });
    if (products.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="icon">&#128230;</div><h3>No products found</h3><p>Scan a barcode to add your first product</p></div>';
      return;
    }
    el.innerHTML = products.map(p => {
      const st = stockStatus(p.stock);
      return `
        <div class="product-item" onclick="navigate('products/${p.id}')">
          <div class="product-info">
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="barcode">${escapeHtml(p.barcode)}</div>
            ${p.category ? `<div class="category">${escapeHtml(p.category)}</div>` : ''}
          </div>
          <div class="product-right">
            <div class="price">${formatCurrency(p.price)}</div>
            <span class="stock-badge ${st.cls}">${p.stock}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Error loading products</h3></div>';
  }
}

// ======= PRODUCT FORM =======
async function renderProductForm(el, mode) {
  const isEdit = mode === 'edit';
  const params = new URLSearchParams(window._routeQuery || '');
  const barcode = params.get('barcode') || '';
  let product = null;

  if (isEdit) {
    const editId = params.get('id');
    if (editId) {
      try {
        product = await API.getProduct(parseInt(editId));
      } catch (e) {
        showToast('Product not found');
        navigate('products');
        return;
      }
    }
  }

  el.innerHTML = `
    <div class="card">
      ${isEdit ? '<h3 style="margin-bottom:16px">Edit Product</h3>' : '<h3 style="margin-bottom:16px">Add New Product</h3>'}

      <button class="btn btn-secondary btn-block" onclick="openScanner('add')" style="margin-bottom:16px">
        &#128247; Scan Barcode
      </button>

      <div class="form-group">
        <label>Barcode / QR Code</label>
        <input class="form-control" id="fBarcode" value="${escapeHtml(barcode || (product ? product.barcode : ''))}" placeholder="Scan or type barcode">
      </div>
      <div class="form-group">
        <label>Product Name *</label>
        <input class="form-control" id="fName" value="${escapeHtml(product ? product.name : '')}" placeholder="Enter product name">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Cost Price / Strip</label>
          <input class="form-control" id="fCostPrice" value="${product ? (product.cost_price || '') : ''}" placeholder="0.00" type="number" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label>Selling Price / Strip *</label>
          <input class="form-control" id="fPrice" value="${product ? product.price : ''}" placeholder="0.00" type="number" step="0.01" min="0">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Tablets per Strip</label>
          <input class="form-control" id="fTabletsPerStrip" value="${product ? (product.tablets_per_strip || 1) : 1}" placeholder="1" type="number" min="1">
        </div>
        <div class="form-group">
          <label>Stock (strips)</label>
          <input class="form-control" id="fStock" value="${product ? Math.floor(product.stock / (product.tablets_per_strip || 1)) : ''}" placeholder="0" type="number" min="0">
        </div>
      </div>
      <div class="form-group">
        <label>Category</label>
        <input class="form-control" id="fCategory" value="${escapeHtml(product ? product.category : '')}" placeholder="e.g. Oil, Grain, Beverage">
      </div>
      <div class="form-group">
        <label>Size / Weight</label>
        <input class="form-control" id="fSize" value="${escapeHtml(product ? product.size : '')}" placeholder="e.g. 1L, 500g">
      </div>
      <div class="form-group">
        <label>Description</label>
        <textarea class="form-control" id="fDescription" placeholder="Optional notes">${escapeHtml(product ? product.description : '')}</textarea>
      </div>

      <button class="btn btn-success btn-block" onclick="saveProduct()">
        ${isEdit ? 'Update Product' : 'Add to Inventory'}
      </button>
      ${isEdit && product ? '<button class="btn btn-danger btn-block" style="margin-top:8px" onclick="deleteProduct(' + product.id + ')">Delete Product</button>' : ''}
    </div>
  `;
}

window.saveProduct = async function() {
  const tps = parseInt($('fTabletsPerStrip').value) || 1;
  const data = {
    barcode: $('fBarcode').value.trim(),
    name: $('fName').value.trim(),
    price: parseFloat($('fPrice').value) || 0,
    cost_price: parseFloat($('fCostPrice').value) || 0,
    tablets_per_strip: tps,
    stock: (parseInt($('fStock').value) || 0) * tps,
    category: $('fCategory').value.trim(),
    size: $('fSize').value.trim(),
    description: $('fDescription').value.trim(),
  };

  if (!data.barcode) return showToast('Please scan or enter a barcode');
  if (!data.name) return showToast('Product name is required');
  if (data.price <= 0) return showToast('Enter a valid selling price');

  const params2 = new URLSearchParams(window._routeQuery || '');
  const productId = parseInt(params2.get('id'));

  try {
    if (productId) {
      await API.updateProduct(productId, data);
      showToast('Product updated!');
    } else {
      await API.createProduct(data);
      showToast('Product added to inventory!');
    }
    navigate('products');
  } catch (e) {
    if (e.message && e.message.includes('already exists')) {
      if (confirm('This barcode already exists. Go to that product?')) {
        navigate(`products?barcode=${encodeURIComponent(data.barcode)}`);
      }
    } else {
      showToast(e.message || 'Error saving product');
    }
  }
}

window.deleteProduct = async function(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await API.deleteProduct(id);
    showToast('Product deleted');
    navigate('products');
  } catch (e) {
    showToast('Error deleting product');
  }
}

// ======= PRODUCT DETAIL =======
async function renderProductDetail(el, id) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const p = await API.getProduct(parseInt(id));
    const st = stockStatus(p.stock);

    el.innerHTML = `
      <div class="detail-card" style="text-align:center">
        <h2 style="margin-bottom:4px">${escapeHtml(p.name)}</h2>
        <p style="color:var(--muted);font-size:13px">${escapeHtml(p.barcode)}</p>
        <div style="margin-top:8px">
          <span class="stock-badge ${st.cls}" style="font-size:14px;padding:4px 16px">${st.label}</span>
        </div>
      </div>

      <div class="detail-card">
        <div class="detail-row"><span class="label">Selling Price</span><span class="value" style="color:var(--success);font-size:18px">${formatCurrency(p.price)}/strip</span></div>
        <div class="detail-row"><span class="label">Cost Price</span><span class="value" style="color:var(--danger)">${formatCurrency(p.cost_price || 0)}/strip</span></div>
        <div class="detail-row"><span class="label">Profit / Strip</span><span class="value" style="color:var(--primary)">${formatCurrency(p.price - (p.cost_price || 0))}</span></div>
        ${p.tablets_per_strip > 1 ? `
        <div class="detail-row"><span class="label">Pack Size</span><span class="value">${p.tablets_per_strip} tablets/strip</span></div>
        <div class="detail-row"><span class="label">Per Tablet</span><span class="value" style="color:var(--danger)">${formatCurrency(p.price / p.tablets_per_strip)}</span></div>
        <div class="detail-row"><span class="label">Stock</span><span class="value">${Math.floor(p.stock / p.tablets_per_strip)} strips + ${p.stock % p.tablets_per_strip} tablets</span></div>
        ` : `
        <div class="detail-row"><span class="label">Stock</span><span class="value">${p.stock} units</span></div>
        `}
        <div class="detail-row"><span class="label">Category</span><span class="value">${escapeHtml(p.category || '\u2014')}</span></div>
        <div class="detail-row"><span class="label">Size</span><span class="value">${escapeHtml(p.size || '\u2014')}</span></div>
        <div class="detail-row"><span class="label">Description</span><span class="value">${escapeHtml(p.description || '\u2014')}</span></div>
        <div class="detail-row"><span class="label">Added</span><span class="value">${formatDate(p.created_at)}</span></div>
      </div>

      <div class="btn-group" style="margin-bottom:12px">
        <button class="btn btn-primary" onclick="navigate('products/edit?id=${p.id}')">&#9998; Edit</button>
        <button class="btn btn-danger" onclick="deleteProduct(${p.id})">&#128465; Delete</button>
      </div>
      <button class="btn btn-success btn-block" onclick="addToCart(${p.id}, '${escapeHtml(p.name)}', ${p.price}, '${escapeHtml(p.barcode)}')">
        &#128722; Add to Cart &amp; Sell
      </button>
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Product not found</h3></div>';
  }
}

// ======= SETTINGS =======
let cachedSettings = null;

async function getStoreSettings() {
  if (cachedSettings) return cachedSettings;
  try {
    cachedSettings = await API.getSettings();
    return cachedSettings;
  } catch (e) {
    return { store_name: 'Your Store Name', address: '123 Main Street, City', phone: '+91 98765 43210', email: '', tax_id: '' };
  }
}

async function renderSettings(el) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const s = await getStoreSettings();
    el.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:16px">&#9881; Store Settings</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:16px">These details will appear on all bills and invoices.</p>

        <div class="form-group">
          <label>Store Name</label>
          <input class="form-control" id="sName" value="${escapeHtml(s.store_name)}" placeholder="Your store name">
        </div>
        <div class="form-group">
          <label>Address</label>
          <textarea class="form-control" id="sAddress" placeholder="Store address">${escapeHtml(s.address)}</textarea>
        </div>
        <div class="form-group">
          <label>Phone Number</label>
          <input class="form-control" id="sPhone" value="${escapeHtml(s.phone)}" placeholder="Phone number" type="tel">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" id="sEmail" value="${escapeHtml(s.email)}" placeholder="Email address" type="email">
        </div>
        <div class="form-group">
          <label>Tax ID / GST Number</label>
          <input class="form-control" id="sTaxId" value="${escapeHtml(s.tax_id)}" placeholder="Tax ID (optional)">
        </div>
        <div class="form-row">
          <div class="form-group">
            <label>Currency Symbol</label>
            <input class="form-control" id="sCurrency" value="${escapeHtml(s.currency_symbol || '\u20B9')}" placeholder="${'\u20B9'}" style="max-width:80px">
          </div>
          <div class="form-group">
            <label>Currency Code</label>
            <input class="form-control" id="sCurrencyCode" value="${escapeHtml(s.currency_code || 'INR')}" placeholder="INR">
          </div>
        </div>

        <button class="btn btn-success btn-block" onclick="saveSettings()">Save Settings</button>
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Error loading settings</h3></div>';
  }
}

window.saveSettings = async function() {
  const data = {
    store_name: $('sName').value.trim(),
    address: $('sAddress').value.trim(),
    phone: $('sPhone').value.trim(),
    email: $('sEmail').value.trim(),
    tax_id: $('sTaxId').value.trim(),
    currency_symbol: $('sCurrency').value.trim() || '\u20B9',
    currency_code: $('sCurrencyCode').value.trim() || 'INR',
  };
  try {
    cachedSettings = await API.updateSettings(data);
    showToast('Settings saved!');
  } catch (e) {
    showToast('Error saving settings');
  }
};

// ======= DARK MODE =======
window.toggleDarkMode = function() {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
};
// Load dark mode preference
if (localStorage.getItem('darkMode') === 'true') {
  document.body.classList.add('dark-mode');
}

// ======= EXPORT =======
window.exportProductsCSV = async function() {
  try {
    const products = await API.getProducts({});
    let csv = 'Barcode,Name,Price,Stock,Category,Size\n';
    products.forEach(p => {
      csv += `"${p.barcode}","${p.name}",${p.price},${p.stock},"${p.category}","${p.size}"\n`;
    });
    downloadCSV(csv, 'products.csv');
    showToast('Products exported');
  } catch (e) { showToast('Export failed'); }
};

window.exportOrdersCSV = async function() {
  try {
    const orders = await API.getOrders({});
    let csv = 'Order ID,Customer,Items,Total,Payment,Date\n';
    orders.forEach(o => {
      csv += `${o.id},"${o.customer_name || 'Walk-in'}",${o.items_count},${o.total_amount},"${o.payment_method || 'Cash'}","${o.created_at}"\n`;
    });
    downloadCSV(csv, 'orders.csv');
    showToast('Orders exported');
  } catch (e) { showToast('Export failed'); }
};

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ======= REPORTS =======
async function renderReports(el) {
  el.innerHTML = '<div class="empty-state"><p>Loading reports...</p></div>';
  try {
    const [sales, stockVal] = await Promise.all([
      API.getSalesReport({ period: 'month' }),
      API.getStockValue(),
    ]);

    const s = sales.summary;

    el.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:16px">
        <button class="btn btn-sm btn-primary" onclick="loadReport('today')" style="flex:1">Today</button>
        <button class="btn btn-sm btn-primary" onclick="loadReport('week')" style="flex:1">Week</button>
        <button class="btn btn-sm btn-primary" onclick="loadReport('month')" style="flex:1">Month</button>
        <button class="btn btn-sm btn-primary" onclick="loadReport('year')" style="flex:1">Year</button>
      </div>

      <div class="stats-row">
        <div class="stat-card" style="border-left-color:#28a745">
          <div class="value" style="color:#28a745;font-size:22px">${s.order_count}</div>
          <div class="label">Orders</div>
        </div>
        <div class="stat-card" style="border-left-color:#007bff">
          <div class="value" style="color:#007bff;font-size:22px">${formatCurrency(s.total_revenue)}</div>
          <div class="label">Revenue</div>
        </div>
        <div class="stat-card" style="border-left-color:#ffc107">
          <div class="value" style="color:#ffc107;font-size:22px">${formatCurrency(s.total_discount)}</div>
          <div class="label">Discounts</div>
        </div>
      </div>

        <div class="stats-row" style="grid-template-columns:repeat(3,1fr)">
          <div class="stat-card" style="border-left-color:#17a2b8">
            <div class="value" style="color:#17a2b8;font-size:20px">${stockVal.totalProducts}</div>
            <div class="label">Total Products</div>
          </div>
          <div class="stat-card" style="border-left-color:#6f42c1">
            <div class="value" style="color:#6f42c1;font-size:20px">${formatCurrency(stockVal.stockValue)}</div>
            <div class="label">Stock Value</div>
          </div>
          <div class="stat-card" style="border-left-color:#e83e8c">
            <div class="value" id="profitDisplay" style="color:#e83e8c;font-size:20px">${sales.profitSummary ? formatCurrency(sales.profitSummary.total_profit) : '-'}</div>
            <div class="label">Profit</div>
          </div>
        </div>

        <div id="reportDetail">
        <div class="section-title">Top Products</div>
        ${sales.topProducts.length === 0 ? '<p style="color:var(--muted)">No data</p>' :
          sales.topProducts.map((p, i) => `
            <div class="product-item" style="cursor:default">
              <div class="product-info">
                <div class="name">${i+1}. ${escapeHtml(p.product_name)}</div>
                <div class="barcode">Sold: ${p.qty} units</div>
              </div>
              <div class="product-right" style="text-align:right">
                <div class="price">${formatCurrency(p.revenue)}</div>
                <div class="barcode" style="color:#e83e8c">Profit: ${formatCurrency(p.profit)}</div>
              </div>
            </div>
          `).join('')
        }

        <div class="section-title">Payment Methods</div>
        ${sales.paymentMethods.length === 0 ? '<p style="color:var(--muted)">No data</p>' :
          sales.paymentMethods.map(pm => `
            <div class="product-item" style="cursor:default">
              <div class="product-info">
                <div class="name">${escapeHtml(pm.payment_method)}</div>
                <div class="barcode">${pm.count} orders</div>
              </div>
              <div class="product-right">
                <div class="price" style="color:var(--accent)">${formatCurrency(pm.total)}</div>
              </div>
            </div>
          `).join('')
        }

        <div class="section-title">Daily Sales</div>
        ${sales.dailySales.length === 0 ? '<p style="color:var(--muted)">No data</p>' :
          sales.dailySales.map(d => `
            <div class="product-item" style="cursor:default">
              <div class="product-info">
                <div class="name">${d.date}</div>
                <div class="barcode">${d.orders} orders</div>
              </div>
              <div class="product-right">
                <div class="price">${formatCurrency(d.revenue)}</div>
              </div>
            </div>
          `).join('')
        }
      </div>
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Error loading reports</h3></div>';
  }
}

window.loadReport = async function(period) {
  const el = $('reportDetail');
  el.innerHTML = '<p>Loading...</p>';
  try {
    const sales = await API.getSalesReport({ period });
    const s = sales.summary;
    // Update summary stats
    const stats = el.closest('#main').querySelectorAll('.stat-value');
    if (stats.length >= 3) {
      stats[0].textContent = s.order_count;
      stats[1].textContent = formatCurrency(s.total_revenue);
      stats[2].textContent = formatCurrency(s.total_discount);
    }
    const profitEl = document.getElementById('profitDisplay');
    if (profitEl && sales.profitSummary) {
      profitEl.textContent = formatCurrency(sales.profitSummary.total_profit);
    }
    // Update top products with profit
    const profitItems = el.querySelectorAll('.product-right .barcode');
    const topProducts = sales.topProducts || [];
    profitItems.forEach((el2, idx) => {
      if (idx < topProducts.length && topProducts[idx].profit !== undefined) {
        el2.textContent = 'Profit: ' + formatCurrency(topProducts[idx].profit);
      }
    });
  } catch (e) { showToast('Error loading report'); }
};

// ======= PURCHASES =======
async function renderPurchases(el) {
  el.innerHTML = `
    <button class="btn btn-primary btn-block" onclick="navigate('purchases/add')" style="margin-bottom:12px">&#10133; Record Stock In</button>
    <div id="purchasesList"></div>
  `;
  await loadPurchasesList();
}

async function loadPurchasesList() {
  const el = $('purchasesList');
  if (!el) return;
  el.innerHTML = '<p>Loading...</p>';
  try {
    const purchases = await API.getPurchases({ limit: 50 });
    if (purchases.length === 0) {
      el.innerHTML = '<div class="empty-state"><p>No stock-in records yet</p></div>';
      return;
    }
    el.innerHTML = purchases.map(p => `
      <div class="product-item" style="cursor:default">
        <div class="product-info">
          <div class="name">${escapeHtml(p.product_name)}</div>
          <div class="barcode">+${p.quantity} units | ${escapeHtml(p.supplier || 'No supplier')}</div>
          <div class="barcode">${formatDate(p.created_at)}</div>
        </div>
        <div class="product-right">
          <div class="price" style="color:var(--accent)">${formatCurrency(p.cost_price * p.quantity)}</div>
        </div>
      </div>
    `).join('');
  } catch (e) { el.innerHTML = '<p>Error loading</p>'; }
}

function renderPurchaseForm(el) {
  el.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom:16px">Record Stock In</h3>
      <div class="form-group">
        <label>Select Product</label>
        <select class="form-control" id="pProductId"><option value="">Loading...</option></select>
      </div>
      <div class="form-group">
        <label>Current Stock</label>
        <p id="pCurrentStock" style="font-size:18px;font-weight:700;color:var(--success)">-</p>
      </div>
      <div class="form-group">
        <label>Quantity to Add *</label>
        <input class="form-control" id="pQuantity" type="number" min="1" placeholder="Enter quantity">
      </div>
      <div class="form-group">
        <label>Cost Price (per unit)</label>
        <input class="form-control" id="pCostPrice" type="number" step="0.01" min="0" placeholder="0.00">
      </div>
      <div class="form-group">
        <label>Supplier</label>
        <input class="form-control" id="pSupplier" placeholder="Supplier name">
      </div>
      <div class="form-group">
        <label>Notes</label>
        <textarea class="form-control" id="pNotes" placeholder="Optional notes"></textarea>
      </div>
      <button class="btn btn-success btn-block" onclick="submitPurchase()">Add Stock</button>
    </div>
  `;

  loadProductSelect();
}

async function loadProductSelect() {
  const select = $('pProductId');
  try {
    const products = await API.getProducts({});
    select.innerHTML = '<option value="">Select a product...</option>' +
      products.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (${escapeHtml(p.barcode)}) - Stock: ${p.stock}</option>`).join('');

    select.onchange = async function() {
      const pid = parseInt(this.value);
      if (pid) {
        try {
          const p = await API.getProduct(pid);
          $('pCurrentStock').textContent = p.stock + ' units';
        } catch (e) { $('pCurrentStock').textContent = '-'; }
      } else {
        $('pCurrentStock').textContent = '-';
      }
    };
  } catch (e) { select.innerHTML = '<option value="">Error loading products</option>'; }
}

window.submitPurchase = async function() {
  const product_id = parseInt($('pProductId').value);
  const quantity = parseInt($('pQuantity').value);
  const cost_price = parseFloat($('pCostPrice').value) || 0;
  const supplier = $('pSupplier').value.trim();
  const notes = $('pNotes').value.trim();

  if (!product_id) return showToast('Select a product');
  if (!quantity || quantity < 1) return showToast('Enter valid quantity');

  try {
    await API.createPurchase({ product_id, quantity, cost_price, supplier, notes });
    showToast('Stock added successfully!');
    navigate('purchases');
  } catch (e) { showToast(e.message || 'Error'); }
}

function renderCart(el) {
  el.innerHTML = `
    <button class="btn btn-primary btn-block" onclick="openScanner('sell')" style="margin-bottom:12px">
      &#128247; Scan Product to Add
    </button>

    <div class="card" style="padding:10px 14px;cursor:pointer" onclick="toggleCustomerSection()">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span>&#128100; <span id="customerDisplay">${state.customer.name || 'Add Customer (Optional)'}</span></span>
        <span id="customerArrow" style="color:var(--muted)">&#9660;</span>
      </div>
    </div>
    <div id="customerSection" class="hidden" style="margin-bottom:12px">
      <div class="card">
        <div class="form-group">
          <label>Customer Name</label>
          <input class="form-control" id="custName" value="${escapeHtml(state.customer.name)}" placeholder="Customer name">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input class="form-control" id="custPhone" value="${escapeHtml(state.customer.phone)}" placeholder="Phone number">
        </div>
        <div id="recentCustomers"></div>
        <button class="btn btn-sm btn-primary" onclick="saveCustomerInfo()" style="margin-top:4px">Save</button>
      </div>
    </div>

    <div id="cartItems">
      ${state.cart.length === 0 ? `
        <div class="empty-state">
          <div class="icon">&#128722;</div>
          <h3>Cart is empty</h3>
          <p>Scan products to add them here</p>
        </div>
      ` : state.cart.map(item => `
        <div class="cart-item">
          <div class="item-info">
            <div class="name">${escapeHtml(item.name)}</div>
            <div class="price">${formatCurrency(item.price)} each</div>
          </div>
          <div class="qty-control">
            <button onclick="updateCartQty(${item.id}, -1)">\u2212</button>
            <span class="qty">${item.quantity}</span>
            <button onclick="updateCartQty(${item.id}, 1)">+</button>
          </div>
          <div class="item-total">${formatCurrency(item.price * item.quantity)}</div>
          <button class="remove-btn" onclick="removeFromCart(${item.id})">&times;</button>
        </div>
      `).join('')}
    </div>

    ${state.cart.length > 0 ? `
      <div class="card" style="margin-top:8px">
        <div class="form-row" style="gap:8px;margin-bottom:12px">
          <div class="form-group">
            <label style="font-size:12px">Discount (\u20B9)</label>
            <input class="form-control" id="cartDiscount" type="number" min="0" step="0.01" value="0" placeholder="0" oninput="updateCartTotal()">
          </div>
          <div class="form-group">
            <label style="font-size:12px">Payment Mode</label>
            <select class="form-control" id="cartPayment">
              <option>Cash</option>
              <option>UPI</option>
              <option>Card</option>
              <option>Credit</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label style="font-size:12px">Notes</label>
          <input class="form-control" id="cartNotes" placeholder="Optional notes for this bill">
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="color:var(--muted)">Subtotal</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:12px;border-bottom:2px solid var(--primary)">
          <span style="font-weight:700">Total</span>
          <span id="cartGrandTotal" style="font-size:24px;font-weight:700;color:var(--success)">${formatCurrency(total)}</span>
        </div>
        <button class="btn btn-success btn-block" onclick="checkout()">&#128196; Generate Bill &amp; PDF</button>
      </div>
    ` : ''}
  `;
  updateCartTotal();
}

window.updateCartTotal = function() {
  const subtotal = state.cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const disc = parseFloat($('cartDiscount')?.value) || 0;
  const grand = Math.max(0, subtotal - disc);
  const el = $('cartGrandTotal');
  if (el) el.textContent = formatCurrency(grand);
};

window.toggleCustomerSection = function() {
  const section = $('customerSection');
  const arrow = $('customerArrow');
  if (section.classList.contains('hidden')) {
    section.classList.remove('hidden');
    arrow.textContent = '\u25B2';
  } else {
    section.classList.add('hidden');
    arrow.textContent = '\u25BC';
  }
};

window.saveCustomerInfo = function() {
  state.customer.name = $('custName').value.trim();
  state.customer.phone = $('custPhone').value.trim();
  $('customerDisplay').textContent = state.customer.name || 'Add Customer (Optional)';
  $('customerSection').classList.add('hidden');
  $('customerArrow').textContent = '\u25BC';
  showToast('Customer info saved');
};

async function loadRecentCustomers() {
  try {
    const customers = await API.getCustomers({});
    state.customers_cache = customers;
    const el = $('recentCustomers');
    if (!el || customers.length === 0) return;
    el.innerHTML = `
      <p style="font-size:12px;color:var(--muted);margin-bottom:6px">Recent Customers:</p>
      ${customers.slice(0, 5).map(c => `
        <div style="padding:8px;cursor:pointer;border-bottom:1px solid #f0f0f0" onclick="selectCustomer(${c.id},'${escapeHtml(c.name)}','${escapeHtml(c.phone || '')}')">
          <strong>${escapeHtml(c.name)}</strong> ${c.phone ? '- ' + escapeHtml(c.phone) : ''}
        </div>
      `).join('')}
    `;
  } catch (e) {}
}

window.selectCustomer = function(id, name, phone) {
  state.customer = { id, name, phone };
  if ($('custName')) $('custName').value = name;
  if ($('custPhone')) $('custPhone').value = phone;
  $('customerDisplay').textContent = name;
  $('customerSection').classList.add('hidden');
  $('customerArrow').textContent = '\u25BC';
};

window.addToCart = function(id, name, price, barcode) {
  const existing = state.cart.find(i => i.id === id);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.push({ id, name, price, barcode, quantity: 1 });
  }
  if (currentPage.startsWith('cart')) renderCart($('main'));
  navigate('cart');
  showToast(`Added ${name} to cart`);
};

window.addToCartByBarcode = async function(barcode) {
  try {
    const p = await API.getProductByBarcode(barcode);
    window.addToCart(p.id, p.name, p.price, p.barcode);
  } catch (e) {
    if (confirm('Product not found. Add it to inventory?')) {
      navigate(`products/add?barcode=${encodeURIComponent(barcode)}`);
    } else {
      showToast('Product not found');
    }
  }
};

window.updateCartQty = function(id, delta) {
  const item = state.cart.find(i => i.id === id);
  if (!item) return;
  item.quantity += delta;
  if (item.quantity <= 0) {
    state.cart = state.cart.filter(i => i.id !== id);
  }
  renderCart($('main'));
};

window.removeFromCart = function(id) {
  state.cart = state.cart.filter(i => i.id !== id);
  renderCart($('main'));
};

window.checkout = async function() {
  if (state.cart.length === 0) return showToast('Cart is empty');

  const discount = parseFloat($('cartDiscount')?.value) || 0;
  const subtotal = state.cart.reduce((s,i) => s + i.price * i.quantity, 0);
  const total = Math.max(0, subtotal - discount);

  if (!confirm(`Generate bill for ${formatCurrency(total)}?`)) return;

  try {
    let customerId = state.customer.id;

    if (state.customer.name && !state.customer.id) {
      const newC = await API.createCustomer({
        name: state.customer.name,
        phone: state.customer.phone,
      });
      customerId = newC.id;
      state.customer.id = customerId;
    }

    const order = await API.createOrder({
      customer_id: customerId,
      customer_name: state.customer.name || 'Walk-in Customer',
      customer_phone: state.customer.phone || '',
      items: state.cart.map(item => ({ product_id: item.id, quantity: item.quantity })),
      discount: discount,
      payment_method: $('cartPayment')?.value || 'Cash',
      notes: $('cartNotes')?.value || '',
    });

    state.cart = [];
    updateCartBadge();

    navigate(`orders/${order.id}`);
    showToast('Bill generated!');
  } catch (e) {
    showToast(e.message || 'Checkout failed');
  }
};

// ======= ORDERS =======
async function renderOrders(el) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const orders = await API.getOrders({});
    if (orders.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="icon">&#128203;</div><h3>No orders yet</h3><p>Orders will appear here after you generate bills</p></div>';
      return;
    }
    el.innerHTML = orders.map(o => `
      <div class="order-item" onclick="navigate('orders/${o.id}')">
        <div class="order-header">
          <span class="order-id">Order #${o.id}</span>
          <button class="delete-btn" onclick="event.stopPropagation();deleteOrder(${o.id})">&#128465;</button>
        </div>
        <div class="order-customer">${escapeHtml(o.customer_name || 'Walk-in Customer')}</div>
        <div class="order-date">${formatDate(o.created_at)}</div>
        <div class="order-footer">
          <span class="items-count">${o.items_count} items</span>
          <span class="amount">${formatCurrency(o.total_amount)}</span>
        </div>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Error loading orders</h3></div>';
  }
}

window.deleteOrder = async function(id) {
  if (!confirm(`Delete order #${id}? Stock will be restored.`)) return;
  try {
    await API.deleteOrder(id);
    showToast('Order deleted, stock restored');
    renderOrders($('main'));
  } catch (e) {
    showToast('Error deleting order');
  }
};

// ======= ORDER DETAIL =======
async function renderOrderDetail(el, id) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const [order, settings] = await Promise.all([
      API.getOrder(parseInt(id)),
      getStoreSettings(),
    ]);

    el.innerHTML = `
      <div class="bill-section">
        <div class="bill-header">
          <div class="store-name">${escapeHtml(settings.store_name)}</div>
          <div class="store-detail">${escapeHtml(settings.address)}</div>
          <div class="store-detail">Phone: ${escapeHtml(settings.phone)}</div>
          ${settings.email ? '<div class="store-detail">Email: ' + escapeHtml(settings.email) + '</div>' : ''}
          ${settings.tax_id ? '<div class="store-detail">' + escapeHtml(settings.tax_id) + '</div>' : ''}
        </div>
        <div class="bill-divider"></div>
        <div class="bill-title">TAX INVOICE / BILL</div>

        <div class="bill-info">
          <span><strong>Bill No:</strong> ${order.id}</span>
          <span><strong>Date:</strong> ${formatDate(order.created_at)}</span>
        </div>
        <div class="bill-info">
          <span><strong>Customer:</strong> ${escapeHtml(order.customer_name || 'Walk-in Customer')}</span>
          ${order.customer_phone ? `<span><strong>Phone:</strong> ${escapeHtml(order.customer_phone)}</span>` : ''}
        </div>
        <div class="bill-info">
          <span><strong>Payment:</strong> ${order.payment_method || 'Cash'}</span>
          ${order.discount > 0 ? `<span><strong>Discount:</strong> ${formatCurrency(order.discount)}</span>` : ''}
        </div>
        ${order.notes ? `<div class="bill-info"><span><strong>Notes:</strong> ${escapeHtml(order.notes)}</span></div>` : ''}

        <table class="bill-table">
          <thead>
            <tr>
              <th>Item</th>
              <th style="text-align:center">Qty</th>
              <th style="text-align:center">Price</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map(item => `
              <tr>
                <td>${escapeHtml(item.product_name)}</td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:center">${formatCurrency(item.price)}</td>
                <td style="text-align:right">${formatCurrency(item.price * item.quantity)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        ${order.discount > 0 ? `
          <div style="display:flex;justify-content:space-between;font-size:14px;margin-top:8px;padding:0 4px">
            <span>Subtotal</span>
            <span>${formatCurrency(order.total_amount + order.discount)}</span>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:14px;color:var(--danger);padding:0 4px">
            <span>Discount</span>
            <span>-${formatCurrency(order.discount)}</span>
          </div>
        ` : ''}
        <div class="bill-total">
          <span>Total Amount</span>
          <span>${formatCurrency(order.total_amount)}</span>
        </div>
        <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:8px">
          Total Items: ${order.items_count}
        </div>

        ${order.returns && order.returns.length > 0 ? `
          <div class="bill-divider"></div>
          <div style="text-align:center;font-size:14px;font-weight:700;color:var(--danger);margin:10px 0">RETURNS</div>
          ${order.returns.map(r => `
            <div style="display:flex;justify-content:space-between;font-size:13px;padding:4px">
              <span>${escapeHtml(r.product_name)} x${r.quantity}</span>
              <span style="color:var(--danger)">-${formatCurrency(r.refund_amount)}</span>
            </div>
          `).join('')}
        ` : ''}

        <div class="bill-divider"></div>
        <div class="bill-footer">
          Thank you for your visit!<br>
          Goods once sold will not be taken back.<br>
          This is a computer generated invoice.
        </div>
      </div>

      <div class="btn-group" style="margin-bottom:8px">
        <button class="btn btn-primary" onclick="printBill()">&#128196; Print PDF</button>
        <button class="btn btn-secondary" onclick="showReturnForm(${order.id})">&#8617; Return</button>
      </div>
      <button class="btn btn-danger btn-block" onclick="deleteOrder(${order.id})">
        &#128465; Delete Order
      </button>
    `;
    window._currentOrderForPrint = order;

    window._currentOrderForPrint = order;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Order not found</h3></div>';
  }
}

window.printBill = function() {
  window.print();
};

window.showReturnForm = async function(orderId) {
  try {
    const order = await API.getOrder(orderId);
    let options = '';
    order.items.forEach(item => {
      const returned = order.returns ? order.returns.filter(r => r.product_id === item.product_id).reduce((s, r) => s + r.quantity, 0) : 0;
      const canReturn = item.quantity - returned;
      if (canReturn > 0) {
        options += `<option value="${item.product_id}" data-max="${canReturn}" data-name="${escapeHtml(item.product_name)}">${escapeHtml(item.product_name)} (max ${canReturn})</option>`;
      }
    });

    if (!options) return showToast('No items available to return');

    const el = $('main');
    el.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:16px">Return Items - Order #${orderId}</h3>
        <div class="form-group">
          <label>Select Product</label>
          <select class="form-control" id="retProductId">${options}</select>
        </div>
        <div class="form-group">
          <label>Quantity</label>
          <input class="form-control" id="retQuantity" type="number" min="1" value="1">
        </div>
        <div class="form-group">
          <label>Reason</label>
          <select class="form-control" id="retReason">
            <option>Damaged</option>
            <option>Expired</option>
            <option>Wrong Item</option>
            <option>Customer Request</option>
            <option>Other</option>
          </select>
        </div>
        <button class="btn btn-warning btn-block" onclick="submitReturn(${orderId})" style="background:#ffc107;color:#333;font-weight:700">Process Return</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="navigate('orders/${orderId}')">Cancel</button>
      </div>
    `;
  } catch (e) { showToast('Error loading order'); }
};

// ======= QUICK ADD FAVORITES (Top products) =======
let _favProducts = [];

async function loadFavorites() {
  try {
    const orders = await API.getOrders({ limit: 200 });
    const counts = {};
    for (const o of orders) {
      const detail = await API.getOrder(o.id);
      for (const item of detail.items) {
        counts[item.product_id] = (counts[item.product_id] || 0) + item.quantity;
      }
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8);
    _favProducts = [];
    for (const [id] of sorted) {
      try { const p = await API.getProduct(parseInt(id)); if (p) _favProducts.push(p); } catch (e) {}
    }
  } catch (e) {}
}

function renderFavorites(el) {
  if (_favProducts.length === 0) return;
  el.innerHTML = `
    <div style="font-size:13px;font-weight:600;margin-bottom:6px;color:var(--muted)">&#9733; Quick Add (Top Selling)</div>
    <div class="fav-grid">
      ${_favProducts.map(p => `
        <div class="fav-item" onclick="addToCart(${p.id},'${escapeHtml(p.name)}',${p.price},'${escapeHtml(p.barcode)}')">
          <div class="fav-icon">📦</div>
          <div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.name)}</div>
          <div class="fav-price">${formatCurrency(p.price)}</div>
        </div>
      `).join('')}
    </div>
  `;
}

window.submitReturn = async function(orderId) {
  const sel = $('retProductId');
  const product_id = parseInt(sel.value);
  const quantity = parseInt($('retQuantity').value);
  const reason = $('retReason').value;
  const max = parseInt(sel.options[sel.selectedIndex].dataset.max);

  if (!quantity || quantity < 1) return showToast('Enter quantity');
  if (quantity > max) return showToast(`Can only return ${max}`);

  try {
    await API.returnItems(orderId, [{ product_id, quantity, reason }]);
    showToast('Return processed! Stock restored.');
    navigate(`orders/${orderId}`);
  } catch (e) { showToast(e.message || 'Return failed'); }
};

// ======= CATEGORIES =======
async function renderCategories(el) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const cats = await API.getCategories();
    el.innerHTML = `
      <div class="section-title">Manage Categories</div>
      <div id="catForm" class="card" style="margin-bottom:12px">
        <div style="display:flex;gap:8px;margin-bottom:8px">
          <input class="form-control" id="catName" placeholder="Category name" style="flex:1">
          <input class="form-control" id="catColor" type="color" value="#007bff" style="width:50px;padding:4px">
        </div>
        <button class="btn btn-sm btn-success" onclick="addCategory()">Add Category</button>
      </div>
      <div id="catList">
        ${cats.length === 0 ? '<div class="empty-state"><p>No categories yet</p></div>' :
          cats.map(c => `
            <div class="product-item" style="cursor:default">
              <div class="product-info">
                <div style="display:flex;align-items:center;gap:8px">
                  <span class="category-color" style="background:${c.color}"></span>
                  <span class="name">${escapeHtml(c.name)}</span>
                </div>
                <div class="barcode">${c.product_count} products</div>
              </div>
              <div style="display:flex;gap:4px">
                <button class="btn btn-sm btn-primary" onclick="editCategory(${c.id},'${escapeHtml(c.name)}','${c.color}')" style="padding:6px 10px;font-size:11px">Edit</button>
                <button class="btn btn-sm btn-danger" onclick="deleteCategory(${c.id},'${escapeHtml(c.name)}')" style="padding:6px 10px;font-size:11px">Del</button>
              </div>
            </div>
          `).join('')
        }
      </div>
      <div class="section-title" style="margin-top:16px">Filter Products by Category</div>
      <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px">
        <span class="category-chip active" onclick="filterByCategory(this,'')">All</span>
        ${cats.map(c => `
          <span class="category-chip" style="border:1px solid ${c.color};color:${c.color}" onclick="filterByCategory(this,'${escapeHtml(c.name)}')">
            <span class="category-color" style="background:${c.color}"></span>
            ${escapeHtml(c.name)}
          </span>
        `).join('')}
      </div>
    `;
  } catch (e) { el.innerHTML = '<p>Error loading</p>'; }
}

window.addCategory = async function() {
  const name = $('catName').value.trim();
  const color = $('catColor').value;
  if (!name) return showToast('Enter a name');
  try { await API.createCategory({ name, color }); showToast('Category added'); renderCategories($('main')); }
  catch (e) { showToast(e.message || 'Error'); }
};

window.editCategory = function(id, name, color) {
  $('catName').value = name;
  $('catColor').value = color;
  const btn = document.querySelector('#catForm .btn');
  btn.textContent = 'Update Category';
  btn.onclick = async () => {
    const n = $('catName').value.trim();
    if (!n) return showToast('Enter a name');
    try { await API.updateCategory(id, { name: n, color: $('catColor').value }); showToast('Updated'); renderCategories($('main')); }
    catch (e) { showToast(e.message); }
  };
};

window.deleteCategory = async function(id, name) {
  if (!confirm(`Delete "${name}"? Products will lose this category.`)) return;
  try { await API.deleteCategory(id); showToast('Deleted'); renderCategories($('main')); }
  catch (e) { showToast(e.message); }
};

window.filterByCategory = function(el, cat) {
  document.querySelectorAll('.category-chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  navigate(`products?cat=${encodeURIComponent(cat)}`);
};

// ======= BACKUP & RESTORE =======
async function renderBackup(el) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const stats = await API.getStats();
    el.innerHTML = `
      <div class="section-title">Database Overview</div>
      <div class="stats-row" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card" style="border-left-color:#007bff"><div class="value" style="color:#007bff;font-size:20px">${stats.products}</div><div class="label">Products</div></div>
        <div class="stat-card" style="border-left-color:#28a745"><div class="value" style="color:#28a745;font-size:20px">${stats.orders}</div><div class="label">Orders</div></div>
        <div class="stat-card" style="border-left-color:#17a2b8"><div class="value" style="color:#17a2b8;font-size:20px">${stats.customers}</div><div class="label">Customers</div></div>
      </div>
      <div class="stats-row" style="grid-template-columns:repeat(3,1fr)">
        <div class="stat-card" style="border-left-color:#ffc107"><div class="value" style="color:#ffc107;font-size:20px">${stats.lowStock}</div><div class="label">Low Stock</div></div>
        <div class="stat-card" style="border-left-color:#dc3545"><div class="value" style="color:#dc3545;font-size:20px">${stats.outOfStock}</div><div class="label">Out of Stock</div></div>
        <div class="stat-card" style="border-left-color:#6f42c1"><div class="value" style="color:#6f42c1;font-size:20px">${formatCurrency(stats.monthlyRevenue)}</div><div class="label">30d Revenue</div></div>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">&#128427; Backup &amp; Export</h3>
        <p style="font-size:13px;color:var(--muted);margin-bottom:12px">Download all your store data as a JSON file. This includes products, customers, orders, and settings.</p>
        <button class="btn btn-primary btn-block" onclick="downloadBackup()">&#11015; Download Backup</button>
      </div>

      <div class="card">
        <h3 style="margin-bottom:12px">&#128200; Quick Stats</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <button class="btn btn-sm btn-secondary" onclick="navigate('reports')">View Reports</button>
          <button class="btn btn-sm btn-secondary" onclick="navigate('products')">Manage Products</button>
        </div>
      </div>
    `;
  } catch (e) { el.innerHTML = '<p>Error loading</p>'; }
}

window.downloadBackup = async function() {
  try {
    const data = await API.exportBackup();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `store-backup-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  } catch (e) { showToast('Backup failed'); }
};

// ======= ADD FAVORITES TO CART =======
// Add favorites grid after scan button in cart
const _origRenderCart = renderCart;
renderCart = function(el) {
  _origRenderCart(el);
  setTimeout(() => {
    const scanBtn = document.querySelector('#main .btn-primary');
    if (scanBtn && _favProducts.length > 0) {
      const favDiv = document.createElement('div');
      favDiv.id = 'favContainer';
      scanBtn.parentNode.insertBefore(favDiv, scanBtn.nextSibling);
      renderFavorites(favDiv);
    }
  }, 100);
};

// Load favorites on app start
setTimeout(loadFavorites, 2000);

// ======= CUSTOMERS =======
async function renderCustomers(el) {
  el.innerHTML = `
    <div class="search-bar">
      <input class="form-control" id="custSearch" placeholder="Search customers..." oninput="searchCustomers()">
    </div>
    <button class="btn btn-primary btn-block" onclick="navigate('customers/add')" style="margin-bottom:16px">
      &#10133; Add Customer
    </button>
    <div id="customerList"></div>
  `;
  await searchCustomers();
}

window.searchCustomers = async function() {
  const el = $('customerList');
  const search = $('custSearch')?.value || '';
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';

  try {
    const customers = await API.getCustomers({ search });
    if (customers.length === 0) {
      el.innerHTML = '<div class="empty-state"><div class="icon">&#128101;</div><h3>No customers yet</h3><p>Customers will appear when you create bills</p></div>';
      return;
    }
    el.innerHTML = customers.map(c => `
      <div class="customer-item" onclick="navigate('customers/${c.id}')">
        <div class="customer-avatar">${c.name.charAt(0).toUpperCase()}</div>
        <div class="customer-info">
          <div class="name">${escapeHtml(c.name)}</div>
          ${c.phone ? `<div class="phone">${escapeHtml(c.phone)}</div>` : ''}
        </div>
        <button class="delete-btn" onclick="event.stopPropagation();deleteCustomer(${c.id},'${escapeHtml(c.name)}')">&#128465;</button>
      </div>
    `).join('');
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Error loading customers</h3></div>';
  }
}

window.deleteCustomer = async function(id, name) {
  if (!confirm(`Delete ${name}? Their order history will be preserved.`)) return;
  try {
    await API.deleteCustomer(id);
    showToast('Customer deleted');
    searchCustomers();
  } catch (e) { showToast('Error deleting customer'); }
};

// ======= CUSTOMER FORM =======
function renderCustomerForm(el) {
  el.innerHTML = `
    <div class="card">
      <h3 style="margin-bottom:16px">Add Customer</h3>
      <div class="form-group">
        <label>Name *</label>
        <input class="form-control" id="cName" placeholder="Customer name">
      </div>
      <div class="form-group">
        <label>Phone</label>
        <input class="form-control" id="cPhone" placeholder="Phone number" type="tel">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input class="form-control" id="cEmail" placeholder="Email address" type="email">
      </div>
      <div class="form-group">
        <label>Address</label>
        <textarea class="form-control" id="cAddress" placeholder="Address"></textarea>
      </div>
      <button class="btn btn-success btn-block" onclick="saveCustomer()">Add Customer</button>
    </div>
  `;
}

window.saveCustomer = async function() {
  const name = $('cName').value.trim();
  if (!name) return showToast('Customer name is required');
  try {
    await API.createCustomer({
      name, phone: $('cPhone').value.trim(),
      email: $('cEmail').value.trim(), address: $('cAddress').value.trim(),
    });
    showToast('Customer added!');
    navigate('customers');
  } catch (e) { showToast(e.message || 'Error saving customer'); }
};

// ======= CUSTOMER DETAIL =======
async function renderCustomerDetail(el, id) {
  el.innerHTML = '<div class="empty-state"><p>Loading...</p></div>';
  try {
    const [customer, orders] = await Promise.all([
      API.getCustomer(parseInt(id)),
      API.getCustomerOrders(parseInt(id)),
    ]);
    const totalSpent = orders.reduce((s, o) => s + o.total_amount, 0);

    el.innerHTML = `
      <div class="detail-card" style="text-align:center">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;margin:0 auto 10px">${customer.name.charAt(0).toUpperCase()}</div>
        <h2>${escapeHtml(customer.name)}</h2>
        ${customer.phone ? `<p style="color:var(--muted)">${escapeHtml(customer.phone)}</p>` : ''}
        ${customer.email ? `<p style="color:var(--muted)">${escapeHtml(customer.email)}</p>` : ''}
        ${customer.address ? `<p style="color:var(--muted);font-size:13px">${escapeHtml(customer.address)}</p>` : ''}
        <p style="font-size:11px;color:var(--muted);margin-top:8px">Customer since ${formatDate(customer.created_at)}</p>
      </div>

      <div class="stats-row">
        <div class="stat-card" style="border-left-color:var(--accent)">
          <div class="value" style="color:var(--accent);font-size:22px">${orders.length}</div>
          <div class="label">Orders</div>
        </div>
        <div class="stat-card" style="border-left-color:var(--success);grid-column:span 2">
          <div class="value" style="color:var(--success);font-size:22px">${formatCurrency(totalSpent)}</div>
          <div class="label">Total Spent</div>
        </div>
      </div>

      <button class="btn btn-primary btn-block" onclick="showEditCustomerForm(${customer.id})" style="margin-bottom:16px">
        &#9998; Edit Customer
      </button>

      <div class="section-title">Order History</div>
      ${orders.length === 0 ? '<div class="empty-state"><p>No orders yet</p></div>' :
        orders.map(o => `
          <div class="order-item" onclick="navigate('orders/${o.id}')">
            <div class="order-header">
              <span class="order-id">Order #${o.id}</span>
            </div>
            <div class="order-date">${formatDate(o.created_at)}</div>
            <div class="order-footer">
              <span class="items-count">${o.items_count} items</span>
              <span class="amount">${formatCurrency(o.total_amount)}</span>
            </div>
          </div>
        `).join('')
      }
    `;
  } catch (e) {
    el.innerHTML = '<div class="empty-state"><div class="icon">&#9888;</div><h3>Customer not found</h3></div>';
  }
}

window.showEditCustomerForm = async function(id) {
  try {
    const c = await API.getCustomer(id);
    const el = $('main');
    el.innerHTML = `
      <div class="card">
        <h3 style="margin-bottom:16px">Edit Customer</h3>
        <div class="form-group">
          <label>Name *</label>
          <input class="form-control" id="cName" value="${escapeHtml(c.name)}">
        </div>
        <div class="form-group">
          <label>Phone</label>
          <input class="form-control" id="cPhone" value="${escapeHtml(c.phone)}" type="tel">
        </div>
        <div class="form-group">
          <label>Email</label>
          <input class="form-control" id="cEmail" value="${escapeHtml(c.email)}" type="email">
        </div>
        <div class="form-group">
          <label>Address</label>
          <textarea class="form-control" id="cAddress">${escapeHtml(c.address)}</textarea>
        </div>
        <button class="btn btn-success btn-block" onclick="updateCustomer(${c.id})">Save Changes</button>
        <button class="btn btn-secondary btn-block" style="margin-top:8px" onclick="navigate('customers/${c.id}')">Cancel</button>
      </div>
    `;
  } catch (e) { showToast('Error loading customer'); }
};

window.updateCustomer = async function(id) {
  const name = $('cName').value.trim();
  if (!name) return showToast('Name is required');
  try {
    await API.updateCustomer(id, {
      name, phone: $('cPhone').value.trim(),
      email: $('cEmail').value.trim(), address: $('cAddress').value.trim(),
    });
    showToast('Customer updated!');
    navigate(`customers/${id}`);
  } catch (e) { showToast(e.message); }
};
