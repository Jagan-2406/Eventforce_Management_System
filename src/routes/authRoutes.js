const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const { JWT_SECRET, verifyToken, requireRole } = require('../middleware/authMiddleware');

// Generate JWT helper
const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { name, email, password, role = 'attendee', phone, department, specialization } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });
    }

    const users = db.getUsers();
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(password, salt);

    const newUser = {
      id: `usr-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role: ['admin', 'staff', 'attendee'].includes(role) ? role : 'attendee',
      phone: phone || '',
      department: department || '',
      specialization: specialization || '',
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name.trim())}`,
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    db.saveUsers(users);

    const token = generateToken(newUser);

    // Exclude password in response
    const { password: _, ...userWithoutPassword } = newUser;

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Welcome to EventForce.',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide both email and password.' });
    }

    const users = db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials. User not found.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid password. Please try again.' });
    }

    const token = generateToken(user);
    const { password: _, ...userWithoutPassword } = user;

    return res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  try {
    const users = db.getUsers();
    const user = users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ success: true, user: userWithoutPassword });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error fetching profile.' });
  }
});

// GET /api/auth/demo-credentials
// Useful for evaluators and students during live presentation!
router.get('/demo-credentials', (req, res) => {
  return res.json({
    success: true,
    accounts: [
      {
        role: 'Admin / Event Director',
        email: 'admin@eventforce.com',
        password: 'admin123',
        description: 'Full control to create events, allocate workforce, and monitor analytics.'
      },
      {
        role: 'Staff / Workforce Member',
        email: 'staff1@eventforce.com',
        password: 'staff123',
        description: 'View assigned shifts, update task progress, and check-in guests.'
      },
      {
        role: 'Attendee / Student',
        email: 'attendee@eventforce.com',
        password: 'user123',
        description: 'Browse campus events, book tickets with instant QR passes.'
      }
    ]
  });
});

// GET /api/auth/users (for assigning tasks to staff)
router.get('/users', verifyToken, (req, res) => {
  try {
    const { role } = req.query;
    let users = db.getUsers();
    if (role) {
      users = users.filter(u => u.role === role);
    }
    const sanitized = users.map(({ password, ...rest }) => rest);
    return res.json({ success: true, count: sanitized.length, users: sanitized });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving users.' });
  }
});

module.exports = router;
