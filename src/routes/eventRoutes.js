const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole, optionalToken } = require('../middleware/authMiddleware');

// GET /api/events (Public, with filters & search)
router.get('/', optionalToken, (req, res) => {
  try {
    let events = db.getEvents();
    const { category, search, status, sort } = req.query;

    if (category && category !== 'All') {
      events = events.filter(e => e.category.toLowerCase() === category.toLowerCase());
    }

    if (status && status !== 'All') {
      events = events.filter(e => e.status.toLowerCase() === status.toLowerCase());
    }

    if (search && search.trim() !== '') {
      const q = search.trim().toLowerCase();
      events = events.filter(e =>
        e.title.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.venue.toLowerCase().includes(q) ||
        (e.tags && e.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Sort: date-asc (default), date-desc, popular
    if (sort === 'date-desc') {
      events.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else if (sort === 'popular') {
      events.sort((a, b) => b.registeredCount - a.registeredCount);
    } else {
      events.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    return res.json({
      success: true,
      count: events.length,
      events
    });
  } catch (err) {
    console.error('Error fetching events:', err);
    return res.status(500).json({ success: false, message: 'Server error fetching events.' });
  }
});

// GET /api/events/categories/list
router.get('/categories/list', (req, res) => {
  const events = db.getEvents();
  const categories = ['Conference', 'Technical', 'Cultural', 'Sports', 'Workshop'];
  const counts = categories.map(cat => ({
    name: cat,
    count: events.filter(e => e.category === cat).length
  }));
  return res.json({ success: true, categories: counts });
});

// GET /api/events/:id
router.get('/:id', optionalToken, (req, res) => {
  try {
    const events = db.getEvents();
    const event = events.find(e => e.id === req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    // Include assigned workforce tasks for this event
    const tasks = db.getWorkforceTasks().filter(t => t.eventId === event.id);
    const registrations = db.getRegistrations().filter(r => r.eventId === event.id);
    const feedbacks = db.getFeedbacks ? db.getFeedbacks().filter(f => f.eventId === event.id) : [];

    // Check if current user is registered
    let isUserRegistered = false;
    let userTicket = null;
    if (req.user) {
      const reg = registrations.find(r => r.userId === req.user.id && r.status !== 'Cancelled');
      if (reg) {
        isUserRegistered = true;
        userTicket = reg;
      }
    }

    return res.json({
      success: true,
      event: {
        ...event,
        seatsLeft: Math.max(0, event.capacity - event.registeredCount),
        workforceCrewCount: tasks.length,
        isUserRegistered,
        userTicket,
        speakers: event.speakers || [],
        sponsors: event.sponsors || [],
        agenda: event.agenda || [],
        feedbacks: feedbacks || []
      },
      workforceTasks: tasks
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving event details.' });
  }
});

// POST /api/events/:id/feedback (Submit Attendee Feedback)
router.post('/:id/feedback', verifyToken, (req, res) => {
  try {
    const { rating, comment } = req.body;
    const events = db.getEvents();
    const event = events.find(e => e.id === req.params.id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const feedbacks = db.getFeedbacks();
    const newFeedback = {
      id: `fb-${Date.now().toString(36)}`,
      eventId: event.id,
      eventTitle: event.title,
      userId: req.user.id,
      attendeeName: req.user.name,
      rating: parseInt(rating, 10) || 5,
      comment: comment ? comment.trim() : 'Great event!',
      date: new Date().toISOString().split('T')[0]
    };

    feedbacks.unshift(newFeedback);
    db.saveFeedbacks(feedbacks);

    return res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully! Thank you.',
      feedback: newFeedback
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error submitting feedback.' });
  }
});

// POST /api/events (Admin/Organizer only)
router.post('/', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const {
      title,
      category,
      description,
      date,
      time,
      venue,
      capacity = 100,
      ticketPrice = 0,
      bannerUrl,
      organizerName,
      tags = [],
      speakers = [],
      agenda = []
    } = req.body;

    if (!title || !category || !date || !venue) {
      return res.status(400).json({
        success: false,
        message: 'Title, category, date, and venue are mandatory fields.'
      });
    }

    const defaultBanners = {
      'Technical': 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      'Conference': 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80',
      'Cultural': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80',
      'Sports': 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
      'Workshop': 'https://images.unsplash.com/photo-1531403009284-440f080d1e12?auto=format&fit=crop&w=1200&q=80'
    };

    const newEvent = {
      id: `evt-${Date.now().toString(36)}`,
      title: title.trim(),
      category: category.trim(),
      description: description ? description.trim() : 'Join us for this exciting upcoming event organized under EventForce.',
      date: date,
      time: time || '10:00 AM - 05:00 PM',
      venue: venue.trim(),
      capacity: parseInt(capacity, 10) || 100,
      registeredCount: 0,
      ticketPrice: parseFloat(ticketPrice) || 0,
      status: 'Upcoming',
      bannerUrl: bannerUrl && bannerUrl.trim() !== '' ? bannerUrl.trim() : (defaultBanners[category] || defaultBanners['Conference']),
      organizerName: organizerName || req.user.name,
      tags: Array.isArray(tags) ? tags : (typeof tags === 'string' ? tags.split(',').map(t => t.trim()) : [category]),
      speakers: speakers || [],
      sponsors: [
        { name: 'Google Cloud', tier: 'Partner', logo: 'https://images.unsplash.com/photo-1572021335469-31706a17aaef?auto=format&fit=crop&w=120&q=80' },
        { name: 'Salesforce', tier: 'Partner', logo: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80' }
      ],
      agenda: agenda || [
        { time: '10:00 AM', title: 'Opening Remarks & Keynote', speaker: req.user.name, room: 'Main Hall' },
        { time: '02:00 PM', title: 'Breakout Sessions', speaker: 'Industry Experts', room: 'Conference Hall B' }
      ],
      createdAt: new Date().toISOString()
    };

    const events = db.getEvents();
    events.unshift(newEvent);
    db.saveEvents(events);

    return res.status(201).json({
      success: true,
      message: 'Event created and published successfully!',
      event: newEvent
    });
  } catch (err) {
    console.error('Create event error:', err);
    return res.status(500).json({ success: false, message: 'Server error while creating event.' });
  }
});

// PUT /api/events/:id (Admin only)
router.put('/:id', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const events = db.getEvents();
    const index = events.findIndex(e => e.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    const current = events[index];
    const updated = {
      ...current,
      ...req.body,
      id: current.id,
      registeredCount: current.registeredCount,
      capacity: req.body.capacity ? parseInt(req.body.capacity, 10) : current.capacity,
      ticketPrice: req.body.ticketPrice !== undefined ? parseFloat(req.body.ticketPrice) : current.ticketPrice,
      updatedAt: new Date().toISOString()
    };

    events[index] = updated;
    db.saveEvents(events);

    return res.json({
      success: true,
      message: 'Event updated successfully!',
      event: updated
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error updating event.' });
  }
});

// DELETE /api/events/:id (Admin only)
router.delete('/:id', verifyToken, requireRole('admin'), (req, res) => {
  try {
    let events = db.getEvents();
    const target = events.find(e => e.id === req.params.id);

    if (!target) {
      return res.status(404).json({ success: false, message: 'Event not found.' });
    }

    events = events.filter(e => e.id !== req.params.id);
    db.saveEvents(events);

    let tasks = db.getWorkforceTasks().filter(t => t.eventId !== req.params.id);
    db.saveWorkforceTasks(tasks);

    return res.json({
      success: true,
      message: `Event "${target.title}" and its workforce assignments were deleted.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error deleting event.' });
  }
});

module.exports = router;
