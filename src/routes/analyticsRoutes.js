const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// GET /api/analytics/dashboard
router.get('/dashboard', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  try {
    const events = db.getEvents();
    const registrations = db.getRegistrations();
    const tasks = db.getWorkforceTasks();
    const users = db.getUsers();

    const staffMembers = users.filter(u => u.role === 'staff');
    const checkedInCount = registrations.filter(r => r.status === 'Checked In').length;
    const confirmedCount = registrations.filter(r => r.status === 'Confirmed').length;

    // Category distribution
    const categoryCounts = {};
    events.forEach(e => {
      categoryCounts[e.category] = (categoryCounts[e.category] || 0) + 1;
    });

    // Task status distribution
    const taskStatusCounts = {
      'Assigned': tasks.filter(t => t.status === 'Assigned').length,
      'In Progress': tasks.filter(t => t.status === 'In Progress').length,
      'Completed': tasks.filter(t => t.status === 'Completed').length
    };

    // Calculate total attendees and capacities
    const totalCapacity = events.reduce((sum, e) => sum + (e.capacity || 0), 0);
    const totalRegistered = events.reduce((sum, e) => sum + (e.registeredCount || 0), 0);
    const overallOccupancy = totalCapacity > 0 ? Math.round((totalRegistered / totalCapacity) * 100) : 0;
    const checkInPercentage = registrations.length > 0 ? Math.round((checkedInCount / registrations.length) * 100) : 0;

    // Recent activity log
    const recentRegistrations = [...registrations]
      .sort((a, b) => new Date(b.registeredAt) - new Date(a.registeredAt))
      .slice(0, 5)
      .map(r => ({
        type: 'registration',
        text: `${r.attendeeName} registered for ${r.eventTitle}`,
        time: r.registeredAt,
        status: r.status
      }));

    return res.json({
      success: true,
      stats: {
        totalEvents: events.length,
        totalRegistrations: registrations.length,
        checkedInAttendees: checkedInCount,
        confirmedAttendees: confirmedCount,
        totalStaff: staffMembers.length,
        totalTasks: tasks.length,
        occupancyRate: overallOccupancy,
        checkInRate: checkInPercentage,
        categoryCounts,
        taskStatusCounts,
        recentActivity: recentRegistrations
      }
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ success: false, message: 'Error generating dashboard analytics.' });
  }
});

// GET /api/analytics/export/attendees
router.get('/export/attendees', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const registrations = db.getRegistrations();
    // Generate CSV string
    const headers = ['Ticket Number', 'Attendee Name', 'Email', 'Phone', 'Event Title', 'College', 'Amount Paid', 'Status', 'Registered At', 'Checked In At'];
    const rows = registrations.map(r => [
      `"${r.ticketNumber}"`,
      `"${r.attendeeName}"`,
      `"${r.attendeeEmail}"`,
      `"${r.attendeePhone || ''}"`,
      `"${r.eventTitle.replace(/"/g, '""')}"`,
      `"${(r.college || '').replace(/"/g, '""')}"`,
      r.amountPaid || 0,
      `"${r.status}"`,
      `"${r.registeredAt}"`,
      `"${r.checkedInAt || 'N/A'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=eventforce-attendees-report.csv');
    return res.send(csvContent);
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error exporting attendee report.' });
  }
});

module.exports = router;
