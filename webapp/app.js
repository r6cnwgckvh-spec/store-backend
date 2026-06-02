const API = 'https://store-backend-npao.onrender.com/api';
let token = localStorage.getItem('token');
let user = JSON.parse(localStorage.getItem('user') || 'null');
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let isDark = localStorage.getItem('dark') === 'true';
let currentView = 'login';
let lockPin = localStorage.getItem('lockPin') || '';
let multiItems = null;
let prodPage = 1, ordPage = 1, custPage = 1;
let cameraStream = null;

function $(id) { return document.getElementById(id); }
function esc(s) { return String(s).replace(/['"&<>]/g, c => ({ "'": '&#39;', '"': '&quot;', '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] || c); }
function showToast(m, d) { const t = $('loading-toast'); if (!t) return; t.textContent = m; t.style.display = 'block'; setTimeout(() => { if (t) t.style.display = 'none'; }, d || 1500); }
function loading(b) { const t = $('loading-toast'); if (!t) return; t.textContent = b ? 'Loading...' : ''; t.style.display = b ? 'block' : 'none'; }

async function api(meth, ep, body) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = 'Bearer ' + token;
  const opts = { method: meth, headers: h };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(API + ep, opts);
  if (r.status === 401) { token = null; localStorage.removeItem('token'); localStorage.removeItem('user'); showToast('Session expired'); renderAuth(); throw new Error('Unauthorized'); }
  const j = await r.json();
  if (!r.ok) throw new Error(j.error || ('Error ' + r.status));
  return j;
}
const get = (e) => api('GET', e);
const post = (e, b) => api('POST', e, b);
const put = (e, b) => api('PUT', e, b);
const del = (e) => api('DELETE', e);

function toggleDarkMode() {
  isDark = !isDark;
  localStorage.setItem('dark', isDark);
  document.body.classList.toggle('dark', isDark);
  const btn = $('theme-btn');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}

function toggleSidebar() {
  $('sidebar')?.classList.toggle('open');
  $('sidebar-overlay')?.classList.toggle('open');
}

function closeModal() {
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  $('modal-overlay')?.classList.remove('open');
  $('modal-container')?.classList.remove('open');
}

function openModal(html) {
  $('modal-content').innerHTML = html;
  $('modal-overlay').classList.add('open');
  $('modal-container').classList.add('open');
}

function setTitle(t) { const el = $('page-title'); if (el) el.textContent = t; }

function renderSidebar() {
  const items = [
    { icon: '🏠', label: 'Dashboard', view: 'dashboard' },
    { icon: '📦', label: 'Products', view: 'products' },
    { icon: '🛒', label: 'Cart / Billing', view: 'cart' },
    { icon: '📋', label: 'Orders', view: 'orders' },
    { icon: '👥', label: 'Customers', view: 'customers' },
    { icon: '📊', label: 'Reports', view: 'reports' },
    { icon: '🏷️', label: 'Categories', view: 'categories' },
    { icon: '📋', label: 'Shopping Lists', view: 'shoppinglists' },
    { icon: '➕', label: 'Add Multiple Items', view: 'addmultiple' },
    { icon: '📄', label: 'My Bills', view: 'bills' },
    { icon: '⚠️', label: 'Low Stock', view: 'lowstock' },
    { icon: '⚙️', label: 'Settings', view: 'settings' },
    { icon: '👑', label: 'Admin Panel', view: 'admin' },
    { icon: '🚪', label: 'Logout', view: 'logout' },
  ];
  $('sidebar-menu').innerHTML = items.map(i => `<div class="sidebar-item" onclick="navigate('${i.view}')"><span class="icon">${i.icon}</span>${i.label}</div>`).join('');
}

function navigate(view, params) {
  if (view === 'logout') { token = null; localStorage.removeItem('token'); localStorage.removeItem('user'); renderAuth(); return; }
  if (view === 'admin') { window.open('https://store-backend-npao.onrender.com/admin/', '_blank'); return; }
  currentView = view;
  renderView(view, params);
  if (window.innerWidth <= 768) {
    $('sidebar')?.classList.remove('open');
    $('sidebar-overlay')?.classList.remove('open');
  }
}

function renderAuth() {
  $('sidebar')?.classList.remove('open');
  $('sidebar-overlay')?.classList.remove('open');
  renderView('login');
}

async function renderView(view, params) {
  loading(true);
  const area = $('content-area');
  if (!area) { loading(false); return; }
  if (!token || !user) { renderLogin(); loading(false); return; }
  if (user.status === 'pending') { renderPending(); loading(false); return; }
  if (user.status === 'approved' && !user.has_pin) { renderSetPin(); loading(false); return; }
  if (lockPin && !sessionStorage.getItem('unlocked')) { renderLockScreen(); loading(false); return; }
  if (user.needs_setup) { renderStoreSetup(); loading(false); return; }
  renderSidebar();
  try {
    switch (view) {
      case 'login': renderLogin(); break;
      case 'dashboard': await renderDashboard(); break;
      case 'products': prodPage = 1; await renderProducts({}); break;
      case 'addproduct': renderAddProduct(params); break;
      case 'productdetail': await renderProductDetail(params); break;
      case 'cart': await renderCart(); break;
      case 'orders': ordPage = 1; await renderOrders(); break;
      case 'orderdetail': await renderOrderDetail(params); break;
      case 'customers': custPage = 1; await renderCustomers(); break;
      case 'customerform': renderCustomerForm(params); break;
      case 'customerdetail': await renderCustomerDetail(params); break;
      case 'reports': await renderReports(); break;
      case 'categories': await renderCategories(); break;
      case 'settings': await renderSettings(); break;
      case 'shoppinglists': await renderShoppingLists(); break;
      case 'shoppinglistdetail': await renderShoppingListDetail(params); break;
      case 'addmultiple': multiItems = null; renderAddMultiple(); break;
      case 'bills': await renderBills(); break;
      case 'lowstock': await renderLowStock(); break;
      default: await renderDashboard();
    }
  } catch (e) { showToast(e.message); }
  loading(false);
}

function renderLogin() {
  setTitle('Login');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>Store Manager</h1>
      <p>Sign in to your account</p>
      <div class="auth-card">
        <div class="form-group"><label>Email</label><input type="email" id="login-email" placeholder="your@email.com" autocomplete="email"></div>
        <div class="form-group"><label>PIN</label><input type="password" id="login-pin" placeholder="Your PIN" inputmode="numeric" pattern="[0-9]*" autocomplete="off"></div>
        <button class="btn-primary btn-block" onclick="doLogin()" type="button">Sign In</button>
        <div class="auth-link">Don't have an account? <a onclick="renderRegister()">Register</a></div>
      </div>
    </div>`;
}

async function doLogin() {
  const email = $('login-email')?.value?.trim();
  const pin = $('login-pin')?.value?.trim();
  if (!email || !pin) { showToast('Enter email and PIN'); return; }
  loading(true);
  try {
    const r = await post('/auth/login', { email, pin });
    token = r.token; user = r.user;
    localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user));
    await renderView('dashboard');
  } catch (e) { showToast(e.message, 2000); }
  loading(false);
}

function renderRegister() {
  setTitle('Create Account');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>Create Account</h1>
      <p>Register to get started</p>
      <div class="auth-card">
        <div class="form-group"><label>Name</label><input type="text" id="reg-name" placeholder="Your name"></div>
        <div class="form-group"><label>Email</label><input type="email" id="reg-email" placeholder="your@email.com"></div>
        <div class="form-group"><label>Set a 4-digit PIN</label><input type="password" id="reg-pin" placeholder="1234" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
        <button class="btn-primary btn-block" onclick="doRegister()" type="button">Register</button>
        <div class="auth-link">Already have an account? <a onclick="renderLogin()">Sign In</a></div>
      </div>
    </div>`;
}

async function doRegister() {
  const name = $('reg-name')?.value?.trim();
  const email = $('reg-email')?.value?.trim();
  const pin = $('reg-pin')?.value?.trim();
  if (!name || !email || !pin) { showToast('Fill all fields'); return; }
  if (pin.length !== 4 || isNaN(pin)) { showToast('PIN must be 4 digits'); return; }
  loading(true);
  try {
    const r = await post('/auth/register', { name, email, pin });
    if (r.status === 'pending') { user = r; localStorage.setItem('user', JSON.stringify(r)); renderPending(); }
    else if (r.token) { token = r.token; user = r.user; localStorage.setItem('token', token); localStorage.setItem('user', JSON.stringify(user)); await renderView('dashboard'); }
  } catch (e) { showToast(e.message, 2000); }
  loading(false);
}

function renderPending() {
  setTitle('Pending Approval');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>⏳ Pending Approval</h1>
      <p>Your account is waiting for admin approval.</p>
      <div class="auth-card" style="text-align:center">
        <p style="font-size:48px;margin-bottom:12px">🕐</p>
        <p>You'll be notified when an admin approves your account.</p>
        <button class="btn-outline btn-block" style="margin-top:16px" onclick="checkApproval()" type="button">Check Status</button>
        <div class="auth-link"><a onclick="renderLogin()">Back to Login</a></div>
      </div>
    </div>`;
}

async function checkApproval() {
  if (!user?.email) return;
  loading(true);
  try {
    const r = await post('/auth/check-status', { email: user.email });
    if (r.status === 'approved') {
      user.status = 'approved'; user.has_pin = r.has_pin; user.needs_setup = r.needs_setup;
      localStorage.setItem('user', JSON.stringify(user));
      if (r.token) { token = r.token; localStorage.setItem('token', token); }
      showToast('Approved!', 1500);
      await renderView('dashboard');
    } else { showToast('Still pending...', 1500); }
  } catch (e) { showToast(e.message, 1500); }
  loading(false);
}

function renderSetPin() {
  setTitle('Set Your PIN');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>🔐 Set Your PIN</h1>
      <p>Choose a 4-digit PIN for quick login</p>
      <div class="auth-card">
        <div class="form-group"><label>New PIN</label><input type="password" id="setpin1" placeholder="1234" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
        <div class="form-group"><label>Confirm PIN</label><input type="password" id="setpin2" placeholder="1234" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
        <button class="btn-primary btn-block" onclick="doSetPin()" type="button">Set PIN</button>
      </div>
    </div>`;
}

async function doSetPin() {
  const p1 = $('setpin1')?.value?.trim();
  const p2 = $('setpin2')?.value?.trim();
  if (p1 !== p2) { showToast('PINs do not match'); return; }
  if (!p1 || p1.length !== 4 || isNaN(p1)) { showToast('PIN must be 4 digits'); return; }
  loading(true);
  try {
    await post('/auth/set-pin', { pin: p1 });
    user.has_pin = true; localStorage.setItem('user', JSON.stringify(user));
    lockPin = p1; localStorage.setItem('lockPin', p1);
    sessionStorage.setItem('unlocked', '1');
    showToast('PIN set!', 1500);
    await renderView('dashboard');
  } catch (e) { showToast(e.message); }
  loading(false);
}

function renderLockScreen() {
  setTitle('Locked');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>🔒 App Locked</h1>
      <p>Enter your PIN to unlock</p>
      <div class="auth-card">
        <div class="form-group"><input type="password" id="lock-pin-input" placeholder="Enter PIN" inputmode="numeric" pattern="[0-9]*" maxlength="4" autofocus></div>
        <button class="btn-primary btn-block" onclick="doUnlock()" type="button">Unlock</button>
      </div>
    </div>`;
  setTimeout(() => $('lock-pin-input')?.focus(), 100);
}

function doUnlock() {
  const p = $('lock-pin-input')?.value?.trim();
  if (p === lockPin) { sessionStorage.setItem('unlocked', '1'); renderView(currentView); }
  else { showToast('Wrong PIN', 1000); if ($('lock-pin-input')) $('lock-pin-input').value = ''; }
}

function renderStoreSetup() {
  setTitle('Store Setup');
  $('content-area').innerHTML = `
    <div class="auth-screen">
      <h1>🏪 Welcome!</h1>
      <p>Set up your store</p>
      <div class="auth-card">
        <div class="form-group"><label>Store Name</label><input id="setup-name" placeholder="My Store"></div>
        <div class="form-group"><label>Address</label><input id="setup-addr" placeholder="123 Main Street"></div>
        <div class="form-group"><label>Phone</label><input id="setup-phone" placeholder="+91 98765 43210"></div>
        <button class="btn-primary btn-block" onclick="doStoreSetup()" type="button">Save & Continue</button>
      </div>
    </div>`;
}

async function doStoreSetup() {
  const d = { store_name: $('setup-name')?.value?.trim() || '', address: $('setup-addr')?.value?.trim() || '', phone: $('setup-phone')?.value?.trim() || '' };
  loading(true);
  try { await put('/settings', d); user.needs_setup = false; localStorage.setItem('user', JSON.stringify(user)); await renderView('dashboard'); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderDashboard() {
  setTitle('Dashboard');
  loading(true);
  try {
    const r = await Promise.all([
      get('/products?limit=1').catch(() => ({ total: 0 })),
      get('/orders?limit=1').catch(() => ({ total: 0 })),
      get('/customers?limit=1').catch(() => ({ total: 0 })),
      get('/products/low-stock?threshold=5').catch(() => []),
    ]);
    loading(false);
    const pc = r[0].total || 0, oc = r[1].total || 0, cc = r[2].total || 0, lc = Array.isArray(r[3]) ? r[3].length : 0;
    $('content-area').innerHTML = `
      <div class="stat-grid">
        <div class="stat-card"><div class="num">${pc}</div><div class="lbl">Products</div></div>
        <div class="stat-card"><div class="num">${oc}</div><div class="lbl">Orders</div></div>
        <div class="stat-card"><div class="num">${cc}</div><div class="lbl">Customers</div></div>
        <div class="stat-card"><div class="num" style="color:${lc > 0 ? 'var(--danger)' : 'var(--success)'}">${lc}</div><div class="lbl">Low Stock</div></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">
        <button class="btn-primary" onclick="navigate('products')" type="button">📦 Products</button>
        <button class="btn-success" onclick="navigate('cart')" type="button">🛒 New Sale</button>
        <button class="btn-outline" onclick="navigate('orders')" type="button">📋 Orders</button>
        <button class="btn-outline" onclick="navigate('addmultiple')" type="button">➕ Add Items</button>
      </div>`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function renderProducts(params) {
  setTitle('Products');
  const q = params?.search || '';
  if (params?.page) prodPage = params.page;
  loading(true);
  try {
    const r = await get(`/products?page=${prodPage}&limit=20&search=${encodeURIComponent(q)}`);
    const items = Array.isArray(r) ? r : r.data || [];
    const total = r.total || items.length;
    loading(false);
    const sq = esc(q);
    $('content-area').innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <button class="btn-success" onclick="navigate('addproduct')" type="button">+ Add Product</button>
        <button class="btn-primary" onclick="navigate('addmultiple')" type="button">+ Add Multiple</button>
      </div>
      <div class="search-bar">
        <input type="text" id="prod-search" placeholder="Search products..." value="${sq}">
        <button class="btn-primary btn-sm" onclick="doProdSearch()" type="button">Search</button>
      </div>
      ${items.length === 0
        ? '<div class="empty-state"><div class="icon">📦</div><h3>No Products</h3><p>Add your first product to get started.</p></div>'
        : '<div class="grid">' + items.map(p => `
          <div class="grid-item" onclick="navigate('productdetail',{id:${p.id}})">
            <h4>${esc(p.name)}</h4>
            <p>₹${p.price} · Stock: ${p.stock}${p.tablets_per_strip > 1 ? ' (' + Math.floor(p.stock / p.tablets_per_strip) + ' strips)' : ''}</p>
            ${p.stock <= (p.min_stock || 5) ? '<span class="badge badge-danger">Low Stock</span>' : ''}
          </div>`).join('') + '</div>'}
      ${total > 20 ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        ${prodPage > 1 ? `<button class="btn-outline btn-sm" onclick="prodPage--;renderProducts({search:'${sq}'})" type="button">← Prev</button>` : ''}
        ${prodPage * 20 < total ? `<button class="btn-outline btn-sm" onclick="prodPage++;renderProducts({search:'${sq}'})" type="button">Next →</button>` : ''}
      </div>` : ''}`;
  } catch (e) { loading(false); showToast(e.message); }
}

function doProdSearch() { renderProducts({ search: $('prod-search')?.value || '', page: 1 }); }

function renderAddProduct(params) {
  const edit = params?.id;
  setTitle(edit ? 'Edit Product' : 'Add Product');
  loading(true);
  if (edit) {
    get(`/products/${edit}`).then(p => { loading(false); $('content-area').innerHTML = productForm(p); }).catch(e => { loading(false); showToast(e.message); navigate('products'); });
  } else {
    loading(false);
    $('content-area').innerHTML = productForm(null);
  }
}

function productForm(p) {
  const isMed = !p || !p.tablets_per_strip || p.tablets_per_strip > 1;
  return `
    <div class="card">
      <div class="card-title">${p ? 'Edit' : 'Add'} Product</div>
      <div class="form-group"><label>Product Name *</label><input id="pf-name" value="${esc(p ? p.name : '')}"></div>
      <div class="form-group"><label>Barcode</label>
        <div class="barcode-row">
          <input id="pf-barcode" value="${esc(p ? p.barcode : '')}" style="flex:1;margin-bottom:0">
          <button class="btn-sm btn-primary" onclick="openBarcodeModal('pf-barcode')" type="button">📷 Scan</button>
        </div>
      </div>
      <div class="row">
        <div class="col"><div class="form-group"><label>Selling Price *</label><input type="number" id="pf-price" step="0.01" value="${p ? p.price : ''}"></div></div>
        <div class="col"><div class="form-group"><label>Cost Price</label><input type="number" id="pf-cost" step="0.01" value="${p ? esc(p.cost_price || '') : ''}"></div></div>
      </div>
      <div class="row">
        <div class="col"><div class="form-group"><label>Stock</label><input type="number" id="pf-stock" value="${p ? p.stock : '0'}"></div></div>
        <div class="col"><div class="form-group"><label>Min Stock Alert</label><input type="number" id="pf-min" value="${p ? (p.min_stock || 5) : 5}"></div></div>
      </div>
      <div class="toggle-pill" id="pf-type">
        <button class="${isMed ? 'active' : ''}" onclick="setProdType('medicine')" id="pf-type-med" type="button">Medicine</button>
        <button class="${isMed ? '' : 'active'}" onclick="setProdType('general')" id="pf-type-gen" type="button">General</button>
      </div>
      <div id="pf-med-fields" style="display:${isMed ? 'block' : 'none'}">
        <div class="row">
          <div class="col"><div class="form-group"><label>Tablets per Strip</label><input type="number" id="pf-tps" value="${p ? (p.tablets_per_strip || 10) : 10}"></div></div>
          <div class="col"><div class="form-group"><label>Expiry Date</label><input id="pf-expiry" placeholder="MM/YYYY" value="${esc(p ? p.expiry_date || '' : '')}"></div></div>
        </div>
      </div>
      <div class="form-group"><label>Category</label><input id="pf-cat" value="${esc(p ? p.category || '' : '')}"></div>
      <button class="btn-success btn-block" onclick="saveProduct(${p ? p.id : 'null'})" type="button">${p ? 'Update' : 'Add'} Product</button>
    </div>`;
}

function setProdType(t) {
  $('pf-type-med')?.classList.toggle('active', t === 'medicine');
  $('pf-type-gen')?.classList.toggle('active', t === 'general');
  const mf = $('pf-med-fields');
  if (mf) mf.style.display = t === 'medicine' ? 'block' : 'none';
}

async function saveProduct(id) {
  const d = {
    name: $('pf-name')?.value?.trim(),
    barcode: $('pf-barcode')?.value?.trim() || undefined,
    price: parseFloat($('pf-price')?.value) || 0,
    cost_price: parseFloat($('pf-cost')?.value) || 0,
    stock: parseInt($('pf-stock')?.value) || 0,
    min_stock: parseInt($('pf-min')?.value) || 5,
    tablets_per_strip: parseInt($('pf-tps')?.value) || 10,
    expiry_date: $('pf-expiry')?.value?.trim() || '',
    category: $('pf-cat')?.value?.trim() || '',
  };
  if (!d.name) { showToast('Product name is required'); return; }
  loading(true);
  try {
    if (id) { await put(`/products/${id}`, d); showToast('Updated!'); }
    else { await post('/products', d); showToast('Product added!'); }
    navigate('products');
  } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderProductDetail(params) {
  setTitle('Product');
  loading(true);
  try {
    const p = await get(`/products/${params.id}`);
    loading(false);
    $('content-area').innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div><h3 style="font-size:18px">${esc(p.name)}</h3>
          <p style="color:var(--text2);font-size:13px">Barcode: ${p.barcode || 'N/A'}</p></div>
          <div style="display:flex;gap:8px">
            <button class="btn-sm btn-outline" onclick="navigate('addproduct',{id:${p.id}})" type="button">Edit</button>
            <button class="btn-sm btn-danger" onclick="deleteProduct(${p.id})" type="button">Delete</button>
          </div>
        </div>
        <div style="margin-top:12px">
          <div class="stat-grid">
            <div class="stat-card"><div class="num">₹${p.price}</div><div class="lbl">Selling Price</div></div>
            <div class="stat-card"><div class="num" style="color:var(--text)">₹${p.cost_price || 0}</div><div class="lbl">Cost Price</div></div>
            <div class="stat-card"><div class="num">${p.stock}</div><div class="lbl">Stock</div></div>
            ${p.tablets_per_strip > 1 ? `<div class="stat-card"><div class="num">${Math.floor(p.stock / p.tablets_per_strip)}</div><div class="lbl">Strips (${p.tablets_per_strip}/strip)</div></div>` : ''}
          </div>
          <table style="margin-top:12px">
            <tr><td>Category</td><td>${esc(p.category || 'N/A')}</td></tr>
            <tr><td>Expiry</td><td>${esc(p.expiry_date || 'N/A')}</td></tr>
            <tr><td>Type</td><td>${p.tablets_per_strip > 1 ? 'Medicine' : 'General'}</td></tr>
          </table>
        </div>
      </div>
      <button class="btn-primary btn-block" onclick="navigate('products')" type="button">← Back to Products</button>`;
  } catch (e) { loading(false); showToast(e.message); navigate('products'); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  loading(true);
  try { await del(`/products/${id}`); showToast('Deleted'); navigate('products'); } catch (e) { showToast(e.message); }
  loading(false);
}

// ===== BARCODE SCANNER (auto-detect with BarcodeDetector API) =====
let scanTimer = null;

function openBarcodeModal(inputId) {
  openModal(`
    <h3 style="margin-bottom:12px">📷 Scan Barcode</h3>
    <div style="display:flex;gap:8px;margin-bottom:8px">
      <input type="text" id="barcode-input" placeholder="Or type barcode..." style="flex:1;margin-bottom:0" autofocus>
      <button class="btn-primary btn-sm" onclick="applyBarcode('${inputId}')" type="button">Apply</button>
    </div>
    <div id="barcode-preview" style="margin-bottom:8px;max-height:220px;overflow:hidden;border-radius:6px;background:#000;display:none;position:relative">
      <video id="barcode-video" style="width:100%;max-height:220px" autoplay playsinline muted></video>
      <div id="barcode-scanned" style="position:absolute;bottom:8px;left:8px;right:8px;background:rgba(0,0,0,0.7);color:#0f0;padding:6px 10px;border-radius:4px;font-size:13px;display:none"></div>
    </div>
    <button class="btn-outline btn-sm" onclick="toggleBarcodeCamera('${inputId}')" id="barcode-cam-btn" type="button">📷 Open Camera</button>
    <button class="btn-outline btn-block" style="margin-top:8px" onclick="closeModal()" type="button">Cancel</button>
  `);
  setTimeout(() => $('barcode-input')?.focus(), 100);
}

function toggleBarcodeCamera(inputId) {
  const preview = $('barcode-preview');
  const btn = $('barcode-cam-btn');
  if (!preview || !btn) return;
  if (cameraStream) {
    if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
    preview.style.display = 'none';
    btn.textContent = '📷 Open Camera';
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) { showToast('Camera not available'); return; }
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } } }).then(stream => {
    cameraStream = stream;
    const video = $('barcode-video');
    if (video) { video.srcObject = stream; video.onloadedmetadata = () => video.play(); }
    preview.style.display = 'block';
    btn.textContent = '❌ Close Camera';

    // Use BarcodeDetector API if available
    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({ formats: ['ean_13', 'ean_8', 'code_128', 'code_39', 'upc_a', 'upc_e', 'itf_14', 'qr_code', 'code_93', 'codabar', 'data_matrix', 'aztec'] });
      const canvas = document.createElement('canvas');
      const scannedDiv = $('barcode-scanned');
      scanTimer = setInterval(() => {
        if (!video || !video.videoWidth) return;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        detector.detect(canvas).then(barcodes => {
          if (barcodes.length > 0) {
            const code = barcodes[0].rawValue;
            if (scannedDiv) { scannedDiv.textContent = '✅ Scanned: ' + code; scannedDiv.style.display = 'block'; }
            if ($('barcode-input')) $('barcode-input').value = code;
            if (scanTimer) { clearInterval(scanTimer); scanTimer = null; }
            if ($(inputId)) { $(inputId).value = code; setTimeout(closeModal, 800); }
          }
        }).catch(() => {});
      }, 300);
    } else {
      showToast('Auto-scan not supported. Type barcode manually.', 2000);
    }
  }).catch(() => showToast('Camera access denied'));
}

function applyBarcode(inputId) {
  const v = $('barcode-input')?.value?.trim();
  if (v && $(inputId)) { $(inputId).value = v; closeModal(); }
}

async function renderLowStock() {
  setTitle('Low Stock');
  loading(true);
  try {
    const items = await get('/products/low-stock?threshold=5');
    loading(false);
    $('content-area').innerHTML = `
      <p style="color:var(--text2);margin-bottom:12px">Products with stock below 5</p>
      ${items.length === 0 ? '<div class="empty-state"><div class="icon">✅</div><h3>All Stocked Up</h3></div>' :
        '<div class="grid">' + items.map(p => `
          <div class="grid-item" onclick="navigate('productdetail',{id:${p.id}})">
            <h4>${esc(p.name)}</h4>
            <p>Stock: <strong style="color:var(--danger)">${p.stock}</strong> / ${p.min_stock || 5}</p>
          </div>`).join('') + '</div>'}
      <button class="btn-outline btn-block" style="margin-top:12px" onclick="navigate('addmultiple')" type="button">+ Add Stock</button>`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function renderCart() {
  setTitle('Cart / Billing');
  if (cart.length === 0) {
    $('content-area').innerHTML = `
      <div class="empty-state"><div class="icon">🛒</div><h3>Cart is Empty</h3>
      <p>Scan or search products to add</p>
      <div style="display:flex;gap:8px;max-width:400px;margin:0 auto;margin-top:16px">
        <input type="text" id="cart-barcode" placeholder="Type barcode..." style="flex:1" onkeyup="if(event.key==='Enter')addToCartByBarcode()">
        <button class="btn-primary btn-sm" onclick="addToCartByBarcode()" type="button">Add</button>
      </div>
      <button class="btn-outline btn-block" style="margin-top:12px;max-width:400px;margin-left:auto;margin-right:auto" onclick="navigate('products')" type="button">Browse Products</button></div>`;
    return;
  }
  let total = 0;
  let html = '<div style="margin-bottom:12px"><div class="barcode-row" style="margin-bottom:12px"><input type="text" id="cart-barcode" placeholder="Type barcode..." onkeyup="if(event.key===\'Enter\')addToCartByBarcode()" style="flex:1"><button class="btn-sm btn-primary" onclick="addToCartByBarcode()" type="button">Add</button></div>';
  cart.forEach((c, i) => {
    const st = c.price * c.qty;
    total += st;
    html += `<div class="item-card"><div class="item-header"><strong>${esc(c.name)}</strong><button class="btn-sm btn-danger" onclick="removeFromCart(${i})" type="button">✕</button></div>
      <div class="row"><div class="col"><label>Qty</label><input type="number" value="${c.qty}" min="1" onchange="updateCartQty(${i},this.value)" style="margin-bottom:0"></div>
      <div class="col"><label>Price</label><input type="number" value="${c.price}" step="0.01" onchange="updateCartPrice(${i},this.value)" style="margin-bottom:0"></div>
      <div class="col"><label>Subtotal</label><div style="padding:10px 12px;font-weight:700">₹${st.toFixed(2)}</div></div></div></div>`;
  });
  html += `</div><div class="card"><div style="display:flex;justify-content:space-between;font-size:18px;font-weight:700"><span>Total:</span><span>₹${total.toFixed(2)}</span></div>
    <div class="row" style="margin-top:12px">
      <div class="col"><label>Discount</label><input type="number" id="cart-discount" value="0" step="0.01"></div>
      <div class="col"><label>Payment</label><select id="cart-payment"><option>Cash</option><option>Card</option><option>UPI</option></select></div>
    </div>
    <div class="form-group"><label>Customer</label><select id="cart-customer"><option value="">Walk-in Customer</option></select></div>
    <div class="form-group"><label>Notes</label><input id="cart-notes" placeholder="Optional notes"></div>
    <button class="btn-success btn-block" onclick="checkout()" type="button">💳 Complete Sale — ₹${total.toFixed(2)}</button>
    <button class="btn-outline btn-block" style="margin-top:8px" onclick="clearCart()" type="button">Clear Cart</button></div>`;
  $('content-area').innerHTML = html;
  try {
    const c = await get('/customers?limit=200');
    const list = Array.isArray(c) ? c : c.data || [];
    const sel = $('cart-customer');
    if (sel) list.forEach(cust => { const o = document.createElement('option'); o.value = cust.id; o.textContent = cust.name + ' (' + (cust.phone || '') + ')'; sel.appendChild(o); });
  } catch (_) { /* customer dropdown is optional */ }
}

async function addToCart(barcode) {
  if (!barcode) return;
  loading(true);
  try {
    const p = await get(`/products/barcode/${encodeURIComponent(barcode)}`);
    const idx = cart.findIndex(c => c.id === p.id);
    if (idx >= 0) cart[idx].qty += 1;
    else cart.push({ id: p.id, name: p.name, barcode: p.barcode, price: p.price, qty: 1, tablets_per_strip: p.tablets_per_strip });
    localStorage.setItem('cart', JSON.stringify(cart));
    showToast(`${p.name} added`);
    await renderCart();
  } catch (e) { showToast(e.message || 'Product not found'); }
  loading(false);
}

async function addToCartByBarcode() {
  const v = $('cart-barcode')?.value?.trim();
  if (!v) return;
  $('cart-barcode').value = '';
  await addToCart(v);
}

function removeFromCart(i) { cart.splice(i, 1); localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); }
function updateCartQty(i, v) { cart[i].qty = Math.max(1, parseInt(v) || 1); localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); }
function updateCartPrice(i, v) { cart[i].price = Math.max(0, parseFloat(v) || 0); localStorage.setItem('cart', JSON.stringify(cart)); renderCart(); }
function clearCart() { cart = []; localStorage.setItem('cart', JSON.stringify([])); renderCart(); }

async function checkout() {
  if (cart.length === 0) { showToast('Cart is empty'); return; }
  const customerId = $('cart-customer')?.value;
  const discount = parseFloat($('cart-discount')?.value) || 0;
  const payment = $('cart-payment')?.value || 'Cash';
  const notes = $('cart-notes')?.value?.trim() || '';
  loading(true);
  try {
    const r = await post('/orders', {
      items: cart.map(c => ({ product_id: c.id, product_name: c.name, product_barcode: c.barcode || '', quantity: c.qty, price: c.price })),
      customer_id: customerId ? parseInt(customerId) : null,
      discount, payment_method: payment, notes,
    });
    cart = []; localStorage.setItem('cart', JSON.stringify([]));
    showToast(`Order #${r.id} created! ₹${(r.total_amount || 0).toFixed(2)}`);
    navigate('orders');
  } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderOrders() {
  setTitle('Orders');
  loading(true);
  try {
    const r = await get(`/orders?page=${ordPage}&limit=20`);
    const items = Array.isArray(r) ? r : r.data || [];
    const total = r.total || items.length;
    loading(false);
    $('content-area').innerHTML = `
      ${items.length === 0 ? '<div class="empty-state"><div class="icon">📋</div><h3>No Orders Yet</h3></div>' :
        '<div>' + items.map(o => `
          <div class="item-card" style="cursor:pointer" onclick="navigate('orderdetail',{id:${o.id}})">
            <div class="item-header">
              <strong>Order #${o.id}</strong>
              <span style="font-size:12px;color:var(--text2)">${new Date(o.created_at).toLocaleDateString()}</span>
            </div>
            <div class="row">
              <div class="col"><label>Customer</label><div>${esc(o.customer_name || 'Walk-in')}</div></div>
              <div class="col"><label>Items</label><div>${o.items_count || 0}</div></div>
              <div class="col"><label>Total</label><div style="font-weight:700">₹${(o.total_amount || 0).toFixed(2)}</div></div>
              <div class="col"><label>Payment</label><div>${o.payment_method || 'Cash'}</div></div>
            </div>
          </div>`).join('') + '</div>'}
      ${total > 20 ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        ${ordPage > 1 ? `<button class="btn-outline btn-sm" onclick="ordPage--;renderOrders()" type="button">← Prev</button>` : ''}
        ${ordPage * 20 < total ? `<button class="btn-outline btn-sm" onclick="ordPage++;renderOrders()" type="button">Next →</button>` : ''}
      </div>` : ''}`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function renderOrderDetail(params) {
  setTitle('Order #' + params.id);
  loading(true);
  try {
    const o = await get(`/orders/${params.id}`);
    loading(false);
    const itemsHtml = (o.items || []).map(i => `<tr><td>${esc(i.product_name)}</td><td>${i.quantity}</td><td>₹${(i.price || 0).toFixed(2)}</td><td>₹${((i.quantity || 0) * (i.price || 0)).toFixed(2)}</td></tr>`).join('');
    $('content-area').innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div><h3 style="font-size:18px">Order #${o.id}</h3>
          <p style="color:var(--text2);font-size:13px">${new Date(o.created_at).toLocaleString()}</p></div>
          <button class="btn-sm btn-danger" onclick="deleteOrder(${o.id})" type="button">Delete</button>
        </div>
        <table style="margin-top:12px">
          <tr><td>Customer</td><td>${esc(o.customer_name || 'Walk-in')}</td></tr>
          <tr><td>Payment</td><td>${o.payment_method || 'Cash'}</td></tr>
          <tr><td>Discount</td><td>₹${(o.discount || 0).toFixed(2)}</td></tr>
          <tr><td>Notes</td><td>${esc(o.notes || 'N/A')}</td></tr>
        </table>
      </div>
      <div class="card">
        <div class="card-title">Items (${(o.items || []).length})</div>
        <table><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr>${itemsHtml}</table>
        <div style="text-align:right;margin-top:12px;font-size:18px;font-weight:700">Total: ₹${(o.total_amount || 0).toFixed(2)}</div>
      </div>
      <button class="btn-outline btn-block" onclick="navigate('orders')" type="button">← Back to Orders</button>`;
  } catch (e) { loading(false); showToast(e.message); navigate('orders'); }
}

async function deleteOrder(id) {
  if (!confirm('Delete order #' + id + '?')) return;
  loading(true);
  try { await del(`/orders/${id}`); showToast('Deleted'); navigate('orders'); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderCustomers() {
  setTitle('Customers');
  loading(true);
  try {
    const r = await get(`/customers?page=${custPage}&limit=20`);
    const items = Array.isArray(r) ? r : r.data || [];
    const total = r.total || items.length;
    loading(false);
    $('content-area').innerHTML = `
      <button class="btn-success" style="margin-bottom:12px" onclick="navigate('customerform',{})" type="button">+ Add Customer</button>
      ${items.length === 0 ? '<div class="empty-state"><div class="icon">👥</div><h3>No Customers</h3></div>' :
        '<div>' + items.map(c => `
          <div class="item-card" style="cursor:pointer" onclick="navigate('customerdetail',{id:${c.id}})">
            <div class="item-header"><strong>${esc(c.name)}</strong><span style="font-size:12px;color:var(--text2)">${esc(c.phone || '')}</span></div>
            <p style="font-size:13px;color:var(--text2)">${esc(c.email || '')}${c.address ? ' · ' + esc(c.address) : ''}</p>
          </div>`).join('') + '</div>'}
      ${total > 20 ? `<div style="display:flex;gap:8px;justify-content:center;margin-top:12px">
        ${custPage > 1 ? `<button class="btn-outline btn-sm" onclick="custPage--;renderCustomers()" type="button">← Prev</button>` : ''}
        ${custPage * 20 < total ? `<button class="btn-outline btn-sm" onclick="custPage++;renderCustomers()" type="button">Next →</button>` : ''}
      </div>` : ''}`;
  } catch (e) { loading(false); showToast(e.message); }
}

function renderCustomerForm(params) {
  const edit = params?.id;
  setTitle(edit ? 'Edit Customer' : 'Add Customer');
  loading(true);
  if (edit) {
    get(`/customers/${edit}`).then(c => { loading(false); $('content-area').innerHTML = customerFormHtml(c); }).catch(e => { loading(false); showToast(e.message); navigate('customers'); });
  } else {
    loading(false);
    $('content-area').innerHTML = customerFormHtml(null);
  }
}

function customerFormHtml(c) {
  return `<div class="card">
    <div class="card-title">${c ? 'Edit' : 'Add'} Customer</div>
    <div class="form-group"><label>Name *</label><input id="cf-name" value="${esc(c ? c.name : '')}"></div>
    <div class="form-group"><label>Phone</label><input id="cf-phone" value="${esc(c ? c.phone || '' : '')}"></div>
    <div class="form-group"><label>Email</label><input id="cf-email" type="email" value="${esc(c ? c.email || '' : '')}"></div>
    <div class="form-group"><label>Address</label><textarea id="cf-addr">${esc(c ? c.address || '' : '')}</textarea></div>
    <button class="btn-success btn-block" onclick="saveCustomer(${c ? c.id : 'null'})" type="button">${c ? 'Update' : 'Add'} Customer</button>
    <button class="btn-outline btn-block" onclick="navigate('customers')" type="button">Cancel</button>
  </div>`;
}

async function saveCustomer(id) {
  const d = { name: $('cf-name')?.value?.trim(), phone: $('cf-phone')?.value?.trim(), email: $('cf-email')?.value?.trim(), address: $('cf-addr')?.value?.trim() };
  if (!d.name) { showToast('Name is required'); return; }
  loading(true);
  try { id ? await put(`/customers/${id}`, d) : await post('/customers', d); showToast(id ? 'Updated' : 'Added'); navigate('customers'); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderCustomerDetail(params) {
  setTitle('Customer');
  loading(true);
  try {
    const [c, orders] = await Promise.all([get(`/customers/${params.id}`), get(`/customers/${params.id}/orders`).catch(() => [])]);
    loading(false);
    const ords = Array.isArray(orders) ? orders : [];
    $('content-area').innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:start">
          <div><h3>${esc(c.name)}</h3><p style="color:var(--text2)">${esc(c.phone || '')}${c.email ? ' · ' + esc(c.email) : ''}</p></div>
          <div style="display:flex;gap:8px">
            <button class="btn-sm btn-outline" onclick="navigate('customerform',{id:${c.id}})" type="button">Edit</button>
            <button class="btn-sm btn-danger" onclick="deleteCustomer(${c.id})" type="button">Delete</button>
          </div>
        </div>
        ${c.address ? '<p style="margin-top:8px;color:var(--text2)">📍 ' + esc(c.address) + '</p>' : ''}
      </div>
      <div class="card"><div class="card-title">Orders (${ords.length})</div>
        ${ords.length === 0 ? '<p style="color:var(--text2)">No orders yet.</p>' :
          ords.map(o => `<div class="item-card" style="cursor:pointer" onclick="navigate('orderdetail',{id:${o.id}})">
            <div class="item-header"><strong>Order #${o.id}</strong><span>₹${(o.total_amount || 0).toFixed(2)}</span></div>
            <p style="font-size:12px;color:var(--text2)">${new Date(o.created_at).toLocaleDateString()} · ${o.items_count || 0} items</p>
          </div>`).join('')}
      </div>
      <button class="btn-outline btn-block" onclick="navigate('customers')" type="button">← Back</button>`;
  } catch (e) { loading(false); showToast(e.message); navigate('customers'); }
}

async function deleteCustomer(id) {
  if (!confirm('Delete this customer?')) return;
  loading(true);
  try { await del(`/customers/${id}`); showToast('Deleted'); navigate('customers'); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderReports() {
  setTitle('Reports');
  loading(true);
  try {
    const [sales, sv] = await Promise.all([
      get('/reports/sales?days=30').catch(() => ({ daily: [], total_sales: 0, total_revenue: 0, total_cost: 0 })),
      get('/reports/stock-value').catch(() => ({ total_value: 0 })),
    ]);
    loading(false);
    $('content-area').innerHTML = `
      <div class="stat-grid" style="margin-bottom:12px">
        <div class="stat-card"><div class="num">₹${(sales.total_revenue || 0).toFixed(2)}</div><div class="lbl">Revenue (30d)</div></div>
        <div class="stat-card"><div class="num">₹${(sales.total_cost || 0).toFixed(2)}</div><div class="lbl">Cost (30d)</div></div>
        <div class="stat-card"><div class="num" style="color:var(--success)">₹${((sales.total_revenue || 0) - (sales.total_cost || 0)).toFixed(2)}</div><div class="lbl">Profit (30d)</div></div>
        <div class="stat-card"><div class="num">₹${(sv.total_value || 0).toFixed(2)}</div><div class="lbl">Stock Value</div></div>
      </div>
      <div class="card"><div class="card-title">Daily Sales (Last 30 Days)</div>
        ${(sales.daily || []).length === 0 ? '<p style="color:var(--text2)">No sales data yet.</p>' :
          '<table><tr><th>Date</th><th>Orders</th><th>Revenue</th><th>Profit</th></tr>' +
          sales.daily.slice(-10).reverse().map(d => `<tr><td>${d.date}</td><td>${d.count}</td><td>₹${(d.revenue || 0).toFixed(2)}</td><td>₹${(d.profit || 0).toFixed(2)}</td></tr>`).join('') + '</table>'}
      </div>`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function renderCategories() {
  setTitle('Categories');
  loading(true);
  try {
    const items = await get('/categories');
    const list = Array.isArray(items) ? items : [];
    loading(false);
    $('content-area').innerHTML = `
      <div class="card">
        <div class="card-title">Add Category</div>
        <div class="row">
          <div class="col"><input id="cat-name" placeholder="Category name"></div>
          <div class="col" style="flex:0"><input type="color" id="cat-color" value="#007bff" style="width:50px;height:42px;padding:4px"></div>
          <div style="flex:0"><button class="btn-primary" onclick="addCategory()" type="button">Add</button></div>
        </div>
      </div>
      ${list.length === 0 ? '<div class="empty-state"><div class="icon">🏷️</div><h3>No Categories</h3></div>' :
        '<div>' + list.map(c => `
          <div class="item-card">
            <div class="item-header">
              <span><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${c.color || '#007bff'};margin-right:8px"></span>${esc(c.name)}</span>
              <button class="btn-sm btn-danger" onclick="deleteCategory(${c.id})" type="button">Delete</button>
            </div>
          </div>`).join('') + '</div>'}`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function addCategory() {
  const n = $('cat-name')?.value?.trim();
  if (!n) return;
  loading(true);
  try { await post('/categories', { name: n, color: $('cat-color')?.value || '#007bff' }); showToast('Added'); await renderCategories(); } catch (e) { showToast(e.message); }
  loading(false);
}

async function deleteCategory(id) {
  if (!confirm('Delete category?')) return;
  loading(true);
  try { await del(`/categories/${id}`); showToast('Deleted'); await renderCategories(); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderSettings() {
  setTitle('Settings');
  loading(true);
  try {
    const s = await get('/settings');
    loading(false);
    $('content-area').innerHTML = `
      <div class="card">
        <div class="card-title">Store Information</div>
        <div class="form-group"><label>Store Name</label><input id="s-name" value="${esc(s.store_name || '')}"></div>
        <div class="form-group"><label>Address</label><input id="s-addr" value="${esc(s.address || '')}"></div>
        <div class="form-group"><label>Phone</label><input id="s-phone" value="${esc(s.phone || '')}"></div>
        <div class="form-group"><label>Email</label><input id="s-email" type="email" value="${esc(s.email || '')}"></div>
        <button class="btn-success btn-block" onclick="saveSettings()" type="button">Save Settings</button>
      </div>
      <div class="card">
        <div class="card-title">Appearance</div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
          <span>Dark Mode</span>
          <button class="${isDark ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="toggleDarkMode()" type="button">${isDark ? '🌙 On' : '☀️ Off'}</button>
        </div>
      </div>
      <div class="card">
        <div class="card-title">OCR API Key</div>
        <div class="form-group"><label>OCR.space API Key</label><input id="s-ocr-key" placeholder="Enter new key to change"></div>
        <button class="btn-primary btn-sm" onclick="saveOcrKey()" type="button">Save Key</button>
      </div>
      <div class="card">
        <div class="card-title">Backup & Restore</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:12px">Export all your data as JSON or restore from a previous backup.</p>
        <button class="btn-primary btn-block" onclick="exportBackup()" type="button">⬇️ Download Backup</button>
        <button class="btn-outline btn-block" onclick="document.getElementById('restore-input').click()" type="button">⬆️ Restore from Backup</button>
        <input type="file" id="restore-input" accept=".json" style="display:none" onchange="importBackup(this)">
      </div>
      <div class="card">
        <div class="card-title">Account</div>
        <p style="font-size:13px;color:var(--text2);margin-bottom:8px">Email: ${esc(user?.email || '')}</p>
        <button class="btn-outline btn-block" onclick="showChangePinModal()" type="button">Change PIN</button>
        <button class="btn-danger btn-block" onclick="logout()" type="button">Logout</button>
      </div>`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function saveSettings() {
  const d = { store_name: $('s-name')?.value?.trim() || '', address: $('s-addr')?.value?.trim() || '', phone: $('s-phone')?.value?.trim() || '', email: $('s-email')?.value?.trim() || '' };
  loading(true);
  try { await put('/settings', d); showToast('Saved!'); } catch (e) { showToast(e.message); }
  loading(false);
}

async function saveOcrKey() {
  const k = $('s-ocr-key')?.value?.trim();
  if (!k) { showToast('Enter a key'); return; }
  loading(true);
  try { await put('/settings', { ocr_space_api_key: k }); showToast('OCR key saved!'); $('s-ocr-key').value = ''; } catch (e) { showToast(e.message); }
  loading(false);
}

function showChangePinModal() {
  openModal(`
    <h3 style="margin-bottom:12px">Change PIN</h3>
    <div class="form-group"><label>Current PIN</label><input type="password" id="cp-old" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
    <div class="form-group"><label>New PIN</label><input type="password" id="cp-new" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
    <div class="form-group"><label>Confirm PIN</label><input type="password" id="cp-confirm" inputmode="numeric" pattern="[0-9]*" maxlength="4"></div>
    <button class="btn-primary btn-block" onclick="changePin()" type="button">Change PIN</button>
    <button class="btn-outline btn-block" onclick="closeModal()" type="button">Cancel</button>
  `);
}

async function changePin() {
  const old = $('cp-old')?.value?.trim();
  const n = $('cp-new')?.value?.trim();
  const c = $('cp-confirm')?.value?.trim();
  if (n !== c) { showToast('New PINs do not match'); return; }
  if (!n || n.length !== 4 || isNaN(n)) { showToast('PIN must be 4 digits'); return; }
  loading(true);
  try {
    await post('/auth/change-pin', { old_pin: old, new_pin: n });
    lockPin = n; localStorage.setItem('lockPin', n);
    showToast('PIN changed!'); closeModal();
  } catch (e) { showToast(e.message); }
  loading(false);
}

function logout() {
  if (!confirm('Logout?')) return;
  token = null; localStorage.removeItem('token'); localStorage.removeItem('user');
  sessionStorage.removeItem('unlocked');
  renderAuth();
}

async function renderShoppingLists() {
  setTitle('Shopping Lists');
  loading(true);
  try {
    const items = await get('/shopping-lists');
    const list = Array.isArray(items) ? items : [];
    loading(false);
    $('content-area').innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <input type="text" id="sl-name" placeholder="New list name..." style="flex:1;margin-bottom:0">
        <button class="btn-success" onclick="createShoppingList()" type="button">Create</button>
      </div>
      ${list.length === 0 ? '<div class="empty-state"><div class="icon">📋</div><h3>No Lists</h3></div>' :
        '<div>' + list.map(l => `
          <div class="item-card" style="cursor:pointer" onclick="navigate('shoppinglistdetail',{id:${l.id}})">
            <div class="item-header">
              <strong>${esc(l.name)}</strong>
              <span style="font-size:12px;color:var(--text2)">${new Date(l.updated_at || l.created_at).toLocaleDateString()}</span>
            </div>
          </div>`).join('') + '</div>'}`;
  } catch (e) { loading(false); showToast(e.message); }
}

async function createShoppingList() {
  const n = $('sl-name')?.value?.trim();
  if (!n) return;
  loading(true);
  try { await post('/shopping-lists', { name: n }); showToast('Created!'); await renderShoppingLists(); } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderShoppingListDetail(params) {
  setTitle('Shopping List');
  loading(true);
  try {
    const l = await get(`/shopping-lists/${params.id}`);
    loading(false);
    $('content-area').innerHTML = `
      <div class="card">
        <div class="card-title">${esc(l.name)}</div>
        <div class="barcode-row">
          <input type="text" id="sli-name" placeholder="Item name..." style="flex:1;margin-bottom:0">
          <input type="text" id="sli-qty" placeholder="Qty" style="width:60px;margin-bottom:0">
          <button class="btn-sm btn-success" onclick="addListItem(${params.id})" type="button">Add</button>
        </div>
      </div>
      ${(!l.items || l.items.length === 0) ? '<div class="empty-state"><div class="icon">📝</div><h3>No Items</h3></div>' :
        '<div>' + l.items.map(i => `
          <div class="item-card">
            <div class="item-header">
              <span style="display:flex;align-items:center;gap:8px">
                <input type="checkbox" ${i.purchased ? 'checked' : ''} onchange="toggleListItem(${l.id},${i.id},this.checked)">
                <span style="text-decoration:${i.purchased ? 'line-through' : 'none'};opacity:${i.purchased ? 0.5 : 1}">${esc(i.item_name)}</span>
              </span>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:12px;color:var(--text2)">×${i.quantity}</span>
                <button class="btn-sm btn-danger" onclick="deleteListItem(${l.id},${i.id})" type="button">✕</button>
              </div>
            </div>
          </div>`).join('') + '</div>'}
      <button class="btn-outline btn-block" onclick="navigate('shoppinglists')" type="button">← Back</button>`;
  } catch (e) { loading(false); showToast(e.message); navigate('shoppinglists'); }
}

async function addListItem(listId) {
  const n = $('sli-name')?.value?.trim();
  const q = $('sli-qty')?.value?.trim() || '1';
  if (!n) return;
  loading(true);
  try { await post(`/shopping-lists/${listId}/items`, { item_name: n, quantity: q }); showToast('Added'); await renderShoppingListDetail({ id: listId }); } catch (e) { showToast(e.message); }
  loading(false);
}

async function toggleListItem(listId, itemId, purchased) {
  try { await put(`/shopping-lists/${listId}/items/${itemId}`, { purchased: !!purchased }); } catch (e) { showToast(e.message); }
}

async function deleteListItem(listId, itemId) {
  loading(true);
  try { await del(`/shopping-lists/${listId}/items/${itemId}`); await renderShoppingListDetail({ id: listId }); } catch (e) { showToast(e.message); }
  loading(false);
}

function emptyMultiItem() {
  return { name: '', barcode: '', is_medicine: true, tablets_per_strip: '10', strips: '', stock: '', cost_price: '', selling_price: '', category: '', expiry_date: '' };
}

function renderAddMultiple() {
  setTitle('Add Multiple Items');
  if (!multiItems) multiItems = [emptyMultiItem()];
  let html = '';
  multiItems.forEach((item, i) => {
    html += `<div class="item-card">
      <div class="item-header">
        <span class="item-number">Item #${i + 1}</span>
        ${multiItems.length > 1 ? `<button class="btn-sm btn-danger" onclick="removeMultiItem(${i})" type="button">Remove</button>` : ''}
      </div>
      <div class="form-group"><label>Product Name *</label><input id="mi-${i}-name" value="${esc(item.name)}"></div>
      <div class="form-group"><label>Barcode</label>
        <div class="barcode-row">
          <input id="mi-${i}-barcode" value="${esc(item.barcode)}" style="flex:1;margin-bottom:0">
          <button class="btn-sm btn-primary" onclick="openBarcodeModal('mi-${i}-barcode')" type="button">📷 Scan</button>
        </div>
      </div>
      <div class="toggle-pill" id="mi-${i}-toggle">
        <button class="${item.is_medicine ? 'active' : ''}" onclick="setMultiType(${i},true)" type="button">Medicine</button>
        <button class="${item.is_medicine ? '' : 'active'}" onclick="setMultiType(${i},false)" type="button">General</button>
      </div>
      <div id="mi-${i}-med" style="display:${item.is_medicine ? 'block' : 'none'}">
        <div class="row"><div class="col"><label>Tablets/Strip</label><input id="mi-${i}-tps" value="${item.tablets_per_strip}" type="number"></div>
        <div class="col"><label>Strips (stock)</label><input id="mi-${i}-strips" value="${item.strips}" type="number" placeholder="1"></div></div>
      </div>
      <div id="mi-${i}-gen" style="display:${item.is_medicine ? 'none' : 'block'}">
        <label>Stock Qty</label><input id="mi-${i}-stock" value="${item.stock}" type="number" placeholder="1">
      </div>
      <div class="row"><div class="col"><label>Cost Price</label><input id="mi-${i}-cost" value="${item.cost_price}" type="number" step="0.01"></div>
      <div class="col"><label>Selling Price</label><input id="mi-${i}-price" value="${item.selling_price}" type="number" step="0.01"></div></div>
      <div class="row"><div class="col"><label>Category</label><input id="mi-${i}-cat" value="${esc(item.category)}"></div>
      <div class="col"><label>Expiry</label><input id="mi-${i}-expiry" value="${item.expiry_date}" placeholder="MM/YYYY"></div></div>
    </div>`;
  });
  $('content-area').innerHTML = html + `
    <button class="btn-outline btn-block" onclick="addMultiItem()" type="button" style="border-style:dashed">+ Add Another Item</button>
    <button class="btn-success btn-block" onclick="submitMultiItems()" type="button" style="margin-top:12px">Save ${multiItems.filter(x => x.name).length || 0} Items to Inventory</button>`;
}

function setMultiType(i, isMed) {
  multiItems[i].is_medicine = isMed;
  renderAddMultiple();
}
function addMultiItem() { multiItems.push(emptyMultiItem()); renderAddMultiple(); }
function removeMultiItem(i) { multiItems.splice(i, 1); renderAddMultiple(); }

function collectMultiItems() {
  return multiItems.map((_, i) => {
    const tps = parseInt($(`mi-${i}-tps`)?.value) || 10;
    const strips = parseInt($(`mi-${i}-strips`)?.value) || 1;
    return {
      name: $(`mi-${i}-name`)?.value?.trim() || '',
      barcode: $(`mi-${i}-barcode`)?.value?.trim() || '',
      is_medicine: multiItems[i]?.is_medicine ?? true,
      tablets_per_strip: tps,
      quantity: (multiItems[i]?.is_medicine ?? true) ? strips : (parseInt($(`mi-${i}-stock`)?.value) || 1),
      cost_price: parseFloat($(`mi-${i}-cost`)?.value) || 0,
      selling_price: parseFloat($(`mi-${i}-price`)?.value) || 0,
      category: $(`mi-${i}-cat`)?.value?.trim() || '',
      expiry_date: $(`mi-${i}-expiry`)?.value?.trim() || '',
    };
  }).filter(x => x.name);
}

async function submitMultiItems() {
  const items = collectMultiItems();
  if (items.length === 0) { showToast('At least one item needs a name'); return; }
  loading(true);
  try {
    const r = await post('/bill-scan', { items });
    const parts = [];
    if (r.created?.length) parts.push(`${r.created.length} created`);
    if (r.updated?.length) parts.push(`${r.updated.length} updated`);
    showToast(parts.join(', ') || 'Saved!');
    multiItems = [emptyMultiItem()];
    renderAddMultiple();
  } catch (e) { showToast(e.message); }
  loading(false);
}

async function renderBills() {
  setTitle('My Bills');
  loading(true);
  try {
    const items = await get('/bills');
    const list = Array.isArray(items) ? items : [];
    loading(false);
    $('content-area').innerHTML = `
      <button class="btn-primary" style="margin-bottom:12px" onclick="uploadBill()" type="button">+ Upload Bill Photo</button>
      window._billsCache = list;
      ${list.length === 0 ? '<div class="empty-state"><div class="icon">📄</div><h3>No Bills</h3><p>Upload supplier bill photos.</p></div>' :
        list.map(b => `
          <div class="item-card" style="cursor:pointer" onclick="viewBill(${b.id})">
            <div class="item-header">
              <strong>Bill #${b.id}</strong>
              <span style="font-size:12px;color:var(--text2)">${new Date(b.created_at).toLocaleDateString()}</span>
            </div>
            ${b.notes ? '<p style="font-size:13px;color:var(--text2)">' + esc(b.notes) + '</p>' : ''}
            <img src="data:image/jpeg;base64,${b.image_data}" style="width:100%;max-height:120px;object-fit:cover;border-radius:6px;margin-top:8px" loading="lazy">
          </div>`).join('')}`;
  } catch (e) { loading(false); showToast(e.message); }
}

function uploadBill() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = 'image/*'; input.capture = 'environment';
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result?.split?.('base64,')[1];
      if (!base64) { showToast('Failed to read image'); return; }
      loading(true);
      try { await post('/bills', { image_data: base64 }); showToast('Bill saved!'); await renderBills(); } catch (err) { showToast(err.message); }
      loading(false);
    };
    reader.readAsDataURL(file);
  };
  input.click();
}

function viewBill(id) {
  const bill = Array.isArray(window._billsCache) ? window._billsCache.find(b => b.id === id) : null;
  const img = bill?.image_data || '';
  openModal(`
    <h3 style="margin-bottom:12px">Bill #${id}</h3>
    ${img ? `<img src="data:image/jpeg;base64,${img}" style="width:100%;max-height:80vh;object-fit:contain;border-radius:8px">` : '<p>Image not available</p>'}
    <button class="btn-outline btn-block" style="margin-top:12px" onclick="deleteBillFromModal(${id})" type="button">🗑 Delete</button>
    <button class="btn-outline btn-block" onclick="closeModal()" type="button">Close</button>
  `);
}

async function deleteBillFromModal(id) {
  if (!confirm('Delete this bill?')) return;
  loading(true);
  try { await del(`/bills/${id}`); showToast('Deleted'); closeModal(); await renderBills(); } catch (e) { showToast(e.message); }
  loading(false);
}

async function exportBackup() {
  loading(true);
  try {
    const data = await get('/backup/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'store-backup.json';
    a.click(); URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  } catch (e) { showToast(e.message); }
  loading(false);
}

async function importBackup(input) {
  const file = input.files?.[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (!data.products && !data.customers) { showToast('Invalid backup file'); return; }
    loading(true);
    const r = await post('/backup/import', { data });
    showToast(`Restored: ${r.products} products, ${r.customers} customers, ${r.categories} categories`);
    loading(false);
  } catch (err) { loading(false); showToast('Invalid backup: ' + err.message); }
  input.value = '';
}

(async function init() {
  if (isDark) document.body.classList.add('dark');
  const tb = $('theme-btn');
  if (tb) tb.textContent = isDark ? '☀️' : '🌙';
  if (token && user) {
    if (user.status === 'approved') { await renderView('dashboard'); }
    else { renderAuth(); }
  } else {
    renderAuth();
  }
})();
