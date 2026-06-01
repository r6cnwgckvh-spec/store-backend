const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/sales', (req, res) => {
  const { period, start_date, end_date } = req.query;

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (start_date && !dateRegex.test(start_date)) return res.status(400).json({ error: 'Invalid start_date format. Use YYYY-MM-DD' });
  if (end_date && !dateRegex.test(end_date)) return res.status(400).json({ error: 'Invalid end_date format. Use YYYY-MM-DD' });

  let dateFilter = '';
  if (period === 'today') dateFilter = "date(created_at) = date('now')";
  else if (period === 'week') dateFilter = "created_at >= datetime('now', '-7 days')";
  else if (period === 'month') dateFilter = "created_at >= datetime('now', '-30 days')";
  else if (period === 'year') dateFilter = "created_at >= datetime('now', '-365 days')";
  else if (start_date && end_date) dateFilter = `created_at >= '${start_date}' AND created_at <= '${end_date}'`;
  else dateFilter = "created_at >= datetime('now', '-30 days')";

  const summary = db.prepare(`
    SELECT
      COUNT(*) as order_count,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(SUM(discount), 0) as total_discount,
      COALESCE(SUM(items_count), 0) as total_items
    FROM orders WHERE ${dateFilter}
  `).get();

  const dailySales = db.prepare(`
    SELECT date(created_at) as date, COUNT(*) as orders, COALESCE(SUM(total_amount),0) as revenue
    FROM orders WHERE ${dateFilter}
    GROUP BY date(created_at) ORDER BY date DESC
  `).all();

  const topProducts = db.prepare(`
    SELECT oi.product_id, oi.product_name, SUM(oi.quantity) as qty,
      COALESCE(SUM(oi.price * oi.quantity),0) as revenue,
      COALESCE(SUM((oi.price - (COALESCE(p.cost_price,0) / MAX(COALESCE(p.tablets_per_strip,1),1))) * oi.quantity),0) as profit
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE ${dateFilter.replace(/created_at/g, 'o.created_at')}
    GROUP BY oi.product_id ORDER BY qty DESC LIMIT 10
  `).all();

  const paymentMethods = db.prepare(`
    SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total_amount),0) as total
    FROM orders WHERE ${dateFilter}
    GROUP BY payment_method
  `).all();

  const profitSummary = db.prepare(`
    SELECT
      COALESCE(SUM((oi.price - (COALESCE(p.cost_price,0) / MAX(COALESCE(p.tablets_per_strip,1),1))) * oi.quantity),0) as total_profit,
      COALESCE(SUM(oi.price * oi.quantity),0) as total_revenue2
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE ${dateFilter.replace(/created_at/g, 'o.created_at')}
  `).get();

  res.json({ summary, dailySales, topProducts, paymentMethods, profitSummary });
});

router.get('/stock-value', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(price * stock),0) as value FROM products').get();
  const lowStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock > 0 AND stock <= 5').get();
  const outOfStock = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock <= 0').get();
  res.json({ totalProducts: total.count, stockValue: total.value, lowStock: lowStock.count, outOfStock: outOfStock.count });
});

router.get('/price-history/:productId', (req, res) => {
  const history = db.prepare('SELECT * FROM price_history WHERE product_id = ? ORDER BY changed_at DESC').all(req.params.productId);
  res.json(history);
});

module.exports = router;
