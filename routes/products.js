const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { search, category, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  let countQuery = 'SELECT COUNT(*) as total FROM products';
  let query = 'SELECT * FROM products';
  const params = [];
  const conditions = [];

  if (search) {
    conditions.push('(name LIKE ? OR barcode LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    conditions.push('category = ?');
    params.push(category);
  }

  const where = conditions.length > 0 ? ' WHERE ' + conditions.join(' AND ') : '';

  const { total } = db.prepare(countQuery + where).get(...params);
  const products = db.prepare(query + where + ' ORDER BY updated_at DESC LIMIT ? OFFSET ?').all(...params, limitNum, offset);
  res.json({ data: products, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

router.get('/low-stock', (req, res) => {
  const threshold = parseInt(req.query.threshold) || 5;
  const products = db.prepare('SELECT * FROM products WHERE stock <= ? ORDER BY stock ASC').all(threshold);
  res.json(products);
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid product ID' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.get('/barcode/:barcode', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE barcode = ?').get(req.params.barcode);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

router.post('/', (req, res) => {
  const { barcode, name, price, stock, description, category, size, cost_price, min_stock, expiry_date, image_url, tablets_per_strip } = req.body;
  if (!barcode || typeof barcode !== 'string' || !barcode.trim()) {
    return res.status(400).json({ error: 'Valid barcode is required' });
  }
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Valid product name is required' });
  }

  try {
    const existing = db.prepare('SELECT id FROM products WHERE barcode = ?').get(barcode.trim());
    if (existing) {
      return res.status(409).json({ error: 'Product with this barcode already exists', productId: existing.id });
    }

    const pPrice = Math.max(0, parseFloat(price) || 0);
    const pStock = Math.max(0, parseInt(stock) || 0);
    const pCost = Math.max(0, parseFloat(cost_price) || 0);
    const pMinStock = Math.max(0, parseInt(min_stock) || 0);
    const pTps = Math.max(1, parseInt(tablets_per_strip) || 1);

    const result = db.prepare(`
      INSERT INTO products (barcode, name, price, stock, description, category, size, cost_price, min_stock, expiry_date, image_url, tablets_per_strip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(barcode.trim(), name.trim(), pPrice, pStock, (description || '').trim(), category || '', size || '',
      pCost, pMinStock, expiry_date || '', image_url || '', pTps);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const { name, price, stock, description, category, size, cost_price, min_stock, expiry_date, image_url, tablets_per_strip } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Valid product name is required' });
  }
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid product ID' });

    const old = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    if (!old) return res.status(404).json({ error: 'Product not found' });

    const pPrice = parseFloat(price);
    if (price !== undefined && !isNaN(pPrice) && pPrice !== old.price) {
      db.prepare('INSERT INTO price_history (product_id, old_price, new_price) VALUES (?, ?, ?)')
        .run(id, old.price, pPrice);
    }

    const pStock = stock !== undefined ? Math.max(0, parseInt(stock) || 0) : old.stock;
    const pCost = Math.max(0, parseFloat(cost_price) || 0);
    const pMinStock = Math.max(0, parseInt(min_stock) || 0);
    const pTps = Math.max(1, parseInt(tablets_per_strip) || 1);
    const pFinalPrice = !isNaN(pPrice) ? pPrice : old.price;

    db.prepare(`
      UPDATE products SET name = ?, price = ?, stock = ?, description = ?, category = ?, size = ?,
        cost_price = ?, min_stock = ?, expiry_date = ?, image_url = ?, tablets_per_strip = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name.trim(), pFinalPrice, pStock, (description || '').trim(), category || '', size || '',
      pCost, pMinStock, expiry_date || '', image_url || '', pTps, id);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/stock', (req, res) => {
  const { stock } = req.body;
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid product ID' });
  if (stock === undefined || isNaN(parseInt(stock)) || parseInt(stock) < 0) {
    return res.status(400).json({ error: 'Valid non-negative stock value is required' });
  }
  try {
    const pStock = parseInt(stock);
    const result = db.prepare('UPDATE products SET stock = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(pStock, id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/low-stock-by-min', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE min_stock > 0 AND stock <= min_stock ORDER BY stock ASC').all();
  res.json(products);
});

router.get('/near-expiry', (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const products = db.prepare(
    "SELECT * FROM products WHERE expiry_date != '' AND expiry_date >= date('now') AND expiry_date <= date('now', ?)"
  ).all(`+${days} days`);
  res.json(products);
});

router.post('/bulk-update', (req, res) => {
  const { ids, field, value } = req.body;
  if (!ids || !Array.isArray(ids) || ids.length === 0 || !field) {
    return res.status(400).json({ error: 'ids array and field required' });
  }
  const allowed = ['price', 'stock', 'category', 'min_stock', 'cost_price'];
  if (!allowed.includes(field)) return res.status(400).json({ error: 'Invalid field' });

  try {
    const stmt = db.prepare(`UPDATE products SET ${field} = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`);
    const tx = db.transaction(() => { for (const id of ids) stmt.run(value, id); });
    tx();
    res.json({ message: `Updated ${ids.length} products` });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid product ID' });
  try {
    const result = db.prepare('DELETE FROM products WHERE id = ?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ message: 'Product deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
