const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const db = require('../database');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again in 15 minutes.' },
});

function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function getSecret() {
  const row = db.prepare('SELECT jwt_secret, id FROM store_settings WHERE user_id = 1').get();
  if (row?.jwt_secret) return row.jwt_secret;
  const secret = crypto.randomBytes(32).toString('hex');
  if (row?.id) {
    db.prepare('UPDATE store_settings SET jwt_secret = ? WHERE id = ?').run(secret, row.id);
  } else {
    db.prepare('INSERT INTO store_settings (user_id, jwt_secret, store_name, address, phone) VALUES (1, ?, ?, ?, ?)').run(secret, 'Your Store Name', '123 Main Street, City', '+91 98765 43210');
  }
  return secret;
}

function signToken(user) {
  return jwt.sign({ userId: user.id, role: user.role, email: user.email }, getSecret(), { expiresIn: '30d' });
}

function sanitizeUser(user) {
  if (!user) return null;
  return { id: user.id, name: user.name, email: user.email, status: user.status, role: user.role, has_pin: !!user.pin_hash, created_at: user.created_at };
}

router.get('/status', (req, res) => {
  const count = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const legacy = db.prepare('SELECT auth_pin FROM store_settings WHERE user_id = 1').get();
  res.json({ hasPin: count > 0 || !!(legacy?.auth_pin) });
});



router.post('/register', authLimiter, (req, res) => {
  const { name, email } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!email || typeof email !== 'string' || !email.includes('@')) return res.status(400).json({ error: 'Valid email is required' });

  const existing = db.prepare('SELECT id, status FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (existing) {
    if (existing.status === 'pending') return res.status(400).json({ error: 'Registration already submitted. Waiting for admin approval.' });
    if (existing.status === 'approved') return res.status(400).json({ error: 'This email is already registered. Please login.' });
    if (existing.status === 'rejected') return res.status(400).json({ error: 'Your registration was rejected. Contact admin.' });
  }

  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const role = userCount === 0 ? 'admin' : 'user';
  const status = role === 'admin' ? 'approved' : 'pending';

  try {
    const result = db.prepare('INSERT INTO users (email, name, status, role) VALUES (?, ?, ?, ?)').run(
      email.trim().toLowerCase(), name.trim(), status, role
    );
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(result.lastInsertRowid);

    if (role === 'admin') {
      const token = signToken(user);
      return res.json({ token, user: sanitizeUser(user), message: 'Welcome! You are the admin. Set your PIN to continue.' });
    }
    res.json({ user: sanitizeUser(user), message: 'Registration submitted. Wait for admin approval.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/login', authLimiter, (req, res) => {
  const { pin, email } = req.body;
  if (!pin) return res.status(400).json({ error: 'PIN is required' });

  // Try new multi-user login
  if (email) {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (!user) return res.status(400).json({ error: 'No account found with this email. Please register first.' });
    if (user.status !== 'approved') return res.status(403).json({ error: 'Account not approved yet' });
    if (!user.pin_hash) return res.status(400).json({ error: 'PIN not set up. Please set your PIN first.' });
    if (hashPin(pin) !== user.pin_hash) return res.status(400).json({ error: 'Wrong PIN. Try again.' });
    const token = signToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  }

  // Legacy single-user auth (backward compat)
  const row = db.prepare('SELECT auth_pin FROM store_settings WHERE user_id = 1').get();
  if (row?.auth_pin) {
    if (hashPin(pin) === row.auth_pin) {
      const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
      if (userCount === 0) {
        const secret = getSecret();
        const token = jwt.sign({ role: 'admin' }, secret, { expiresIn: '30d' });
        return res.json({ token, user: { id: 0, name: 'Admin', email: '', role: 'admin' } });
      }
    }
  }

  return res.status(400).json({ error: 'No account registered. Please register first.' });
});

router.post('/check-status', authLimiter, (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
  if (!user) return res.json({ registered: false });
  if (user.status === 'pending') return res.json({ status: 'pending', message: 'Waiting for admin approval.' });
  if (user.status === 'rejected') return res.json({ status: 'rejected', message: 'Registration rejected.' });
  if (user.status === 'approved') {
    const result = { status: 'approved', hasPin: !!user.pin_hash, user: sanitizeUser(user) };
    if (!user.pin_hash) {
      const setupToken = jwt.sign({ userId: user.id, role: user.role, purpose: 'setup' }, getSecret(), { expiresIn: '1h' });
      result.setupToken = setupToken;
      result.message = 'Set your PIN to continue.';
    } else {
      result.message = 'You can login with your PIN.';
    }
    return res.json(result);
  }
});

router.post('/set-pin', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const secret = getSecret();
  let decoded;
  try { decoded = jwt.verify(header.slice(7), secret); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { pin } = req.body;
  if (!pin || typeof pin !== 'string' || pin.length < 4) return res.status(400).json({ error: 'PIN must be at least 4 digits' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.status !== 'approved') return res.status(403).json({ error: 'Account not approved yet' });
  if (user.pin_hash) return res.status(400).json({ error: 'PIN already set. Use change-pin to update.' });

  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(pin), user.id);
  const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
  const token = signToken(updated);
  res.json({ token, user: sanitizeUser(updated), message: 'PIN set successfully!' });
});

router.post('/change-pin', authLimiter, (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  const secret = getSecret();
  let decoded;
  try { decoded = jwt.verify(header.slice(7), secret); } catch { return res.status(401).json({ error: 'Invalid or expired token' }); }

  const { oldPin, newPin } = req.body;
  if (!oldPin || !newPin || newPin.length < 4) return res.status(400).json({ error: 'New PIN must be at least 4 digits' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (hashPin(oldPin) !== user.pin_hash) return res.status(401).json({ error: 'Wrong current PIN' });

  db.prepare('UPDATE users SET pin_hash = ? WHERE id = ?').run(hashPin(newPin), user.id);
  const token = signToken({ ...user, pin_hash: hashPin(newPin) });
  res.json({ token, message: 'PIN changed successfully' });
});

router.get('/me', (req, res) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return res.status(401).json({ error: 'Authentication required' });
  try {
    const decoded = jwt.verify(header.slice(7), getSecret());
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.userId);
    if (!user) return res.status(401).json({ error: 'Account deleted. Please register again.' });
    res.json(sanitizeUser(user));
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
});

router.post('/setup', (req, res) => {
  const { email, pin } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email?.trim().toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });

  const transaction = db.transaction(() => {
    db.prepare('UPDATE users SET role = ?, status = ?, pin_hash = ? WHERE id = ?')
      .run('admin', 'approved', hashPin(pin), user.id);
    const others = db.prepare('SELECT id FROM users WHERE id != ?').all(user.id);
    for (const o of others) {
      const id = o.id;
      const prodIds = db.prepare('SELECT id FROM products WHERE user_id = ?').all(id).map(r => r.id);
      for (const pid of prodIds) {
        db.prepare('DELETE FROM order_items WHERE product_id = ?').run(pid);
      }
      db.prepare('DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE user_id = ?)').run(id);
      db.prepare('DELETE FROM orders WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM products WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM customers WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM purchases WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM categories WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM shopping_list_items WHERE list_id IN (SELECT id FROM shopping_lists WHERE user_id = ?)').run(id);
      db.prepare('DELETE FROM shopping_lists WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM bills WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM store_settings WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    }
  });
  transaction();
  res.json({ message: 'Admin setup complete. Other users deleted.' });
});

module.exports = router;
