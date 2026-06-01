const jwt = require('jsonwebtoken');
const db = require('../database');

const publicRoutes = ['/api/health', '/api/auth/login', '/api/auth/status',
  '/api/auth/register', '/api/auth/check-status',
  '/api/images/', '/api/admin/'];

function getSecret() {
  const row = db.prepare('SELECT jwt_secret FROM store_settings WHERE id = 1').get();
  return row?.jwt_secret || 'fallback-dev-secret';
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
