const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  const { customer_id, start_date, end_date, period, search, page, limit } = req.query;
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 50));
  const offset = (pageNum - 1) * limitNum;

  let countQuery = 'SELECT COUNT(*) as total FROM orders';
  let query = 'SELECT * FROM orders';
  const params = [];
  const conditions = [];

  conditions.push('user_id = ?');
  params.push(req.user.userId);

  if (customer_id) { conditions.push('customer_id = ?'); params.push(customer_id); }
  if (start_date) { conditions.push('created_at >= ?'); params.push(start_date); }
  if (end_date) { conditions.push('created_at <= ?'); params.push(end_date); }

  if (period === 'today') {
    conditions.push("date(created_at) = date('now')");
  } else if (period === 'week') {
    conditions.push("created_at >= date('now', '-7 days')");
  } else if (period === 'month') {
    conditions.push("created_at >= date('now', '-30 days')");
  }

  if (search) {
    conditions.push('(customer_name LIKE ? OR id LIKE ? OR created_at LIKE ?)');
    params.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  const where = ' WHERE ' + conditions.join(' AND ');

  const { total } = db.prepare(countQuery + where).get(...params);
  const orders = db.prepare(query + where + ' ORDER BY created_at DESC LIMIT ? OFFSET ?').all(...params, limitNum, offset);
  res.json({ data: orders, total, page: pageNum, totalPages: Math.ceil(total / limitNum) });
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid order ID' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.userId);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
  const returns = db.prepare('SELECT * FROM returns WHERE order_id = ?').all(id);
  res.json({ ...order, items, returns });
});

router.post('/', (req, res) => {
  const { customer_id, customer_name, customer_phone, items, discount, payment_method, notes } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'At least one item is required' });
  }
  for (const item of items) {
    if (!item.product_id || isNaN(parseInt(item.product_id)) || parseInt(item.product_id) < 1 ||
        !item.quantity || isNaN(parseInt(item.quantity)) || parseInt(item.quantity) < 1) {
      return res.status(400).json({ error: 'Each item must have a valid product_id and quantity' });
    }
    item.product_id = parseInt(item.product_id);
    item.quantity = parseInt(item.quantity);
  }

  const insertOrder = db.prepare(
    `INSERT INTO orders (customer_id, customer_name, customer_phone, total_amount, discount, payment_method, notes, items_count, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertItem = db.prepare(
    `INSERT INTO order_items (order_id, product_id, product_name, product_barcode, quantity, price) VALUES (?, ?, ?, ?, ?, ?)`
  );
  const updateStock = db.prepare('UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?');

  const transaction = db.transaction(() => {
    let subtotal = 0;
    let totalItems = 0;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      if (!product) throw new Error(`Product id ${item.product_id} not found`);
      const tps = product.tablets_per_strip || 1;
      const pricePerUnit = product.price / tps;
      if (product.stock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name}. Available: ${product.stock} tablets, Requested: ${item.quantity}`);
      }
      subtotal += pricePerUnit * item.quantity;
      totalItems += item.quantity;
      updateStock.run(item.quantity, item.product_id, item.quantity);
    }

    const disc = parseFloat(discount) || 0;
    const total = Math.max(0, Math.round((subtotal - disc) * 100) / 100);

    const result = insertOrder.run(
      customer_id || null, customer_name || '', customer_phone || '',
      total, disc, payment_method || 'Cash', notes || '', totalItems, req.user.userId
    );
    const orderId = result.lastInsertRowid;

    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ?').get(item.product_id);
      const tps = product.tablets_per_strip || 1;
      insertItem.run(orderId, item.product_id, product.name, product.barcode, item.quantity, product.price / tps);
    }
    return orderId;
  });

  try {
    const orderId = transaction();
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId);
    res.status(201).json({ ...order, items: orderItems });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/return', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid order ID' });
  const { items } = req.body;
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Return items required' });
  }

  const transaction = db.transaction(() => {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!order) throw new Error('Order not found');

    let totalRefund = 0;

    for (const ret of items) {
      const orderItem = db.prepare('SELECT * FROM order_items WHERE order_id = ? AND product_id = ?')
        .get(req.params.id, ret.product_id);
      if (!orderItem) throw new Error(`Product ${ret.product_id} not in order`);

      const alreadyReturned = db.prepare(
        'SELECT COALESCE(SUM(quantity),0) as qty FROM returns WHERE order_id = ? AND product_id = ?'
      ).get(req.params.id, ret.product_id);

      const canReturn = orderItem.quantity - alreadyReturned.qty;
      if (ret.quantity > canReturn) {
        throw new Error(`Can only return ${canReturn} of this item`);
      }

      const refund = orderItem.price * ret.quantity;
      totalRefund += refund;

      db.prepare(
        'INSERT INTO returns (order_id, product_id, product_name, quantity, reason, refund_amount) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(req.params.id, ret.product_id, orderItem.product_name, ret.quantity, ret.reason || '', refund);

      db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
        .run(ret.quantity, ret.product_id);
    }

    const newTotal = Math.max(0, order.total_amount - totalRefund);
    db.prepare('UPDATE orders SET total_amount = ?, notes = notes || ? WHERE id = ?')
      .run(Math.round(newTotal * 100) / 100, ` | Return: \u20B9${totalRefund.toFixed(2)}`, req.params.id);

    return totalRefund;
  });

  try {
    const refund = transaction();
    res.json({ message: `Return processed. Refund: \u20B9${refund.toFixed(2)}`, refund });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid order ID' });
  try {
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);
    const restoreStock = db.prepare('UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    const transaction = db.transaction(() => {
      for (const item of items) restoreStock.run(item.quantity, item.product_id);
      db.prepare('DELETE FROM orders WHERE id = ?').run(req.params.id);
    });
    transaction();
    res.json({ message: 'Order deleted and stock restored' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
