const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'eventforce_super_secret_jwt_key_2026';

const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = db.getUsers();
    const user = users.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid token: User no longer exists.' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Token is expired or invalid.' });
  }
};

const optionalToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const users = db.getUsers();
      const user = users.find(u => u.id === decoded.id);
      if (user) {
        req.user = {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department
        };
      }
    } catch (err) {
      // Ignore invalid token in optional check
    }
  }
  next();
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires one of these roles: ${roles.join(', ')}`
      });
    }
    next();
  };
};

module.exports = {
  JWT_SECRET,
  verifyToken,
  optionalToken,
  requireRole
};
