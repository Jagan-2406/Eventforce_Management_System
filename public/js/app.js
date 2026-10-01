/**
 * EventForce Management System - Core Frontend Controller
 * Follows Naan Mudhalvan Salesforce Architecture mapped to Web Standards
 */

const DEFAULT_BUDGETS = {
  Wedding: 50000,
  Corporate: 30000,
  Birthday: 10000,
  Anniversary: 20000,
  Festival: 60000,
  Concert: 40000,
  Other: 15000
};

class EventForceApp {
  constructor() {
    this.currentTab = 'dashboard';
    this.currentRole = 'Event Admin';
    this.currentReport = 'upcoming-month';
    this.db = {
      events: [],
      clients: [],
      vendors: [],
      venues: [],
      eventVendors: [],
      feedback: [],
      users: [],
      cancellationRequests: [],
      notificationLogs: []
    };

    this.charts = {
      month: null,
      type: null,
      status: null
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    await this.fetchData();
    this.renderAll();
  }

  bindEvents() {
    // Nav tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.getAttribute('data-tab');
        this.switchTab(tab);
      });
    });

    // Role switcher
    const roleSelect = document.getElementById('current-role');
    if (roleSelect) {
      roleSelect.addEventListener('change', (e) => {
        this.currentRole = e.target.value;
        this.applyRolePermissions();
        this.showAlert(`Switched active role to: ${this.currentRole}`, 'info');
      });
    }

    // Quick action triggers
    const batchBtn = document.getElementById('btn-quick-batch');
    if (batchBtn) batchBtn.addEventListener('click', () => this.runNightlyBatchJob());

    const reminderBtn = document.getElementById('btn-quick-reminder');
    if (reminderBtn) reminderBtn.addEventListener('click', () => this.trigger3DayReminders());

    // Search and filters
    const eventSearch = document.getElementById('event-search');
    const eventFilterType = document.getElementById('event-filter-type');
    const eventFilterStatus = document.getElementById('event-filter-status');
    if (eventSearch) eventSearch.addEventListener('input', () => this.renderEventsTable());
    if (eventFilterType) eventFilterType.addEventListener('change', () => this.renderEventsTable());
    if (eventFilterStatus) eventFilterStatus.addEventListener('change', () => this.renderEventsTable());

    const clientSearch = document.getElementById('client-search');
    if (clientSearch) clientSearch.addEventListener('input', () => this.renderClientsTable());

    const vendorSearch = document.getElementById('vendor-search');
    const vendorFilterService = document.getElementById('vendor-filter-service');
    const vendorFilterStatus = document.getElementById('vendor-filter-status');
    if (vendorSearch) vendorSearch.addEventListener('input', () => this.renderVendorsTable());
    if (vendorFilterService) vendorFilterService.addEventListener('change', () => this.renderVendorsTable());
    if (vendorFilterStatus) vendorFilterStatus.addEventListener('change', () => this.renderVendorsTable());

    const venueSearch = document.getElementById('venue-search');
    const venueFilterStatus = document.getElementById('venue-filter-status');
    if (venueSearch) venueSearch.addEventListener('input', () => this.renderVenuesTable());
    if (venueFilterStatus) venueFilterStatus.addEventListener('change', () => this.renderVenuesTable());

    const feedbackSearch = document.getElementById('feedback-search');
    const feedbackFilterRating = document.getElementById('feedback-filter-rating');
    if (feedbackSearch) feedbackSearch.addEventListener('input', () => this.renderFeedbackTable());
    if (feedbackFilterRating) feedbackFilterRating.addEventListener('change', () => this.renderFeedbackTable());
  }

  async fetchData() {
    try {
      const res = await fetch('/api/database');
      if (res.ok) {
        this.db = await res.json();
      }
    } catch (e) {
      console.warn('Backend not responding or static preview mode. Using default cache.', e);
    }
  }

  switchTab(tabId) {
    this.currentTab = tabId;
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

    const activeBtn = document.querySelector(`.nav-item[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    const pane = document.getElementById(`tab-${tabId}`);
    if (pane) pane.classList.add('active');

    const titles = {
      dashboard: ['Operations Dashboard', 'Real-time overview of bookings, vendors, and satisfaction'],
      events: ['Event Management', 'Create, filter, coordinate and track event schedules'],
      clients: ['Client Directory', 'Maintain client profiles and contact information'],
      vendors: ['Vendor Coordination', 'Track suppliers, caterers, decorators and entertainment services'],
      venues: ['Venue & Hall Reservations', 'Monitor venue capacities and reservation statuses'],
      eventVendors: ['EventVendor Junction', 'Many-to-Many assignments linking events and suppliers'],
      feedback: ['Client Feedback', 'Post-event ratings, reviews, and satisfaction metrics'],
      approvals: ['Approvals & Flows', 'Event cancellation workflows, approval decisions, and email logs'],
      reports: ['Analytics & Reports', 'Standard Salesforce-aligned event and budget reports'],
      documentation: ['Project Documentation & Viva Guide', 'Full Naan Mudhalvan specification, architecture, and viva defense']
    };

    if (titles[tabId]) {
      document.getElementById('page-title').textContent = titles[tabId][0];
      document.getElementById('page-subtitle').textContent = titles[tabId][1];
    }

    if (tabId === 'dashboard') {
      this.renderDashboard();
    } else if (tabId === 'reports') {
      this.showReport(this.currentReport);
    }
  }

  applyRolePermissions() {
    // Milestones 14-18 Profiles & Roles
    const isAdmin = this.currentRole === 'Event Admin';
    const isCoordinator = this.currentRole === 'Event Coordinator';
    const isVendorMgr = this.currentRole === 'Vendor Manager';
    const isClient = this.currentRole === 'Client';

    const addEventBtn = document.getElementById('btn-add-event');
    const addClientBtn = document.getElementById('btn-add-client');
    const addVendorBtn = document.getElementById('btn-add-vendor');
    const addVenueBtn = document.getElementById('btn-add-venue');
    const addAssignBtn = document.getElementById('btn-add-event-vendor');
    const addFeedbackBtn = document.getElementById('btn-add-feedback');

    if (addEventBtn) addEventBtn.style.display = (isAdmin || isCoordinator) ? 'inline-flex' : 'none';
    if (addClientBtn) addClientBtn.style.display = (isAdmin || isCoordinator) ? 'inline-flex' : 'none';
    if (addVendorBtn) addVendorBtn.style.display = (isAdmin || isVendorMgr) ? 'inline-flex' : 'none';
    if (addVenueBtn) addVenueBtn.style.display = isAdmin ? 'inline-flex' : 'none';
    if (addAssignBtn) addAssignBtn.style.display = (isAdmin || isCoordinator || isVendorMgr) ? 'inline-flex' : 'none';
    if (addFeedbackBtn) addFeedbackBtn.style.display = 'inline-flex';

    this.renderAll();
  }

  showAlert(message, type = 'error') {
    const banner = document.getElementById('alert-banner');
    if (!banner) return;
    banner.className = `alert-banner ${type}`;
    banner.innerHTML = `
      <span>${message}</span>
      <button onclick="document.getElementById('alert-banner').classList.add('hidden')" style="background:none;border:none;cursor:pointer;font-weight:bold;color:inherit;">✕</button>
    `;
    banner.classList.remove('hidden');

    setTimeout(() => {
      banner.classList.add('hidden');
    }, 6000);
  }

  renderAll() {
    this.renderDashboard();
    this.renderEventsTable();
    this.renderClientsTable();
    this.renderVendorsTable();
    this.renderVenuesTable();
    this.renderEventVendorsTable();
    this.renderFeedbackTable();
    this.renderApprovalsAndLogs();
  }

  // ================= DASHBOARD & CHARTS =================
  renderDashboard() {
    const events = this.getFilteredRoleEvents();
    const clients = this.db.clients;
    const vendors = this.db.vendors;
    const venues = this.db.venues;
    const feedback = this.db.feedback;

    const todayStr = new Date().toISOString().split('T')[0];
    const upcomingEvents = events.filter(e => e.date >= todayStr && e.status !== 'Canceled');
    const availVendors = vendors.filter(v => v.status === 'Available');
    const availVenues = venues.filter(v => v.availabilityStatus === 'Available');

    const totalRatings = feedback.reduce((sum, f) => sum + f.rating, 0);
    const avgRating = feedback.length > 0 ? (totalRatings / feedback.length).toFixed(1) : '0.0';

    document.getElementById('kpi-total-events').textContent = events.length;
    document.getElementById('kpi-upcoming-events').textContent = `${upcomingEvents.length} Upcoming`;
    document.getElementById('kpi-total-clients').textContent = clients.length;
    document.getElementById('kpi-total-vendors').textContent = vendors.length;
    document.getElementById('kpi-avail-vendors').textContent = `${availVendors.length} Available`;
    document.getElementById('kpi-total-venues').textContent = venues.length;
    document.getElementById('kpi-avail-venues').textContent = `${availVenues.length} Available`;
    document.getElementById('kpi-avg-rating').textContent = `${avgRating} / 5`;
    document.getElementById('kpi-total-feedback').textContent = `Based on ${feedback.length} reviews`;

    // Render Charts
    this.renderMonthChart(upcomingEvents);
    this.renderTypeChart(events);
    this.renderStatusChart(events);

    // Mini lists
    this.renderDashboardPendingList();
    this.renderDashboardNotifList();
  }

  renderMonthChart(upcomingEvents) {
    const ctx = document.getElementById('chart-month');
    if (!ctx) return;

    const monthCount = {};
    upcomingEvents.forEach(e => {
      const month = e.date.substring(0, 7);
      monthCount[month] = (monthCount[month] || 0) + 1;
    });

    const labels = Object.keys(monthCount).sort();
    const data = labels.map(k => monthCount[k]);

    if (this.charts.month) this.charts.month.destroy();
    this.charts.month = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels.length ? labels : ['No upcoming'],
        datasets: [{
          data: data.length ? data : [1],
          backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  renderTypeChart(events) {
    const ctx = document.getElementById('chart-type');
    if (!ctx) return;

    const typeCount = {};
    events.forEach(e => {
      typeCount[e.type] = (typeCount[e.type] || 0) + 1;
    });

    const labels = Object.keys(typeCount);
    const data = labels.map(k => typeCount[k]);

    if (this.charts.type) this.charts.type.destroy();
    this.charts.type = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Event Count',
          data,
          backgroundColor: '#6366f1'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } }
        }
      }
    });
  }

  renderStatusChart(events) {
    const ctx = document.getElementById('chart-status');
    if (!ctx) return;

    const statusCount = {};
    events.forEach(e => {
      statusCount[e.status] = (statusCount[e.status] || 0) + 1;
    });

    const labels = Object.keys(statusCount);
    const data = labels.map(k => statusCount[k]);

    if (this.charts.status) this.charts.status.destroy();
    this.charts.status = new Chart(ctx, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: ['#0284c7', '#16a34a', '#64748b', '#f59e0b', '#dc2626', '#9ca3af']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' }
        }
      }
    });
  }

  renderDashboardPendingList() {
    const container = document.getElementById('dashboard-pending-list');
    if (!container) return;
    const pendings = this.db.cancellationRequests.filter(r => r.status === 'Pending');

    if (pendings.length === 0) {
      container.innerHTML = `<div class="text-muted" style="padding: 12px; font-size: 0.85rem;">No pending cancellation approvals.</div>`;
      return;
    }

    container.innerHTML = pendings.map(r => {
      const event = this.db.events.find(e => e.id === r.eventId);
      return `
        <div class="mini-item">
          <div>
            <div class="mini-item-title">${event ? event.name : r.eventId}</div>
            <div class="mini-item-meta">Requested by: ${r.requestedBy} • Reason: ${r.reason}</div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="app.switchTab('approvals')">Review</button>
        </div>
      `;
    }).join('');
  }

  renderDashboardNotifList() {
    const container = document.getElementById('dashboard-notif-list');
    if (!container) return;
    const logs = (this.db.notificationLogs || []).slice(0, 5);

    if (logs.length === 0) {
      container.innerHTML = `<div class="text-muted" style="padding: 12px; font-size: 0.85rem;">No emails dispatched yet.</div>`;
      return;
    }

    container.innerHTML = logs.map(l => `
      <div class="mini-item">
        <div>
          <div class="mini-item-title">${l.subject}</div>
          <div class="mini-item-meta">To: ${l.recipient} • ${l.date}</div>
        </div>
        <span class="badge info">${l.status}</span>
      </div>
    `).join('');
  }

  getFilteredRoleEvents() {
    if (this.currentRole === 'Client') {
      // Client profile only sees own events (Ananya Pandey CLI-1001)
      return this.db.events.filter(e => e.clientId === 'CLI-1001');
    }
    return this.db.events;
  }

  // ================= EVENTS =================
  renderEventsTable() {
    const tbody = document.getElementById('events-table-body');
    if (!tbody) return;

    const searchTerm = (document.getElementById('event-search')?.value || '').toLowerCase();
    const typeFilter = document.getElementById('event-filter-type')?.value || '';
    const statusFilter = document.getElementById('event-filter-status')?.value || '';

    const events = this.getFilteredRoleEvents().filter(e => {
      const matchSearch = e.name.toLowerCase().includes(searchTerm) || e.id.toLowerCase().includes(searchTerm);
      const matchType = !typeFilter || e.type === typeFilter;
      const matchStatus = !statusFilter || e.status === statusFilter;
      return matchSearch && matchType && matchStatus;
    });

    if (events.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 24px; color: #64748b;">No events found matching criteria.</td></tr>`;
      return;
    }

    const canEdit = this.currentRole === 'Event Admin' || this.currentRole === 'Event Coordinator';

    tbody.innerHTML = events.map(e => {
      const client = this.db.clients.find(c => c.id === e.clientId);
      const venue = this.db.venues.find(v => v.id === e.venueId);

      let actionHtml = '';
      if (canEdit) {
        actionHtml = `
          <button class="btn btn-sm btn-secondary" onclick="app.openEditEventModal('${e.id}')">Edit</button>
          ${e.status === 'Confirmed' ? `<button class="btn btn-sm btn-outline" onclick="app.openCancelRequestModal('${e.id}')">Cancel</button>` : ''}
          <button class="btn btn-sm btn-danger" onclick="app.deleteEvent('${e.id}')">Delete</button>
        `;
      } else if (this.currentRole === 'Client' && e.status === 'Confirmed') {
        actionHtml = `<button class="btn btn-sm btn-outline" onclick="app.openCancelRequestModal('${e.id}')">Request Cancel</button>`;
      } else {
        actionHtml = `<span style="font-size: 0.75rem; color: #94a3b8;">Read Only</span>`;
      }

      return `
        <tr>
          <td><strong>${e.id}</strong></td>
          <td>
            <div style="font-weight: 600;">${e.name}</div>
            <small style="color: #64748b;">${e.description ? e.description.slice(0, 40) + '...' : ''}</small>
          </td>
          <td>${e.date}</td>
          <td><span class="badge info">${e.type}</span></td>
          <td>${client ? client.name : e.clientId}</td>
          <td>${venue ? venue.name : e.venueId}</td>
          <td>₹${Number(e.budget).toLocaleString()}</td>
          <td><span class="badge ${e.status.replace(/\s+/g, '.')}">${e.status}</span></td>
          <td>${actionHtml}</td>
        </tr>
      `;
    }).join('');
  }

  openEventModal() {
    document.getElementById('modal-event-title').textContent = 'Create New Event';
    document.getElementById('form-event').reset();
    document.getElementById('event-id').value = '';

    this.populateClientSelect('event-client');
    this.populateVenueSelect('event-venue');

    // Default formula budget
    const typeSelect = document.getElementById('event-type');
    typeSelect.value = 'Wedding';
    document.getElementById('event-budget').value = DEFAULT_BUDGETS.Wedding;

    this.openModal('modal-event');
  }

  onEventTypeChanged() {
    const type = document.getElementById('event-type').value;
    const budgetInput = document.getElementById('event-budget');
    if (!budgetInput.value || budgetInput.value === '0' || Object.values(DEFAULT_BUDGETS).includes(Number(budgetInput.value))) {
      budgetInput.value = DEFAULT_BUDGETS[type] || 15000;
    }
  }

  openEditEventModal(id) {
    const event = this.db.events.find(e => e.id === id);
    if (!event) return;

    document.getElementById('modal-event-title').textContent = `Edit Event: ${event.name}`;
    document.getElementById('event-id').value = event.id;
    document.getElementById('event-name').value = event.name;
    document.getElementById('event-date').value = event.date;
    document.getElementById('event-type').value = event.type;
    document.getElementById('event-status').value = event.status;
    document.getElementById('event-budget').value = event.budget;
    document.getElementById('event-description').value = event.description || '';

    this.populateClientSelect('event-client', event.clientId);
    this.populateVenueSelect('event-venue', event.venueId);

    this.openModal('modal-event');
  }

  async handleSaveEvent(e) {
    e.preventDefault();
    const id = document.getElementById('event-id').value;
    const name = document.getElementById('event-name').value;
    const date = document.getElementById('event-date').value;
    const type = document.getElementById('event-type').value;
    const status = document.getElementById('event-status').value;
    const budget = document.getElementById('event-budget').value;
    const clientId = document.getElementById('event-client').value;
    const venueId = document.getElementById('event-venue').value;
    const description = document.getElementById('event-description').value;

    const payload = { name, date, type, status, budget, clientId, venueId, description };

    try {
      const url = id ? `/api/events/${id}` : '/api/events';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error || 'Failed to save event');
        return;
      }

      this.closeModal('modal-event');
      this.showAlert(`Event successfully ${id ? 'updated' : 'created'}!`, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Server error saving event');
    }
  }

  async deleteEvent(id) {
    if (!confirm('Are you sure you want to delete this event? This will also remove any assigned vendor links.')) return;
    try {
      const res = await fetch(`/api/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.showAlert('Event deleted.', 'info');
        await this.fetchData();
        this.renderAll();
      }
    } catch (e) {
      this.showAlert('Failed to delete event');
    }
  }

  // ================= CLIENTS =================
  renderClientsTable() {
    const tbody = document.getElementById('clients-table-body');
    if (!tbody) return;

    const search = (document.getElementById('client-search')?.value || '').toLowerCase();
    const clients = this.db.clients.filter(c => 
      c.name.toLowerCase().includes(search) || 
      c.email.toLowerCase().includes(search) || 
      c.city.toLowerCase().includes(search)
    );

    const canManage = this.currentRole === 'Event Admin' || this.currentRole === 'Event Coordinator';

    tbody.innerHTML = clients.map(c => `
      <tr>
        <td><strong>${c.id}</strong></td>
        <td><div style="font-weight:600;">${c.name}</div></td>
        <td><a href="mailto:${c.email}">${c.email}</a></td>
        <td>${c.phone}</td>
        <td>${c.city}</td>
        <td>${c.country}</td>
        <td><small>${c.address || '-'}</small></td>
        <td>
          ${canManage ? `
            <button class="btn btn-sm btn-secondary" onclick="app.openEditClientModal('${c.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteClient('${c.id}')">Delete</button>
          ` : `<span style="font-size:0.75rem;color:#94a3b8;">View Only</span>`}
        </td>
      </tr>
    `).join('');
  }

  openClientModal() {
    document.getElementById('modal-client-title').textContent = 'Add New Client';
    document.getElementById('form-client').reset();
    document.getElementById('client-id').value = '';
    this.openModal('modal-client');
  }

  openEditClientModal(id) {
    const client = this.db.clients.find(c => c.id === id);
    if (!client) return;

    document.getElementById('modal-client-title').textContent = `Edit Client: ${client.name}`;
    document.getElementById('client-id').value = client.id;
    document.getElementById('client-name').value = client.name;
    document.getElementById('client-email').value = client.email;
    document.getElementById('client-phone').value = client.phone;
    document.getElementById('client-country').value = client.country || 'India';
    document.getElementById('client-city').value = client.city || 'Hyderabad';
    document.getElementById('client-address').value = client.address || '';

    this.openModal('modal-client');
  }

  async handleSaveClient(e) {
    e.preventDefault();
    const id = document.getElementById('client-id').value;
    const name = document.getElementById('client-name').value;
    const email = document.getElementById('client-email').value;
    const phone = document.getElementById('client-phone').value;
    const country = document.getElementById('client-country').value;
    const city = document.getElementById('client-city').value;
    const address = document.getElementById('client-address').value;

    const payload = { name, email, phone, country, city, address };

    try {
      const url = id ? `/api/clients/${id}` : '/api/clients';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error || 'Failed to save client');
        return;
      }

      this.closeModal('modal-client');
      this.showAlert(`Client successfully ${id ? 'updated' : 'saved'}!`, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Server error saving client');
    }
  }

  async deleteClient(id) {
    if (!confirm('Are you sure you want to delete this client?')) return;
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }
      this.showAlert('Client deleted.', 'info');
      await this.fetchData();
      this.renderAll();
    } catch (e) {
      this.showAlert('Failed to delete client');
    }
  }

  // ================= VENDORS =================
  renderVendorsTable() {
    const tbody = document.getElementById('vendors-table-body');
    if (!tbody) return;

    const search = (document.getElementById('vendor-search')?.value || '').toLowerCase();
    const serviceFilter = document.getElementById('vendor-filter-service')?.value || '';
    const statusFilter = document.getElementById('vendor-filter-status')?.value || '';

    const vendors = this.db.vendors.filter(v => {
      const matchSearch = v.name.toLowerCase().includes(search) || v.serviceType.toLowerCase().includes(search);
      const matchService = !serviceFilter || v.serviceType === serviceFilter;
      const matchStatus = !statusFilter || v.status === statusFilter;
      return matchSearch && matchService && matchStatus;
    });

    const canManage = this.currentRole === 'Event Admin' || this.currentRole === 'Vendor Manager';

    tbody.innerHTML = vendors.map(v => `
      <tr>
        <td><strong>${v.id}</strong></td>
        <td><div style="font-weight:600;">${v.name}</div></td>
        <td><span class="badge info">${v.serviceType}</span></td>
        <td>${v.email}</td>
        <td>${v.phone}</td>
        <td>⭐ ${v.rating || 4.5}</td>
        <td><span class="badge ${v.status}">${v.status}</span></td>
        <td>
          ${canManage ? `
            <button class="btn btn-sm btn-secondary" onclick="app.openEditVendorModal('${v.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteVendor('${v.id}')">Delete</button>
          ` : `<span style="font-size:0.75rem;color:#94a3b8;">View Only</span>`}
        </td>
      </tr>
    `).join('');
  }

  openVendorModal() {
    document.getElementById('modal-vendor-title').textContent = 'Add New Vendor';
    document.getElementById('form-vendor').reset();
    document.getElementById('vendor-id').value = '';
    this.openModal('modal-vendor');
  }

  openEditVendorModal(id) {
    const v = this.db.vendors.find(item => item.id === id);
    if (!v) return;

    document.getElementById('modal-vendor-title').textContent = `Edit Vendor: ${v.name}`;
    document.getElementById('vendor-id').value = v.id;
    document.getElementById('vendor-name').value = v.name;
    document.getElementById('vendor-service').value = v.serviceType;
    document.getElementById('vendor-status').value = v.status;
    document.getElementById('vendor-email').value = v.email;
    document.getElementById('vendor-phone').value = v.phone;
    document.getElementById('vendor-rating').value = v.rating || 4.8;

    this.openModal('modal-vendor');
  }

  async handleSaveVendor(e) {
    e.preventDefault();
    const id = document.getElementById('vendor-id').value;
    const name = document.getElementById('vendor-name').value;
    const serviceType = document.getElementById('vendor-service').value;
    const status = document.getElementById('vendor-status').value;
    const email = document.getElementById('vendor-email').value;
    const phone = document.getElementById('vendor-phone').value;
    const rating = document.getElementById('vendor-rating').value;

    const payload = { name, serviceType, status, email, phone, rating };

    try {
      const url = id ? `/api/vendors/${id}` : '/api/vendors';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error || 'Failed to save vendor');
        return;
      }

      this.closeModal('modal-vendor');
      this.showAlert(`Vendor successfully ${id ? 'updated' : 'saved'}!`, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Server error saving vendor');
    }
  }

  async deleteVendor(id) {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    try {
      const res = await fetch(`/api/vendors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.showAlert('Vendor deleted.', 'info');
        await this.fetchData();
        this.renderAll();
      }
    } catch (e) {
      this.showAlert('Failed to delete vendor');
    }
  }

  // ================= VENUES =================
  renderVenuesTable() {
    const tbody = document.getElementById('venues-table-body');
    if (!tbody) return;

    const search = (document.getElementById('venue-search')?.value || '').toLowerCase();
    const statusFilter = document.getElementById('venue-filter-status')?.value || '';

    const venues = this.db.venues.filter(v => {
      const matchSearch = v.name.toLowerCase().includes(search) || v.address.toLowerCase().includes(search);
      const matchStatus = !statusFilter || v.availabilityStatus === statusFilter;
      return matchSearch && matchStatus;
    });

    const canManage = this.currentRole === 'Event Admin';

    tbody.innerHTML = venues.map(v => `
      <tr>
        <td><strong>${v.id}</strong></td>
        <td><div style="font-weight:600;">${v.name}</div></td>
        <td>${v.address}</td>
        <td>${v.capacity.toLocaleString()} guests</td>
        <td>${v.location ? `<a href="${v.location}" target="_blank" class="btn btn-sm btn-outline">📍 View Map</a>` : '-'}</td>
        <td><span class="badge ${v.availabilityStatus.replace(/\s+/g, '.')}">${v.availabilityStatus}</span></td>
        <td>
          ${canManage ? `
            <button class="btn btn-sm btn-secondary" onclick="app.openEditVenueModal('${v.id}')">Edit</button>
            <button class="btn btn-sm btn-danger" onclick="app.deleteVenue('${v.id}')">Delete</button>
          ` : `<span style="font-size:0.75rem;color:#94a3b8;">View Only</span>`}
        </td>
      </tr>
    `).join('');
  }

  openVenueModal() {
    document.getElementById('modal-venue-title').textContent = 'Add New Venue';
    document.getElementById('form-venue').reset();
    document.getElementById('venue-id').value = '';
    this.openModal('modal-venue');
  }

  openEditVenueModal(id) {
    const v = this.db.venues.find(item => item.id === id);
    if (!v) return;

    document.getElementById('modal-venue-title').textContent = `Edit Venue: ${v.name}`;
    document.getElementById('venue-id').value = v.id;
    document.getElementById('venue-name').value = v.name;
    document.getElementById('venue-capacity').value = v.capacity;
    document.getElementById('venue-status').value = v.availabilityStatus;
    document.getElementById('venue-address').value = v.address;
    document.getElementById('venue-location').value = v.location || '';

    this.openModal('modal-venue');
  }

  async handleSaveVenue(e) {
    e.preventDefault();
    const id = document.getElementById('venue-id').value;
    const name = document.getElementById('venue-name').value;
    const capacity = document.getElementById('venue-capacity').value;
    const availabilityStatus = document.getElementById('venue-status').value;
    const address = document.getElementById('venue-address').value;
    const location = document.getElementById('venue-location').value;

    const payload = { name, capacity, availabilityStatus, address, location };

    try {
      const url = id ? `/api/venues/${id}` : '/api/venues';
      const method = id ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error || 'Failed to save venue');
        return;
      }

      this.closeModal('modal-venue');
      this.showAlert(`Venue successfully ${id ? 'updated' : 'saved'}!`, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Server error saving venue');
    }
  }

  async deleteVenue(id) {
    if (!confirm('Are you sure you want to delete this venue?')) return;
    try {
      const res = await fetch(`/api/venues/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }
      this.showAlert('Venue deleted.', 'info');
      await this.fetchData();
      this.renderAll();
    } catch (e) {
      this.showAlert('Failed to delete venue');
    }
  }

  // ================= EVENT VENDORS (JUNCTION OBJECT) =================
  renderEventVendorsTable() {
    const tbody = document.getElementById('event-vendors-table-body');
    if (!tbody) return;

    const assignments = this.db.eventVendors || [];
    const canManage = this.currentRole !== 'Client';

    if (assignments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 20px; color:#64748b;">No vendor assignments recorded.</td></tr>`;
      return;
    }

    tbody.innerHTML = assignments.map(a => {
      const event = this.db.events.find(e => e.id === a.eventId);
      const vendor = this.db.vendors.find(v => v.id === a.vendorId);

      return `
        <tr>
          <td><strong>${a.id}</strong></td>
          <td>${event ? event.name : a.eventId}</td>
          <td>${event ? event.date : '-'}</td>
          <td><span style="font-weight:600;">${vendor ? vendor.name : a.vendorId}</span></td>
          <td><span class="badge info">${a.serviceType}</span></td>
          <td><small>${a.notes || 'General service'}</small></td>
          <td>
            ${canManage ? `
              <button class="btn btn-sm btn-danger" onclick="app.removeEventVendor('${a.id}')">Remove</button>
            ` : `<span style="font-size:0.75rem;color:#94a3b8;">View Only</span>`}
          </td>
        </tr>
      `;
    }).join('');
  }

  openEventVendorModal() {
    document.getElementById('form-event-vendor').reset();
    this.populateEventSelect('assign-event');
    this.populateVendorSelect('assign-vendor');
    this.openModal('modal-event-vendor');
  }

  onVendorSelectedForAssign() {
    const vId = document.getElementById('assign-vendor').value;
    const vendor = this.db.vendors.find(v => v.id === vId);
    if (vendor) {
      document.getElementById('assign-service').value = vendor.serviceType;
    }
  }

  async handleSaveEventVendor(e) {
    e.preventDefault();
    const eventId = document.getElementById('assign-event').value;
    const vendorId = document.getElementById('assign-vendor').value;
    const serviceType = document.getElementById('assign-service').value;
    const notes = document.getElementById('assign-notes').value;

    try {
      const res = await fetch('/api/event-vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, vendorId, serviceType, notes })
      });
      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }
      this.closeModal('modal-event-vendor');
      this.showAlert('Vendor assigned to event successfully!', 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Failed to assign vendor');
    }
  }

  async removeEventVendor(id) {
    if (!confirm('Remove this vendor assignment from the event?')) return;
    try {
      const res = await fetch(`/api/event-vendors/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.showAlert('Assignment removed', 'info');
        await this.fetchData();
        this.renderAll();
      }
    } catch (e) {
      this.showAlert('Failed to remove assignment');
    }
  }

  // ================= FEEDBACK (LOOKUP FILTER ENFORCED) =================
  renderFeedbackTable() {
    const tbody = document.getElementById('feedback-table-body');
    if (!tbody) return;

    const search = (document.getElementById('feedback-search')?.value || '').toLowerCase();
    const ratingFilter = document.getElementById('feedback-filter-rating')?.value || '';

    const feedbacks = (this.db.feedback || []).filter(f => {
      const client = this.db.clients.find(c => c.id === f.clientId);
      const event = this.db.events.find(e => e.id === f.eventId);
      const clientName = client ? client.name.toLowerCase() : '';
      const eventName = event ? event.name.toLowerCase() : '';
      const comments = (f.comments || '').toLowerCase();

      const matchSearch = clientName.includes(search) || eventName.includes(search) || comments.includes(search);
      const matchRating = !ratingFilter || String(f.rating) === ratingFilter;
      return matchSearch && matchRating;
    });

    const canDelete = this.currentRole === 'Event Admin';

    tbody.innerHTML = feedbacks.map(f => {
      const client = this.db.clients.find(c => c.id === f.clientId);
      const event = this.db.events.find(e => e.id === f.eventId);
      const stars = '⭐'.repeat(f.rating);

      return `
        <tr>
          <td><strong>${f.id}</strong></td>
          <td>${client ? client.name : f.clientId}</td>
          <td>${event ? event.name : f.eventId}</td>
          <td>${stars} (${f.rating}/5)</td>
          <td>${f.comments}</td>
          <td>${f.date}</td>
          <td>
            ${canDelete ? `
              <button class="btn btn-sm btn-danger" onclick="app.deleteFeedback('${f.id}')">Delete</button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  openFeedbackModal() {
    document.getElementById('form-feedback').reset();
    this.populateClientSelect('feedback-client');
    this.onFeedbackClientChange();
    this.openModal('modal-feedback');
  }

  // Activity 3: Lookup Filter Rule (PDF Page 28-29)
  onFeedbackClientChange() {
    const clientId = document.getElementById('feedback-client').value;
    const eventSelect = document.getElementById('feedback-event');
    if (!eventSelect) return;

    // Filter events strictly to those owned by the chosen client
    const clientEvents = this.db.events.filter(e => e.clientId === clientId);
    if (clientEvents.length === 0) {
      eventSelect.innerHTML = `<option value="">-- No events found for this client --</option>`;
    } else {
      eventSelect.innerHTML = clientEvents.map(e => `
        <option value="${e.id}">${e.name} (${e.date} - ${e.status})</option>
      `).join('');
    }
  }

  async handleSaveFeedback(e) {
    e.preventDefault();
    const clientId = document.getElementById('feedback-client').value;
    const eventId = document.getElementById('feedback-event').value;
    const rating = document.getElementById('feedback-rating').value;
    const comments = document.getElementById('feedback-comments').value;

    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId, eventId, rating, comments })
      });
      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }
      this.closeModal('modal-feedback');
      this.showAlert('Feedback recorded successfully! Thank you.', 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Failed to save feedback');
    }
  }

  async deleteFeedback(id) {
    if (!confirm('Delete this feedback entry?')) return;
    try {
      const res = await fetch(`/api/feedback/${id}`, { method: 'DELETE' });
      if (res.ok) {
        this.showAlert('Feedback deleted.', 'info');
        await this.fetchData();
        this.renderAll();
      }
    } catch (e) {
      this.showAlert('Failed to delete feedback');
    }
  }

  // ================= CANCELLATION APPROVAL WORKFLOW =================
  openCancelRequestModal(eventId) {
    const event = this.db.events.find(e => e.id === eventId);
    if (!event) return;

    document.getElementById('cancel-event-id').value = event.id;
    document.getElementById('cancel-event-info').innerHTML = `
      Submitting cancellation request for: <strong>${event.name}</strong><br>
      Date: <strong>${event.date}</strong> | Venue: <strong>${event.venueId}</strong>
    `;
    document.getElementById('cancel-reason').value = '';
    this.openModal('modal-cancel-request');
  }

  async handleSaveCancellationRequest(e) {
    e.preventDefault();
    const eventId = document.getElementById('cancel-event-id').value;
    const reason = document.getElementById('cancel-reason').value;

    try {
      const res = await fetch('/api/cancellation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, requestedBy: this.currentRole, reason })
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }

      this.closeModal('modal-cancel-request');
      this.showAlert('Cancellation request submitted into approval queue!', 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Failed to submit cancellation request');
    }
  }

  async reviewCancellationRequest(requestId, action) {
    try {
      const res = await fetch('/api/cancellation/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action, reviewerName: this.currentRole })
      });

      const data = await res.json();
      if (!res.ok) {
        this.showAlert(data.error);
        return;
      }

      this.showAlert(`Cancellation request was ${action === 'approve' ? 'APPROVED (Venue released)' : 'REJECTED (Event reverted)'}.`, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (err) {
      this.showAlert('Failed to review cancellation request');
    }
  }

  renderApprovalsAndLogs() {
    const queueContainer = document.getElementById('approvals-queue-container');
    const logContainer = document.getElementById('email-log-container');

    if (queueContainer) {
      const requests = this.db.cancellationRequests || [];
      if (requests.length === 0) {
        queueContainer.innerHTML = `<div class="text-muted" style="padding:16px;">No cancellation requests on file.</div>`;
      } else {
        const canReview = this.currentRole === 'Event Admin';
        queueContainer.innerHTML = requests.map(r => {
          const event = this.db.events.find(e => e.id === r.eventId);
          const isPending = r.status === 'Pending';

          return `
            <div class="queue-item">
              <div class="queue-header">
                <div>
                  <strong>${event ? event.name : r.eventId}</strong>
                  <div style="font-size: 0.8rem; color:#64748b;">Requested on: ${r.requestDate} by ${r.requestedBy}</div>
                </div>
                <span class="badge ${r.status === 'Approved' ? 'Canceled' : (r.status === 'Pending' ? 'warning' : 'Rejected')}">${r.status}</span>
              </div>
              <p style="font-size:0.85rem; margin: 8px 0; color:#334155;"><strong>Reason:</strong> ${r.reason}</p>
              ${isPending && canReview ? `
                <div class="queue-actions">
                  <button class="btn btn-sm btn-primary" onclick="app.reviewCancellationRequest('${r.id}', 'approve')">✓ Approve Cancellation</button>
                  <button class="btn btn-sm btn-danger" onclick="app.reviewCancellationRequest('${r.id}', 'reject')">✕ Reject Request</button>
                </div>
              ` : (isPending && !canReview ? `<small style="color:#b45309;">Waiting for Event Admin approval</small>` : `<small style="color:#15803d;">Reviewed by ${r.reviewedBy || 'Admin'} on ${r.reviewDate}</small>`)}
            </div>
          `;
        }).join('');
      }
    }

    if (logContainer) {
      const logs = this.db.notificationLogs || [];
      if (logs.length === 0) {
        logContainer.innerHTML = `<div class="text-muted" style="padding:16px;">No email alert records.</div>`;
      } else {
        logContainer.innerHTML = logs.map(l => `
          <div class="log-item">
            <div class="log-header">
              <span>✉️ ${l.subject}</span>
              <small style="color:#64748b;">${l.date}</small>
            </div>
            <div style="font-size:0.8rem;color:#475569;">To: <strong>${l.recipient}</strong> | Type: <em>${l.type}</em></div>
            ${l.body ? `<pre style="font-size:0.75rem; background:#f1f5f9; padding:6px; border-radius:4px; margin-top:6px; white-space:pre-wrap;">${l.body}</pre>` : ''}
          </div>
        `).join('');
      }
    }
  }

  // ================= AUTOMATION TRIGGERS =================
  async trigger3DayReminders() {
    try {
      const res = await fetch('/api/flows/trigger-reminders', { method: 'POST' });
      const data = await res.json();
      this.showAlert(data.message, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (e) {
      this.showAlert('Failed to trigger 3-Day Reminder flow');
    }
  }

  async runNightlyBatchJob() {
    try {
      const res = await fetch('/api/batch/complete-past-events', { method: 'POST' });
      const data = await res.json();
      this.showAlert(data.message, 'success');
      await this.fetchData();
      this.renderAll();
    } catch (e) {
      this.showAlert('Failed to execute batch job');
    }
  }

  // ================= REPORTS =================
  showReport(reportKey) {
    this.currentReport = reportKey;
    document.querySelectorAll('.sub-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = Array.from(document.querySelectorAll('.sub-tab-btn')).find(b => b.getAttribute('onclick')?.includes(reportKey));
    if (btn) btn.classList.add('active');

    const card = document.getElementById('report-output-card');
    if (!card) return;

    const events = this.db.events;
    const clients = this.db.clients;
    const venues = this.db.venues;
    const vendors = this.db.vendors;

    if (reportKey === 'upcoming-month') {
      // Salesforce Milestone 12 - Report 1
      const today = new Date().toISOString().split('T')[0];
      const upcoming = events.filter(e => e.date >= today && e.status !== 'Canceled');

      // Group by Month
      const grouped = {};
      upcoming.forEach(e => {
        const m = e.date.substring(0, 7);
        if (!grouped[m]) grouped[m] = [];
        grouped[m].push(e);
      });

      let grandTotalBudget = 0;
      let grandTotalEvents = 0;

      let html = `
        <div style="margin-bottom:16px;">
          <h3>Report 1: Upcoming Events — Summary by Month (Milestone 12)</h3>
          <p style="color:#64748b; font-size:0.85rem;">Filters: All Events | Date >= TODAY | Status ≠ Canceled | Grouped by Calendar Month</p>
        </div>
      `;

      Object.keys(grouped).sort().forEach(m => {
        const evs = grouped[m];
        const monthBudget = evs.reduce((acc, ev) => acc + (ev.budget || 0), 0);
        grandTotalBudget += monthBudget;
        grandTotalEvents += evs.length;

        html += `
          <div style="margin-top:20px; border-bottom:2px solid #cbd5e1; padding-bottom:6px;">
            <strong style="font-size:1rem; color:#1e40af;">📅 Month: ${m} (${evs.length} Events, Subtotal Budget: ₹${monthBudget.toLocaleString()})</strong>
          </div>
          <table class="data-table" style="margin-top:8px;">
            <thead>
              <tr>
                <th>Event Name</th>
                <th>Event Date</th>
                <th>Type</th>
                <th>Client</th>
                <th>Venue</th>
                <th>Budget</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${evs.map(e => {
                const c = clients.find(item => item.id === e.clientId);
                const v = venues.find(item => item.id === e.venueId);
                return `
                  <tr>
                    <td><strong>${e.name}</strong></td>
                    <td>${e.date}</td>
                    <td><span class="badge info">${e.type}</span></td>
                    <td>${c ? c.name : e.clientId}</td>
                    <td>${v ? v.name : e.venueId}</td>
                    <td>₹${Number(e.budget).toLocaleString()}</td>
                    <td><span class="badge ${e.status.replace(/\s+/g, '.')}">${e.status}</span></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `;
      });

      html += `
        <div style="margin-top:24px; padding:12px; background:#f1f5f9; border-radius:6px; font-weight:700; display:flex; justify-content:space-between;">
          <span>Grand Total Events: ${grandTotalEvents}</span>
          <span>Grand Total Upcoming Budget: ₹${grandTotalBudget.toLocaleString()}</span>
        </div>
      `;

      card.innerHTML = html;
    } else if (reportKey === 'events-by-type') {
      const typeSummary = {};
      events.forEach(e => {
        if (!typeSummary[e.type]) typeSummary[e.type] = { count: 0, budget: 0 };
        typeSummary[e.type].count++;
        typeSummary[e.type].budget += (e.budget || 0);
      });

      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 2: Events by Type Summary</h3>
          <p style="color:#64748b; font-size:0.85rem;">Categorical analysis of bookings and allocation</p>
        </div>
        <table class="data-table">
          <thead>
            <tr><th>Event Type</th><th>Count</th><th>Total Budget</th><th>Avg Budget / Event</th></tr>
          </thead>
          <tbody>
            ${Object.keys(typeSummary).map(k => `
              <tr>
                <td><strong>${k}</strong></td>
                <td>${typeSummary[k].count}</td>
                <td>₹${typeSummary[k].budget.toLocaleString()}</td>
                <td>₹${Math.round(typeSummary[k].budget / typeSummary[k].count).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportKey === 'events-by-status') {
      const statusSummary = {};
      events.forEach(e => {
        statusSummary[e.status] = (statusSummary[e.status] || 0) + 1;
      });

      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 3: Events by Lifecycle Status</h3>
        </div>
        <table class="data-table">
          <thead><tr><th>Status</th><th>Events Count</th><th>Percentage</th></tr></thead>
          <tbody>
            ${Object.keys(statusSummary).map(k => `
              <tr>
                <td><span class="badge ${k.replace(/\s+/g, '.')}">${k}</span></td>
                <td>${statusSummary[k]}</td>
                <td>${((statusSummary[k] / events.length) * 100).toFixed(1)}%</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportKey === 'venues-utilization') {
      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 4: Venues Utilization & Capacity</h3>
        </div>
        <table class="data-table">
          <thead><tr><th>Venue</th><th>Capacity</th><th>Availability</th><th>Address</th></tr></thead>
          <tbody>
            ${venues.map(v => `
              <tr>
                <td><strong>${v.name}</strong></td>
                <td>${v.capacity.toLocaleString()} persons</td>
                <td><span class="badge ${v.availabilityStatus.replace(/\s+/g, '.')}">${v.availabilityStatus}</span></td>
                <td>${v.address}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportKey === 'vendors-directory') {
      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 5: Available Vendors Directory</h3>
        </div>
        <table class="data-table">
          <thead><tr><th>Vendor Name</th><th>Service Type</th><th>Status</th><th>Rating</th><th>Contact</th></tr></thead>
          <tbody>
            ${vendors.map(v => `
              <tr>
                <td><strong>${v.name}</strong></td>
                <td><span class="badge info">${v.serviceType}</span></td>
                <td><span class="badge ${v.status}">${v.status}</span></td>
                <td>⭐ ${v.rating}</td>
                <td>${v.email} | ${v.phone}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else if (reportKey === 'feedback-summary') {
      const fb = this.db.feedback || [];
      const avg = fb.length ? (fb.reduce((s, f) => s + f.rating, 0) / fb.length).toFixed(2) : 0;
      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 6: Client Feedback & Satisfaction Summary</h3>
          <p style="color:#64748b;">Average Score: <strong>⭐ ${avg} / 5.0</strong> across ${fb.length} reviews</p>
        </div>
        <table class="data-table">
          <thead><tr><th>ID</th><th>Client</th><th>Event</th><th>Score</th><th>Review</th><th>Date</th></tr></thead>
          <tbody>
            ${fb.map(f => {
              const c = clients.find(item => item.id === f.clientId);
              const ev = events.find(item => item.id === f.eventId);
              return `
                <tr>
                  <td><strong>${f.id}</strong></td>
                  <td>${c ? c.name : f.clientId}</td>
                  <td>${ev ? ev.name : f.eventId}</td>
                  <td>⭐ ${f.rating}</td>
                  <td>${f.comments}</td>
                  <td>${f.date}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } else if (reportKey === 'budget-summary') {
      const totalBudget = events.reduce((s, e) => s + (e.budget || 0), 0);
      card.innerHTML = `
        <div style="margin-bottom:16px;">
          <h3>Report 7: Event Budget Summary</h3>
          <p style="color:#64748b;">Total Portfolio Budget: <strong>₹${totalBudget.toLocaleString()}</strong></p>
        </div>
        <table class="data-table">
          <thead><tr><th>Event ID</th><th>Event Name</th><th>Type</th><th>Status</th><th>Budget</th></tr></thead>
          <tbody>
            ${events.map(e => `
              <tr>
                <td><strong>${e.id}</strong></td>
                <td>${e.name}</td>
                <td><span class="badge info">${e.type}</span></td>
                <td><span class="badge ${e.status.replace(/\s+/g, '.')}">${e.status}</span></td>
                <td>₹${Number(e.budget).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  }

  exportReportCSV() {
    let rows = [];
    if (this.currentReport === 'upcoming-month') {
      rows.push(['Event ID', 'Event Name', 'Date', 'Type', 'Budget', 'Status']);
      this.db.events.forEach(e => {
        rows.push([e.id, `"${e.name}"`, e.date, e.type, e.budget, e.status]);
      });
    } else {
      rows.push(['Record ID', 'Name / Info', 'Details']);
      this.db.events.forEach(e => rows.push([e.id, `"${e.name}"`, `₹${e.budget}`]));
    }

    const csvContent = "data:text/csv;charset=utf-8," + rows.map(r => r.join(',')).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `EventForce_${this.currentReport}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ================= UTILITIES & MODAL HELPERS =================
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('hidden');
  }

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('hidden');
  }

  populateClientSelect(selectId, selectedId = null) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = this.db.clients.map(c => `
      <option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${c.name} (${c.city}, ${c.country})</option>
    `).join('');
  }

  populateVenueSelect(selectId, selectedId = null) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = this.db.venues.map(v => `
      <option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${v.name} (Cap: ${v.capacity} - ${v.availabilityStatus})</option>
    `).join('');
  }

  populateEventSelect(selectId, selectedId = null) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = this.db.events.map(e => `
      <option value="${e.id}" ${e.id === selectedId ? 'selected' : ''}>${e.name} (${e.date})</option>
    `).join('');
  }

  populateVendorSelect(selectId, selectedId = null) {
    const el = document.getElementById(selectId);
    if (!el) return;
    el.innerHTML = this.db.vendors.map(v => `
      <option value="${v.id}" ${v.id === selectedId ? 'selected' : ''}>${v.name} (${v.serviceType})</option>
    `).join('');
  }
}

// Instantiate Global Application
const app = new EventForceApp();
