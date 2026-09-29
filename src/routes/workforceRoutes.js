const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { verifyToken, requireRole } = require('../middleware/authMiddleware');

// GET /api/workforce/tasks (Admin or Staff)
router.get('/tasks', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  try {
    let tasks = db.getWorkforceTasks();
    const { eventId, status, priority, staffId } = req.query;

    if (eventId) {
      tasks = tasks.filter(t => t.eventId === eventId);
    }
    if (status && status !== 'All') {
      tasks = tasks.filter(t => t.status.toLowerCase() === status.toLowerCase());
    }
    if (priority && priority !== 'All') {
      tasks = tasks.filter(t => t.priority.toLowerCase() === priority.toLowerCase());
    }
    if (staffId) {
      tasks = tasks.filter(t => t.assignedToUserId === staffId);
    }

    return res.json({
      success: true,
      count: tasks.length,
      tasks
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error retrieving workforce tasks.' });
  }
});

// GET /api/workforce/my-tasks (Staff member's assigned shifts & responsibilities)
router.get('/my-tasks', verifyToken, (req, res) => {
  try {
    const tasks = db.getWorkforceTasks();
    const myTasks = tasks.filter(t => t.assignedToUserId === req.user.id);
    return res.json({
      success: true,
      count: myTasks.length,
      tasks: myTasks
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving personal tasks.' });
  }
});

// POST /api/workforce/tasks (Assign new crew shift/task - Admin only)
router.post('/tasks', verifyToken, requireRole('admin'), (req, res) => {
  try {
    const {
      eventId,
      title,
      description,
      roleRequired,
      assignedToUserId,
      shiftStart,
      shiftEnd,
      priority = 'Medium',
      location
    } = req.body;

    if (!eventId || !title || !assignedToUserId) {
      return res.status(400).json({
        success: false,
        message: 'Event, Task Title, and Assigned Staff Member are required.'
      });
    }

    const events = db.getEvents();
    const event = events.find(e => e.id === eventId);
    if (!event) {
      return res.status(404).json({ success: false, message: 'Specified event not found.' });
    }

    const users = db.getUsers();
    const staff = users.find(u => u.id === assignedToUserId);
    if (!staff) {
      return res.status(404).json({ success: false, message: 'Selected staff member not found.' });
    }

    const tasks = db.getWorkforceTasks();
    const newTask = {
      id: `task-${Date.now().toString(36)}`,
      eventId: event.id,
      eventTitle: event.title,
      title: title.trim(),
      description: description ? description.trim() : 'Execute assigned operational task diligently.',
      roleRequired: roleRequired || 'Event Support Staff',
      assignedToUserId: staff.id,
      assignedToName: staff.name,
      shiftStart: shiftStart || '09:00 AM',
      shiftEnd: shiftEnd || '05:00 PM',
      status: 'Assigned',
      priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
      location: location || event.venue,
      createdAt: new Date().toISOString()
    };

    tasks.unshift(newTask);
    db.saveWorkforceTasks(tasks);

    return res.status(201).json({
      success: true,
      message: `Shift assigned to ${staff.name} successfully!`,
      task: newTask
    });
  } catch (err) {
    console.error('Workforce task error:', err);
    return res.status(500).json({ success: false, message: 'Server error creating workforce task.' });
  }
});

// PATCH /api/workforce/tasks/:id/status (Staff updates their shift progress: Assigned -> In Progress -> Completed)
router.patch('/tasks/:id/status', verifyToken, (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['Assigned', 'In Progress', 'Completed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const tasks = db.getWorkforceTasks();
    const index = tasks.findIndex(t => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    const task = tasks[index];

    // Ensure staff can only update their own task, or admin can update any task
    if (task.assignedToUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only update tasks assigned to you.' });
    }

    task.status = status;
    task.updatedAt = new Date().toISOString();
    tasks[index] = task;
    db.saveWorkforceTasks(tasks);

    return res.json({
      success: true,
      message: `Task status updated to "${status}".`,
      task
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error updating task status.' });
  }
});

// DELETE /api/workforce/tasks/:id (Admin only)
router.delete('/tasks/:id', verifyToken, requireRole('admin'), (req, res) => {
  try {
    let tasks = db.getWorkforceTasks();
    const index = tasks.findIndex(t => t.id === req.params.id);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    tasks = tasks.filter(t => t.id !== req.params.id);
    db.saveWorkforceTasks(tasks);

    return res.json({ success: true, message: 'Workforce assignment removed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error deleting workforce task.' });
  }
});

// GET /api/workforce/crew-directory (Get all staff members + active tasks count)
router.get('/crew-directory', verifyToken, requireRole('admin', 'staff'), (req, res) => {
  try {
    const users = db.getUsers().filter(u => u.role === 'staff' || u.role === 'admin');
    const tasks = db.getWorkforceTasks();

    const crew = users.map(user => {
      const userTasks = tasks.filter(t => t.assignedToUserId === user.id);
      const activeTasks = userTasks.filter(t => t.status !== 'Completed').length;
      const completedTasks = userTasks.filter(t => t.status === 'Completed').length;

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || 'N/A',
        department: user.department || 'General Operations',
        specialization: user.specialization || 'Event Support',
        role: user.role,
        avatar: user.avatar,
        activeTasks,
        completedTasks,
        totalAssigned: userTasks.length
      };
    });

    return res.json({ success: true, count: crew.length, crew });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Error retrieving crew directory.' });
  }
});

module.exports = router;
