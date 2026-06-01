const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../database');

router.get('/export', (req, res) => {
  const data = {
    products: db.prepare('SELECT * FROM products').all(),
    customers: db.prepare('SELECT * FROM customers').all(),
    orders: db.prepare('SELECT * FROM orders').all(),
    order_items: db.prepare('SELECT * FROM order_items').all(),
    purchases: db.prepare('SELECT * FROM purchases').all(),
    returns: db.prepare('SELECT * FROM returns').all(),
    categories: db.prepare('SELECT * FROM categories').all(),
    settings: db.prepare('SELECT * FROM store_settings').all(),
    exported_at: new Date().toISOString(),
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=store-backup-${Date.now()}.json`);
  res.json(data);
});

router.post('/stats', (req, res) => {
  const stats = {
    products: db.prepare('SELECT COUNT(*) as c FROM products').get().c,
    customers: db.prepare('SELECT COUNT(*) as c FROM customers').get().c,
    orders: db.prepare('SELECT COUNT(*) as c FROM orders').get().c,
    lowStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE min_stock > 0 AND stock <= min_stock').get().c,
    outOfStock: db.prepare('SELECT COUNT(*) as c FROM products WHERE stock <= 0').get().c,
    monthlyRevenue: db.prepare("SELECT COALESCE(SUM(total_amount),0) as c FROM orders WHERE created_at >= date('now', '-30 days')").get().c,
  };
  res.json(stats);
});

module.exports = router;
