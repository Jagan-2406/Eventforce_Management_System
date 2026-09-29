const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./src/config/db');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const eventRoutes = require('./src/routes/eventRoutes');
const registrationRoutes = require('./src/routes/registrationRoutes');
const workforceRoutes = require('./src/routes/workforceRoutes');
const analyticsRoutes = require('./src/routes/analyticsRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/workforce', workforceRoutes);
app.use('/api/analytics', analyticsRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    service: 'EventForce Management System API',
    version: '1.0.0'
  });
});

// Fallback to index.html for SPA client-side routes
app.get('*', (req, res) => {
  // If request is for an api endpoint that wasn't matched
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ success: false, message: 'API Endpoint not found.' });
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(500).json({
    success: false,
    message: 'An unexpected server error occurred.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 EventForce Management System Server Running!`);
  console.log(`📡 URL: http://localhost:${PORT}`);
  console.log(`📁 Database: Local persistent JSON DB connected`);
  console.log(`🎓 Designed for: Naan Mudhalvan Capstone Submission`);
  console.log('====================================================');
  console.log('Default Demo Login Credentials:');
  console.log('  👑 Admin / Director: admin@eventforce.com / admin123');
  console.log('  👷 Staff / Crew:     staff1@eventforce.com / staff123');
  console.log('  🎓 Student Attendee: attendee@eventforce.com / user123');
  console.log('====================================================');
});
