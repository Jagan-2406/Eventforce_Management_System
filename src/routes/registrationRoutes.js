const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// POST /api/registrations/book (Register/Book ticket)
router.post('/book', verifyToken, (req, res) => {
  try {
    const { eventId, attendeeName, attendeeEmail, attendeePhone, college } = req.body;
    const userId = req.user.id;

    if (!eventId) {
      return res.status(400).json({ success: false, message: 'Event ID is required.' });
    }

    const events = db.getEvents();
    const eventIndex = events.findIndex(e => e.id === eventId);

    if (eventIndex === -1) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const event = events[eventIndex];

    // Check capacity
    if (event.registeredCount >= event.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Registration closed! This event has reached full capacity.'
      });
    }

    const registrations = db.getRegistrations();

    // Check if user already has an active registration for this event
    const existing = registrations.find(
      r => r.eventId === eventId && r.userId === userId && r.status !== 'Cancelled'
    );
    if (existing) {
      return res.status(400).json({
        success: false,
        message: `You are already registered for "${event.title}". Ticket: ${existing.ticketNumber}`
      });
    }

    // Generate unique Ticket ID
    const randomHex = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `EF-2026-T${randomHex}`;
    const qrData = `EVENTFORCE:TICKET:${ticketNumber}:${event.id}:${userId}`;

    const newRegistration = {
      id: `reg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      ticketNumber,
      eventId: event.id,
      eventTitle: event.title,
      eventDate: event.date,
      eventTime: event.time,
      eventVenue: event.venue,
      userId: userId,
      attendeeName: attendeeName || req.user.name,
      attendeeEmail: attendeeEmail || req.user.email,
      attendeePhone: attendeePhone || '',
      college: college || 'Tamil Nadu Higher Education Institution',
      amountPaid: event.ticketPrice || 0,
      status: 'Confirmed',
      qrData,
      registeredAt: new Date().toISOString(),
      checkedInAt: null
    };

    registrations.unshift(newRegistration);
    db.saveRegistrations(registrations);

    // Increment event registeredCount
    events[eventIndex].registeredCount += 1;
    db.saveEvents(events);

    return res.status(201).json({
      success: true,
      message: 'Registration successful! Your event ticket has been generated.',
      ticket: newRegistration
    });
  } catch (err) {
    console.error('Registration book error:', err);
    return res.status(500).json({ success: false, message: 'Server error processing registration.' });
  }
});

// GET /api/registrations/my-tickets (Attendee)
router.get('/my-tickets', verifyToken, (req, res) => {
  try {
    const registrations = db.getRegistrations();
    const myTickets = registrations.filter(r => r.userId === req.user.id);
    return res.json({
      success: true,
      count: myTickets.length,
      tickets: myTickets
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving tickets.' });
  }
});

// GET /api/registrations/event/:eventId (Admin or Staff)
router.get('/event/:eventId', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  try {
    const registrations = db.getRegistrations();
    const eventRegistrations = registrations.filter(r => r.eventId === req.params.eventId);
    return res.json({
      success: true,
      count: eventRegistrations.length,
      registrations: eventRegistrations
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving event registrations.' });
  }
});

// POST /api/registrations/check-in (Staff or Admin verify ticket at entry desk)
router.post('/check-in', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  try {
    const { ticketIdentifier } = req.body; // Can be ticketNumber or full QR code text

    if (!ticketIdentifier) {
      return res.status(400).json({ success: false, message: 'Please provide ticket number or QR data.' });
    }

    const registrations = db.getRegistrations();
    const index = registrations.findIndex(
      r => r.ticketNumber.toUpperCase() === ticketIdentifier.trim().toUpperCase() ||
           r.qrData === ticketIdentifier.trim()
    );

    if (index === -1) {
      return res.status(404).json({
        success: false,
        message: 'Invalid Ticket! No matching registration found in EventForce database.'
      });
    }

    const reg = registrations[index];

    if (reg.status === 'Checked In') {
      return res.status(400).json({
        success: false,
        alreadyCheckedIn: true,
        message: `Warning: This ticket was ALREADY checked in on ${new Date(reg.checkedInAt).toLocaleTimeString()}!`,
        ticket: reg
      });
    }

    if (reg.status === 'Cancelled') {
      return res.status(400).json({
        success: false,
        message: 'Denied: This ticket registration has been cancelled.'
      });
    }

    // Mark as Checked In
    reg.status = 'Checked In';
    reg.checkedInAt = new Date().toISOString();
    reg.verifiedBy = req.user.name;

    registrations[index] = reg;
    db.saveRegistrations(registrations);

    return res.json({
      success: true,
      message: `Check-in Verified! Welcome ${reg.attendeeName}.`,
      ticket: reg
    });
  } catch (err) {
    console.error('Check-in error:', err);
    return res.status(500).json({ success: false, message: 'Error checking in attendee.' });
  }
});

// POST /api/registrations/cancel/:id
router.post('/cancel/:id', verifyToken, (req, res) => {
  try {
    const registrations = db.getRegistrations();
    const index = registrations.findIndex(r => r.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Ticket not found.' });
    }

    const reg = registrations[index];

    // Only owner or admin can cancel
    if (reg.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Unauthorized to cancel this registration.' });
    }

    reg.status = 'Cancelled';
    registrations[index] = reg;
    db.saveRegistrations(registrations);

    // Decrement event registered count
    const events = db.getEvents();
    const evt = events.find(e => e.id === reg.eventId);
    if (evt && evt.registeredCount > 0) {
      evt.registeredCount -= 1;
      db.saveEvents(events);
    }

    return res.json({
      success: true,
      message: 'Registration successfully cancelled.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error cancelling registration.' });
  }
});

module.exports = router;
