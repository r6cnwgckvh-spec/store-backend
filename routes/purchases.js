const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { limit } = req.query;
  let query = 'SELECT * FROM purchases ORDER BY created_at DESC';
  if (limit) query += ' LIMIT ?';
  res.json(db.prepare(query).all(...(limit ? [parseInt(limit)] : [])));
});

router.post('/', (req, res) => {
  const { product_id, quantity, cost_price, supplier, notes } = req.body;
  if (!product_id || !quantity) return res.status(400).json({ error: 'Product ID and quantity required' });

  const transaction = db.transaction(() => {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    if (!product) throw new Error('Product not found');

    db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(quantity, product_id);

    const result = db.prepare(
      'INSERT INTO purchases (product_id, product_name, quantity, cost_price, supplier, notes) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(product_id, product.name, quantity, cost_price || 0, supplier || '', notes || '');

    return result.lastInsertRowid;
  });

  try {
    const id = transaction();
    const purchase = db.prepare('SELECT * FROM purchases WHERE id = ?').get(id);
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(product_id);
    res.status(201).json({ purchase, product });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
