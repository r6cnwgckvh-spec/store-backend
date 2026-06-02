const jwt = require('jsonwebtoken');
const db = require('../database');

const publicRoutes = ['/api/health', '/api/auth/login', '/api/auth/status',
  '/api/auth/register', '/api/auth/check-status',
  '/api/images/', '/api/admin/'];

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

function authMiddleware(req, res, next) {
  if (publicRoutes.some(r => req.path.startsWith(r))) {
    return next();
  }

  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  try {
    const decoded = jwt.verify(header.slice(7), getSecret());
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = authMiddleware;
