// API Service for EventForce Management System
const API_BASE = '/api';

const api = {
  // Authentication & Session
  getToken() {
    return localStorage.getItem('eventforce_token');
  },

  getUser() {
    const userStr = localStorage.getItem('eventforce_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    if (token) localStorage.setItem('eventforce_token', token);
    if (user) localStorage.setItem('eventforce_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('eventforce_token');
    localStorage.removeItem('eventforce_user');
  },

  // Base HTTP Request Helper
  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('text/csv')) {
        return await response.text();
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `Request failed with status ${response.status}`);
      }

      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      throw err;
    }
  },

  // Auth endpoints
  async login(email, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data.token && data.user) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async register(payload) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (data.token && data.user) {
      this.setSession(data.token, data.user);
    }
    return data;
  },

  async getMe() {
    return await this.request('/auth/me');
  },

  async getDemoCredentials() {
    return await this.request('/auth/demo-credentials');
  },

  async getUsers(role = '') {
    return await this.request(`/auth/users${role ? `?role=${role}` : ''}`);
  },

  // Events endpoints
  async getEvents(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return await this.request(`/events${query ? `?${query}` : ''}`);
  },

  async getEvent(id) {
    return await this.request(`/events/${id}`);
  },

  async createEvent(payload) {
    return await this.request('/events', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateEvent(id, payload) {
    return await this.request(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  async deleteEvent(id) {
    return await this.request(`/events/${id}`, {
      method: 'DELETE'
    });
  },

  async submitFeedback(eventId, rating, comment) {
    return await this.request(`/events/${eventId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment })
    });
  },

  // Registrations & Tickets
  async bookTicket(payload) {
    return await this.request('/registrations/book', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async getMyTickets() {
    return await this.request('/registrations/my-tickets');
  },

  async getEventAttendees(eventId) {
    return await this.request(`/registrations/event/${eventId}`);
  },

  async checkInTicket(ticketIdentifier) {
    return await this.request('/registrations/check-in', {
      method: 'POST',
      body: JSON.stringify({ ticketIdentifier })
    });
  },

  async cancelTicket(id) {
    return await this.request(`/registrations/cancel/${id}`, {
      method: 'POST'
    });
  },

  // Workforce Management
  async getWorkforceTasks(filters = {}) {
    const query = new URLSearchParams(filters).toString();
    return await this.request(`/workforce/tasks${query ? `?${query}` : ''}`);
  },

  async getMyTasks() {
    return await this.request('/workforce/my-tasks');
  },

  async createWorkforceTask(payload) {
    return await this.request('/workforce/tasks', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async updateTaskStatus(taskId, status) {
    return await this.request(`/workforce/tasks/${taskId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  },

  async deleteWorkforceTask(taskId) {
    return await this.request(`/workforce/tasks/${taskId}`, {
      method: 'DELETE'
    });
  },

  async getCrewDirectory() {
    return await this.request('/workforce/crew-directory');
  },

  // Analytics
  async getDashboardAnalytics() {
    return await this.request('/analytics/dashboard');
  },

  async downloadAttendeesCSV() {
    const token = this.getToken();
    const response = await fetch(`${API_BASE}/analytics/export/attendees`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eventforce-attendees-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }
};
