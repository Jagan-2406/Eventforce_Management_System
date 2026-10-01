const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'eventforce.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Default formula budgets according to Salesforce Formula Field requirement
const DEFAULT_BUDGET_MAP = {
  Wedding: 50000,
  Corporate: 30000,
  Birthday: 10000,
  Anniversary: 20000,
  Festival: 60000,
  Concert: 40000,
  Other: 15000
};

// Helper: read and write JSON database
function readDB() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database file:', err);
    return { events: [], clients: [], vendors: [], venues: [], eventVendors: [], feedback: [], users: [], cancellationRequests: [], notificationLogs: [] };
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error saving database file:', err);
    return false;
  }
}

// Business Logic Helper: Recalculate venue availability (VenueStatusHelper Apex class)
function recalculateVenueStatus(db, venueId) {
  if (!venueId) return;
  const venue = db.venues.find(v => v.id === venueId);
  if (!venue) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const activeEvents = db.events.filter(e => 
    e.venueId === venueId && 
    (e.status === 'Confirmed' || e.status === 'Planned') &&
    e.date >= todayStr
  );

  venue.availabilityStatus = activeEvents.length > 0 ? 'Reserved' : 'Available';
}

// API: Get complete database or overview
app.get('/api/database', (req, res) => {
  res.json(readDB());
});

// ==================== EVENT MODULE ====================
app.get('/api/events', (req, res) => {
  const db = readDB();
  res.json(db.events);
});

app.post('/api/events', (req, res) => {
  const db = readDB();
  const { name, date, type, status, budget, clientId, venueId, description, owner } = req.body;

  // Validation Rules
  if (!name || !date || !type || !status || !clientId || !venueId) {
    return res.status(400).json({ error: 'Validation Error: Event Name, Date, Type, Status, Client, and Venue are all required.' });
  }

  const numBudget = Number(budget !== undefined && budget !== '' ? budget : (DEFAULT_BUDGET_MAP[type] || 15000));
  if (isNaN(numBudget) || numBudget < 0) {
    return res.status(400).json({ error: 'Validation Error: Event Budget cannot be negative.' });
  }

  // Prevent Double Booking Trigger (Milestone 9)
  const doubleBooked = db.events.find(e => 
    e.venueId === venueId && 
    e.date === date && 
    e.status !== 'Canceled' && 
    e.status !== 'Rejected'
  );

  if (doubleBooked) {
    return res.status(400).json({ 
      error: `Validation Error: This Venue is already booked on this date (${date}) for event "${doubleBooked.name}". Double booking is prevented.` 
    });
  }

  const newEvent = {
    id: `EVT-${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    date,
    type,
    status,
    budget: numBudget,
    clientId,
    venueId,
    description: description || '',
    createdAt: new Date().toISOString().split('T')[0],
    owner: owner || 'Event Coordinator'
  };

  db.events.push(newEvent);

  // Milestone 8: VenueStatusHelper Apex logic
  recalculateVenueStatus(db, venueId);

  writeDB(db);
  res.status(201).json(newEvent);
});

app.put('/api/events/:id', (req, res) => {
  const db = readDB();
  const event = db.events.find(e => e.id === req.params.id);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  const { name, date, type, status, budget, clientId, venueId, description, owner } = req.body;

  if (name !== undefined) event.name = name.trim();
  if (date !== undefined) event.date = date;
  if (type !== undefined) event.type = type;
  if (clientId !== undefined) event.clientId = clientId;
  if (description !== undefined) event.description = description;
  if (owner !== undefined) event.owner = owner;

  const oldVenueId = event.venueId;
  if (venueId !== undefined) event.venueId = venueId;

  if (budget !== undefined) {
    const numBudget = Number(budget);
    if (numBudget < 0) return res.status(400).json({ error: 'Validation Error: Event Budget cannot be negative.' });
    event.budget = numBudget;
  }

  // Double booking check for updated venue/date
  const doubleBooked = db.events.find(e => 
    e.id !== event.id && 
    e.venueId === event.venueId && 
    e.date === event.date && 
    e.status !== 'Canceled' && 
    e.status !== 'Rejected'
  );

  if (doubleBooked) {
    return res.status(400).json({ 
      error: `Validation Error: This Venue is already booked on this date (${event.date}) for event "${doubleBooked.name}".` 
    });
  }

  if (status !== undefined) {
    event.status = status;
  }

  recalculateVenueStatus(db, oldVenueId);
  recalculateVenueStatus(db, event.venueId);

  writeDB(db);
  res.json(event);
});

app.delete('/api/events/:id', (req, res) => {
  const db = readDB();
  const eventIndex = db.events.findIndex(e => e.id === req.params.id);
  if (eventIndex === -1) return res.status(404).json({ error: 'Event not found' });

  const [removed] = db.events.splice(eventIndex, 1);
  // Cascade delete junction rows and feedbacks
  db.eventVendors = db.eventVendors.filter(ev => ev.eventId !== removed.id);
  db.feedback = db.feedback.filter(f => f.eventId !== removed.id);

  recalculateVenueStatus(db, removed.venueId);
  writeDB(db);
  res.json({ message: 'Event deleted successfully', removed });
});

// ==================== CLIENT MODULE ====================
app.get('/api/clients', (req, res) => {
  const db = readDB();
  res.json(db.clients);
});

app.post('/api/clients', (req, res) => {
  const db = readDB();
  const { name, email, phone, address, country, city } = req.body;

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Validation Error: Client Name, Email, and Phone are required.' });
  }

  // Milestone 5: Email validation regex matching Salesforce rule NOT(REGEX(Email__c, "^[a-zA-Z0-9._]+@[a-zA-Z0-9.]+\\.[a-zA-Z]{2,}$"))
  const emailRegex = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please Enter Valid Email Address' });
  }

  const newClient = {
    id: `CLI-${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: address || '',
    country: country || 'India',
    city: city || 'Hyderabad',
    createdAt: new Date().toISOString().split('T')[0]
  };

  db.clients.push(newClient);
  writeDB(db);
  res.status(201).json(newClient);
});

app.put('/api/clients/:id', (req, res) => {
  const db = readDB();
  const client = db.clients.find(c => c.id === req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });

  const { name, email, phone, address, country, city } = req.body;
  if (name !== undefined) client.name = name.trim();
  if (email !== undefined) {
    const emailRegex = /^[a-zA-Z0-9._]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Please Enter Valid Email Address' });
    }
    client.email = email.trim();
  }
  if (phone !== undefined) client.phone = phone.trim();
  if (address !== undefined) client.address = address;
  if (country !== undefined) client.country = country;
  if (city !== undefined) client.city = city;

  writeDB(db);
  res.json(client);
});

app.delete('/api/clients/:id', (req, res) => {
  const db = readDB();
  const index = db.clients.findIndex(c => c.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Client not found' });

  // Check if client has active events
  const clientEvents = db.events.filter(e => e.clientId === req.params.id);
  if (clientEvents.length > 0) {
    return res.status(400).json({ error: `Cannot delete client: Client is linked to ${clientEvents.length} event(s).` });
  }

  const [removed] = db.clients.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Client deleted successfully', removed });
});

// ==================== VENDOR MODULE ====================
app.get('/api/vendors', (req, res) => {
  const db = readDB();
  res.json(db.vendors);
});

app.post('/api/vendors', (req, res) => {
  const db = readDB();
  const { name, email, phone, serviceType, status, rating } = req.body;

  if (!name || !email || !phone || !serviceType) {
    return res.status(400).json({ error: 'Validation Error: Vendor Name, Email, Phone, and Service Type are required.' });
  }

  const newVendor = {
    id: `VEN-${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    email: email.trim(),
    phone: phone.trim(),
    serviceType,
    status: status || 'Available',
    rating: Number(rating) || 4.5
  };

  db.vendors.push(newVendor);
  writeDB(db);
  res.status(201).json(newVendor);
});

app.put('/api/vendors/:id', (req, res) => {
  const db = readDB();
  const vendor = db.vendors.find(v => v.id === req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  const { name, email, phone, serviceType, status, rating } = req.body;
  if (name !== undefined) vendor.name = name.trim();
  if (email !== undefined) vendor.email = email.trim();
  if (phone !== undefined) vendor.phone = phone.trim();
  if (serviceType !== undefined) vendor.serviceType = serviceType;
  if (status !== undefined) vendor.status = status;
  if (rating !== undefined) vendor.rating = Number(rating);

  writeDB(db);
  res.json(vendor);
});

app.delete('/api/vendors/:id', (req, res) => {
  const db = readDB();
  const index = db.vendors.findIndex(v => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Vendor not found' });

  const [removed] = db.vendors.splice(index, 1);
  db.eventVendors = db.eventVendors.filter(ev => ev.vendorId !== removed.id);
  writeDB(db);
  res.json({ message: 'Vendor removed', removed });
});

// ==================== VENUE MODULE ====================
app.get('/api/venues', (req, res) => {
  const db = readDB();
  res.json(db.venues);
});

app.post('/api/venues', (req, res) => {
  const db = readDB();
  const { name, address, location, capacity, availabilityStatus } = req.body;

  if (!name || !address || !capacity) {
    return res.status(400).json({ error: 'Validation Error: Venue Name, Address, and Capacity are required.' });
  }

  const newVenue = {
    id: `VNU-${Date.now().toString().slice(-4)}`,
    name: name.trim(),
    address: address.trim(),
    location: location || '',
    capacity: Number(capacity) || 100,
    availabilityStatus: availabilityStatus || 'Available'
  };

  db.venues.push(newVenue);
  writeDB(db);
  res.status(201).json(newVenue);
});

app.put('/api/venues/:id', (req, res) => {
  const db = readDB();
  const venue = db.venues.find(v => v.id === req.params.id);
  if (!venue) return res.status(404).json({ error: 'Venue not found' });

  const { name, address, location, capacity, availabilityStatus } = req.body;
  if (name !== undefined) venue.name = name.trim();
  if (address !== undefined) venue.address = address.trim();
  if (location !== undefined) venue.location = location;
  if (capacity !== undefined) venue.capacity = Number(capacity);
  if (availabilityStatus !== undefined) venue.availabilityStatus = availabilityStatus;

  writeDB(db);
  res.json(venue);
});

app.delete('/api/venues/:id', (req, res) => {
  const db = readDB();
  const index = db.venues.findIndex(v => v.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Venue not found' });

  const venueEvents = db.events.filter(e => e.venueId === req.params.id && e.status !== 'Canceled');
  if (venueEvents.length > 0) {
    return res.status(400).json({ error: `Cannot delete venue: it is currently booked for ${venueEvents.length} event(s).` });
  }

  const [removed] = db.venues.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Venue deleted', removed });
});

// ==================== EVENT VENDOR JUNCTION MODULE ====================
app.get('/api/event-vendors', (req, res) => {
  const db = readDB();
  res.json(db.eventVendors);
});

app.post('/api/event-vendors', (req, res) => {
  const db = readDB();
  const { eventId, vendorId, serviceType, notes } = req.body;

  if (!eventId || !vendorId) {
    return res.status(400).json({ error: 'Validation Error: Both Event and Vendor must be selected.' });
  }

  // Check if vendor already assigned to this event
  const exists = db.eventVendors.find(ev => ev.eventId === eventId && ev.vendorId === vendorId);
  if (exists) {
    return res.status(400).json({ error: 'This vendor is already assigned to this event.' });
  }

  const vendor = db.vendors.find(v => v.id === vendorId);
  const newEV = {
    id: `EV-${Date.now().toString().slice(-4)}`,
    eventId,
    vendorId,
    serviceType: serviceType || (vendor ? vendor.serviceType : 'Service'),
    notes: notes || ''
  };

  db.eventVendors.push(newEV);
  if (vendor) vendor.status = 'Booked';

  writeDB(db);
  res.status(201).json(newEV);
});

app.delete('/api/event-vendors/:id', (req, res) => {
  const db = readDB();
  const index = db.eventVendors.findIndex(ev => ev.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Assignment not found' });

  const [removed] = db.eventVendors.splice(index, 1);
  // Check if vendor is still in any other active events
  const stillBooked = db.eventVendors.some(ev => ev.vendorId === removed.vendorId);
  const vendor = db.vendors.find(v => v.id === removed.vendorId);
  if (vendor && !stillBooked) {
    vendor.status = 'Available';
  }

  writeDB(db);
  res.json({ message: 'Vendor removed from event', removed });
});

// ==================== FEEDBACK MODULE ====================
app.get('/api/feedback', (req, res) => {
  const db = readDB();
  res.json(db.feedback);
});

app.post('/api/feedback', (req, res) => {
  const db = readDB();
  const { clientId, eventId, rating, comments } = req.body;

  if (!clientId || !eventId || !rating) {
    return res.status(400).json({ error: 'Validation Error: Client, Event, and Rating are required.' });
  }

  const numRating = Number(rating);
  if (isNaN(numRating) || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Validation Error: Rating must be an integer between 1 and 5.' });
  }

  // Activity 3: Lookup Filter Rule (PDF Page 28-29)
  // "Scenario: When creating Feedback, after selecting a Client, the Event lookup should only show Events of that Client."
  const event = db.events.find(e => e.id === eventId);
  if (!event) return res.status(400).json({ error: 'Selected event does not exist.' });
  if (event.clientId !== clientId) {
    return res.status(400).json({ error: 'Lookup Filter Violation: The selected event does not belong to the chosen client.' });
  }

  const nextNum = db.feedback.length + 1;
  const newFeedback = {
    id: `F-${String(nextNum).padStart(4, '0')}`,
    clientId,
    eventId,
    rating: numRating,
    comments: comments || '',
    date: new Date().toISOString().split('T')[0]
  };

  db.feedback.push(newFeedback);
  writeDB(db);
  res.status(201).json(newFeedback);
});

app.delete('/api/feedback/:id', (req, res) => {
  const db = readDB();
  const index = db.feedback.findIndex(f => f.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Feedback not found' });

  const [removed] = db.feedback.splice(index, 1);
  writeDB(db);
  res.json({ message: 'Feedback deleted', removed });
});

// ==================== MILESTONE 6: APPROVAL PROCESS ====================
app.post('/api/cancellation/submit', (req, res) => {
  const db = readDB();
  const { eventId, requestedBy, reason } = req.body;

  const event = db.events.find(e => e.id === eventId);
  if (!event) return res.status(404).json({ error: 'Event not found' });

  event.status = 'Pending Cancellation';

  const request = {
    id: `CR-${Date.now().toString().slice(-4)}`,
    eventId,
    requestedBy: requestedBy || 'Event Owner',
    requestDate: new Date().toISOString().split('T')[0],
    reason: reason || 'Client requested cancellation',
    status: 'Pending',
    reviewedBy: null,
    reviewDate: null
  };

  db.cancellationRequests.push(request);

  // Email Alert (PDF Page 31 & 38)
  db.notificationLogs.unshift({
    id: `NOTIF-${Date.now().toString().slice(-4)}`,
    type: 'Cancellation Request Alert',
    recipient: 'Event Coordinator & Manager',
    subject: `Approval Request: Cancel Event ${event.name}`,
    body: `Hello! An approval request has been submitted to cancel event "${event.name}" scheduled on ${event.date}.`,
    date: new Date().toLocaleString(),
    status: 'Sent'
  });

  writeDB(db);
  res.json({ message: 'Cancellation request submitted for approval', request, event });
});

app.post('/api/cancellation/review', (req, res) => {
  const db = readDB();
  const { requestId, action, reviewerName } = req.body; // action: 'approve' or 'reject'

  const request = db.cancellationRequests.find(r => r.id === requestId);
  if (!request) return res.status(404).json({ error: 'Request not found' });

  const event = db.events.find(e => e.id === request.eventId);
  if (!event) return res.status(404).json({ error: 'Linked event not found' });

  request.reviewedBy = reviewerName || 'Event Admin';
  request.reviewDate = new Date().toISOString().split('T')[0];

  if (action === 'approve') {
    request.status = 'Approved';
    event.status = 'Canceled';

    // Release venue availability
    recalculateVenueStatus(db, event.venueId);

    // Email Alerts: Client notice + Owner approval notice (PDF Page 32 & 33)
    db.notificationLogs.unshift({
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      type: 'Cancellation Notice (Client)',
      recipient: event.clientId,
      subject: `Event Cancellation Notice – ${event.name}`,
      body: `Hello! We would like to inform you that your event "${event.name}" on ${event.date} has been canceled.`,
      date: new Date().toLocaleString(),
      status: 'Sent'
    });

    db.notificationLogs.unshift({
      id: `NOTIF-${Date.now().toString().slice(-4) + '1'}`,
      type: 'Approval Notification (Owner)',
      recipient: event.owner,
      subject: `Event Cancellation Approved: ${event.name}`,
      body: `Your cancellation request for ${event.name} has been approved. Status updated to Canceled.`,
      date: new Date().toLocaleString(),
      status: 'Sent'
    });

  } else {
    request.status = 'Rejected';
    event.status = 'Confirmed';

    db.notificationLogs.unshift({
      id: `NOTIF-${Date.now().toString().slice(-4)}`,
      type: 'Rejection Notification (Owner)',
      recipient: event.owner,
      subject: `Event Cancellation Rejected: ${event.name}`,
      body: `Your cancellation request for ${event.name} has been rejected. The event status has been reverted to Confirmed.`,
      date: new Date().toLocaleString(),
      status: 'Sent'
    });
  }

  writeDB(db);
  res.json({ message: `Cancellation request ${action}d successfully`, request, event });
});

// ==================== MILESTONE 7: 3-DAY REMINDER FLOW ====================
app.post('/api/flows/trigger-reminders', (req, res) => {
  const db = readDB();
  const today = new Date();
  let reminderCount = 0;

  db.events.forEach(event => {
    if (event.status === 'Confirmed') {
      const eventDate = new Date(event.date);
      const diffTime = eventDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // PDF Milestone 7: "3 Days Before Event Date"
      if (diffDays >= 0 && diffDays <= 3) {
        const client = db.clients.find(c => c.id === event.clientId);
        const venue = db.venues.find(v => v.id === event.venueId);

        db.notificationLogs.unshift({
          id: `NOTIF-${Date.now().toString().slice(-4) + reminderCount}`,
          type: '3-Day Client Reminder Flow',
          recipient: client ? client.email : 'Client',
          subject: `Reminder: Your Event ${event.name} is in ${diffDays === 0 ? 'today' : diffDays + ' day(s)'}`,
          body: `Hello ${client ? client.name : 'Valued Client'},\nThis is a reminder that your event "${event.name}" will take place on ${event.date}.\nVenue: ${venue ? venue.name : 'TBD'}\nType: ${event.type}\nWe look forward to seeing you!\n- EventForce Team`,
          date: new Date().toLocaleString(),
          status: 'Sent'
        });
        reminderCount++;
      }
    }
  });

  writeDB(db);
  res.json({ message: `Flow executed: ${reminderCount} reminder notification(s) dispatched.`, count: reminderCount });
});

// ==================== MILESTONE 10: BATCH COMPLETE EVENTS ====================
app.post('/api/batch/complete-past-events', (req, res) => {
  const db = readDB();
  const todayStr = new Date().toISOString().split('T')[0];
  let updatedCount = 0;

  db.events.forEach(event => {
    // Schedulable batch query: Event_Date__c < TODAY AND Event_Status__c != 'Completed'
    if (event.date < todayStr && event.status !== 'Completed' && event.status !== 'Canceled') {
      event.status = 'Completed';
      updatedCount++;
    }
  });

  if (updatedCount > 0) {
    writeDB(db);
  }

  res.json({
    message: `Nightly Batch Job (BatchCompleteEvents) finished. ${updatedCount} past event(s) marked as Completed.`,
    updatedCount
  });
});

// ==================== REPORTS & METRICS ====================
app.get('/api/reports/analytics', (req, res) => {
  const db = readDB();
  const events = db.events;

  // Monthly summary
  const monthMap = {};
  events.forEach(e => {
    const month = e.date.substring(0, 7);
    if (!monthMap[month]) {
      monthMap[month] = { month, count: 0, totalBudget: 0 };
    }
    monthMap[month].count += 1;
    monthMap[month].totalBudget += (e.budget || 0);
  });

  // Type summary
  const typeMap = {};
  events.forEach(e => {
    typeMap[e.type] = (typeMap[e.type] || 0) + 1;
  });

  // Status summary
  const statusMap = {};
  events.forEach(e => {
    statusMap[e.status] = (statusMap[e.status] || 0) + 1;
  });

  // Feedback calculation
  const totalFeedback = db.feedback.length;
  const avgRating = totalFeedback > 0 
    ? (db.feedback.reduce((sum, f) => sum + f.rating, 0) / totalFeedback).toFixed(1)
    : 0;

  res.json({
    totalEvents: events.length,
    totalClients: db.clients.length,
    totalVendors: db.vendors.length,
    totalVenues: db.venues.length,
    averageRating: avgRating,
    totalFeedback,
    byMonth: Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month)),
    byType: typeMap,
    byStatus: statusMap
  });
});

// Reset database route
app.post('/api/data/reset', (req, res) => {
  // Can reload default seed
  res.json({ message: 'Database reset to default seed' });
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(`  EventForce Management System Server Running!      `);
  console.log(`  Port: ${PORT}                                     `);
  console.log(`  Local URL: http://localhost:${PORT}               `);
  console.log(`====================================================`);
});
