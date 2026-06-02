const express = require('express');
const router = express.Router();
const db = require('../database');

router.get('/', (req, res) => {
  try {
    const lists = db.prepare(`
      SELECT sl.*, (SELECT COUNT(*) FROM shopping_list_items WHERE list_id = sl.id) as item_count
      FROM shopping_lists sl
      WHERE sl.user_id = ?
      ORDER BY sl.updated_at DESC
    `).all(req.user.userId);
    res.json(lists);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'List name is required' });
  }
  try {
    const result = db.prepare('INSERT INTO shopping_lists (user_id, name) VALUES (?, ?)').run(req.user.userId, name.trim());
    const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid list ID' });
  try {
    const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!list) return res.status(404).json({ error: 'Shopping list not found' });
    const items = db.prepare('SELECT * FROM shopping_list_items WHERE list_id = ? ORDER BY category, id').all(id);
    res.json({ ...list, items });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid list ID' });
  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'List name is required' });
  }
  try {
    const result = db.prepare('UPDATE shopping_lists SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?').run(name.trim(), id, req.user.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Shopping list not found' });
    const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ?').get(id);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid list ID' });
  try {
    const result = db.prepare('DELETE FROM shopping_lists WHERE id = ? AND user_id = ?').run(id, req.user.userId);
    if (result.changes === 0) return res.status(404).json({ error: 'Shopping list not found' });
    res.json({ message: 'Shopping list deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/items', (req, res) => {
  const listId = parseInt(req.params.id);
  if (isNaN(listId) || listId < 1) return res.status(400).json({ error: 'Invalid list ID' });
  const { product_id, item_name, quantity, category } = req.body;
  if (!item_name || typeof item_name !== 'string' || !item_name.trim()) {
    return res.status(400).json({ error: 'Item name is required' });
  }
  try {
    const list = db.prepare('SELECT id FROM shopping_lists WHERE id = ? AND user_id = ?').get(listId, req.user.userId);
    if (!list) return res.status(404).json({ error: 'Shopping list not found' });
    const result = db.prepare(`
      INSERT INTO shopping_list_items (list_id, product_id, item_name, quantity, category)
      VALUES (?, ?, ?, ?, ?)
    `).run(listId, product_id || null, item_name.trim(), quantity || '1', category || '');
    const item = db.prepare('SELECT * FROM shopping_list_items WHERE id = ?').get(result.lastInsertRowid);
    db.prepare('UPDATE shopping_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(listId);
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/items/:itemId', (req, res) => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId) || itemId < 1) return res.status(400).json({ error: 'Invalid item ID' });
  const { purchased, quantity, item_name } = req.body;
  try {
    const item = db.prepare(`
      SELECT si.* FROM shopping_list_items si
      JOIN shopping_lists sl ON sl.id = si.list_id
      WHERE si.id = ? AND sl.user_id = ?
    `).get(itemId, req.user.userId);
    if (!item) return res.status(404).json({ error: 'Item not found' });

    if (purchased !== undefined) {
      db.prepare('UPDATE shopping_list_items SET purchased = ? WHERE id = ?').run(purchased ? 1 : 0, itemId);
    }
    if (quantity !== undefined) {
      db.prepare('UPDATE shopping_list_items SET quantity = ? WHERE id = ?').run(String(quantity), itemId);
    }
    if (item_name !== undefined && typeof item_name === 'string' && item_name.trim()) {
      db.prepare('UPDATE shopping_list_items SET item_name = ? WHERE id = ?').run(item_name.trim(), itemId);
    }
    db.prepare('UPDATE shopping_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(item.list_id);
    const updated = db.prepare('SELECT * FROM shopping_list_items WHERE id = ?').get(itemId);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/items/:itemId', (req, res) => {
  const itemId = parseInt(req.params.itemId);
  if (isNaN(itemId) || itemId < 1) return res.status(400).json({ error: 'Invalid item ID' });
  try {
    const item = db.prepare(`
      SELECT si.* FROM shopping_list_items si
      JOIN shopping_lists sl ON sl.id = si.list_id
      WHERE si.id = ? AND sl.user_id = ?
    `).get(itemId, req.user.userId);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    db.prepare('DELETE FROM shopping_list_items WHERE id = ?').run(itemId);
    db.prepare('UPDATE shopping_lists SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(item.list_id);
    res.json({ message: 'Item removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/pdf', (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id) || id < 1) return res.status(400).json({ error: 'Invalid list ID' });
  try {
    const list = db.prepare('SELECT * FROM shopping_lists WHERE id = ? AND user_id = ?').get(id, req.user.userId);
    if (!list) return res.status(404).json({ error: 'Shopping list not found' });
    const items = db.prepare('SELECT * FROM shopping_list_items WHERE list_id = ? ORDER BY purchased, category, id').all(id);

    const createdDate = new Date(list.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const itemsRows = items.map(item => `
      <tr>
        <td style="text-align:center;width:40px;">${item.purchased ? '&#x2611;' : '&#x2610;'}</td>
        <td style="${item.purchased ? 'text-decoration:line-through;color:#999;' : ''}">${item.item_name}</td>
        <td style="text-align:center;width:80px;">${item.quantity}</td>
      </tr>
    `).join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Shopping List - ${list.name}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 30px; color: #333; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h1 { margin: 0 0 5px; font-size: 26px; color: #2c3e50; }
  .header p { margin: 0; color: #7f8c8d; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th { background: #2c3e50; color: #fff; padding: 12px 10px; text-align: left; font-size: 14px; }
  th:first-child { border-radius: 6px 0 0 0; }
  th:last-child { border-radius: 0 6px 0 0; }
  td { padding: 10px; border-bottom: 1px solid #ecf0f1; font-size: 14px; }
  tr:hover td { background: #f8f9fa; }
  .footer { text-align: center; color: #95a5a6; font-size: 12px; margin-top: 40px; border-top: 1px solid #ecf0f1; padding-top: 15px; }
</style>
</head>
<body>
  <div class="header">
    <h1>${list.name.replace(/</g, '&lt;')}</h1>
    <p>Created: ${createdDate}</p>
  </div>
  <table>
    <thead><tr><th style="width:40px;"></th><th>Item</th><th style="width:80px;">Qty</th></tr></thead>
    <tbody>${itemsRows || '<tr><td colspan="3" style="text-align:center;color:#999;">No items in this list</td></tr>'}</tbody>
  </table>
  <div class="footer">Generated on ${generatedDate}</div>
</body>
</html>`;

    res.json({ html });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
