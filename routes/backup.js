const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

router.get('/export', (req, res) => {
  const data = {
    products: db.prepare('SELECT * FROM products WHERE user_id = ?').all(req.user.userId),
    customers: db.prepare('SELECT * FROM customers WHERE user_id = ?').all(req.user.userId),
    orders: db.prepare('SELECT * FROM orders WHERE user_id = ?').all(req.user.userId),
    order_items: db.prepare('SELECT oi.* FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = ?').all(req.user.userId),
    purchases: db.prepare('SELECT * FROM purchases WHERE user_id = ?').all(req.user.userId),
    returns: db.prepare('SELECT r.* FROM returns r JOIN orders o ON r.order_id = o.id WHERE o.user_id = ?').all(req.user.userId),
    categories: db.prepare('SELECT * FROM categories WHERE user_id = ?').all(req.user.userId),
    settings: db.prepare('SELECT * FROM store_settings').all(),
    exported_at: new Date().toISOString(),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=store-backup-${Date.now()}.json`);
  res.json(data);
});

router.post('/stats', (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) as c FROM products WHERE user_id = ?').get(req.user.userId).c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers WHERE user_id = ?').get(req.user.userId).c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders WHERE user_id = ?').get(req.user.userId).c,
    lowStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE min_stock > 0 AND stock <= min_stock AND user_id = ?').get(req.user.userId).c,
    outOfStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock <= 0 AND user_id = ?').get(req.user.userId).c,
    monthlyRevenue: db.prepare("SELECT COALESCE(SUM(total_amount),0) as c FROM orders WHERE user_id = ? AND created_at >= date('now', '-30 days')").get(req.user.userId).c,
  };
  res.json(stats);
});

module.exports = router;
