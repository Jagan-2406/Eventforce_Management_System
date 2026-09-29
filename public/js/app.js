// EventForce Application Core Controller
let currentUser = null;
let currentTab = 'events';
let activeCategory = 'All';
let eventsList = [];
let categoryChartInstance = null;
let workforceChartInstance = null;

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
  initUserSession();
  setupEventListeners();
  await loadEvents();
});

// User Session Management
function initUserSession() {
  currentUser = api.getUser();
  updateAuthUI();
}

function updateAuthUI() {
  const userSection = document.getElementById('userSection');
  const navWorkforce = document.getElementById('navWorkforce');
  const navAdmin = document.getElementById('navAdmin');
  const navMyTickets = document.getElementById('navMyTickets');

  if (currentUser) {
    const roleBadges = {
      'admin': { label: '👑 Director', bg: 'rgba(168, 85, 247, 0.2)', color: '#d8b4fe', border: 'rgba(168, 85, 247, 0.4)' },
      'staff': { label: '👷 Crew Staff', bg: 'rgba(245, 158, 11, 0.2)', color: '#fde68a', border: 'rgba(245, 158, 11, 0.4)' },
      'attendee': { label: '🎓 Attendee', bg: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', border: 'rgba(16, 185, 129, 0.4)' }
    };
    const b = roleBadges[currentUser.role] || roleBadges.attendee;

    userSection.innerHTML = `
      <div class="flex items-center gap-3">
        <div class="text-right" style="display:none; @media(min-width:640px){display:block;}">
          <p style="font-size:0.85rem; font-weight:800; color:#ffffff; line-height:1.2;">${currentUser.name}</p>
          <span style="display:inline-block; font-size:0.65rem; font-weight:800; text-transform:uppercase; letter-spacing:0.05em; padding:0.1rem 0.45rem; border-radius:0.35rem; background:${b.bg}; color:${b.color}; border:1px solid ${b.border}; margin-top:2px;">
            ${b.label}
          </span>
        </div>
        <img src="${currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80'}" 
             style="width:2.5rem; height:2.5rem; border-radius:50%; border:2px solid #6366f1; object-fit:cover; box-shadow:0 0 12px rgba(99,102,241,0.4);" 
             alt="Avatar"
             onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';">
        <button onclick="handleLogout()" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; font-size:1.05rem; padding:0.4rem; transition:color 0.2s;" onmouseover="this.style.color='#f43f5e'" onmouseout="this.style.color='var(--text-dim)'" title="Sign Out">
          <i class="fas fa-sign-out-alt"></i>
        </button>
      </div>
    `;

    // Role-dependent navigation visibility
    if (navWorkforce) navWorkforce.classList.remove('hidden');
    if (navAdmin) {
      if (currentUser.role === 'admin') {
        navAdmin.classList.remove('hidden');
      } else {
        navAdmin.classList.add('hidden');
      }
    }
    if (navMyTickets) navMyTickets.classList.remove('hidden');
  } else {
    userSection.innerHTML = `
      <div class="flex items-center gap-2">
        <button onclick="openLoginModal()" class="ef-btn ef-btn-secondary ef-btn-sm">
          Sign In
        </button>
        <button onclick="openRegisterModal()" class="ef-btn ef-btn-primary ef-btn-sm">
          Register
        </button>
      </div>
    `;
    if (navWorkforce) navWorkforce.classList.remove('hidden');
    if (navAdmin) navAdmin.classList.remove('hidden');
    if (navMyTickets) navMyTickets.classList.remove('hidden');
  }
}

// Quick Demo Login Switcher
async function quickSwitchDemo(role) {
  try {
    let email = 'admin@eventforce.com';
    let password = 'admin123';

    if (role === 'staff') {
      email = 'staff1@eventforce.com';
      password = 'staff123';
    } else if (role === 'attendee') {
      email = 'attendee@eventforce.com';
      password = 'user123';
    }

    showToast(`Switching to ${role.toUpperCase()} persona...`, 'info');
    const res = await api.login(email, password);
    currentUser = res.user;
    updateAuthUI();
    showToast(`Active as ${res.user.name} (${role})`, 'success');

    if (role === 'admin') {
      switchTab('admin');
    } else if (role === 'staff') {
      switchTab('workforce');
    } else {
      switchTab('events');
    }
  } catch (err) {
    showToast('Failed to switch demo account: ' + err.message, 'error');
  }
}

function handleLogout() {
  api.clearSession();
  currentUser = null;
  updateAuthUI();
  showToast('Logged out successfully', 'info');
  switchTab('events');
}

// Navigation Tab Switcher
function switchTab(tab) {
  currentTab = tab;

  ['navEvents', 'navMyTickets', 'navWorkforce', 'navAdmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('active', 'text-indigo-600', 'font-bold', 'border-b-2', 'border-indigo-600');
    }
  });

  const activeNav = document.getElementById({
    'events': 'navEvents',
    'my-tickets': 'navMyTickets',
    'workforce': 'navWorkforce',
    'admin': 'navAdmin'
  }[tab]);

  if (activeNav) {
    activeNav.classList.add('active', 'text-indigo-600');
  }

  // Switch content containers
  ['viewEvents', 'viewMyTickets', 'viewWorkforce', 'viewAdmin'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  const activeView = document.getElementById({
    'events': 'viewEvents',
    'my-tickets': 'viewMyTickets',
    'workforce': 'viewWorkforce',
    'admin': 'viewAdmin'
  }[tab]);

  if (activeView) activeView.classList.remove('hidden');

  // Trigger data loaders for specific tabs
  if (tab === 'events') {
    loadEvents();
  } else if (tab === 'my-tickets') {
    loadMyTickets();
  } else if (tab === 'workforce') {
    loadWorkforcePortal();
  } else if (tab === 'admin') {
    loadAdminDashboard();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Load and Render Events
async function loadEvents() {
  try {
    const searchInput = document.getElementById('eventSearchInput');
    const query = searchInput ? searchInput.value.trim() : '';

    const res = await api.getEvents({
      category: activeCategory,
      search: query
    });

    eventsList = res.events || [];
    renderEventsGrid(eventsList);
  } catch (err) {
    showToast('Failed to load events: ' + err.message, 'error');
  }
}

function filterCategory(cat) {
  activeCategory = cat;
  document.querySelectorAll('.cat-pill').forEach(btn => {
    if (btn.dataset.category === cat) {
      btn.className = 'cat-pill active';
    } else {
      btn.className = 'cat-pill';
    }
  });
  loadEvents();
}

function renderEventsGrid(events) {
  const grid = document.getElementById('eventsGrid');
  const countEl = document.getElementById('eventsCountBadge');
  if (countEl) countEl.innerText = `${events.length} Summits Available`;

  if (!events || events.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 4rem 1.5rem; text-align: center;" class="glass-card">
        <div style="width: 4rem; height: 4rem; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 1.5rem; color: #64748b;">
          <i class="fas fa-calendar-times"></i>
        </div>
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #ffffff;">No Summits Found</h3>
        <p style="font-size: 0.82rem; color: var(--text-dim); margin-top: 0.25rem;">Try selecting another category or clear your search term.</p>
      </div>
    `;
    return;
  }

  const categoryStyles = {
    'Technical': { bg: 'rgba(2, 132, 199, 0.2)', color: '#38bdf8', border: 'rgba(2, 132, 199, 0.4)' },
    'Conference': { bg: 'rgba(139, 92, 246, 0.2)', color: '#c084fc', border: 'rgba(139, 92, 246, 0.4)' },
    'Cultural': { bg: 'rgba(219, 39, 119, 0.2)', color: '#f472b6', border: 'rgba(219, 39, 119, 0.4)' },
    'Sports': { bg: 'rgba(5, 150, 105, 0.2)', color: '#34d399', border: 'rgba(5, 150, 105, 0.4)' },
    'Workshop': { bg: 'rgba(217, 119, 6, 0.2)', color: '#fbbf24', border: 'rgba(217, 119, 6, 0.4)' }
  };

  grid.innerHTML = events.map(evt => {
    const occupancy = Math.round((evt.registeredCount / evt.capacity) * 100);
    const isFull = evt.registeredCount >= evt.capacity;
    const isFree = evt.ticketPrice === 0;
    const catStyle = categoryStyles[evt.category] || categoryStyles.Conference;

    return `
      <article class="event-card">
        <div>
          <!-- Banner Container -->
          <div class="event-card-media" onclick="openEventDetailsModal('${evt.id}')">
            <img src="${evt.bannerUrl}" alt="${evt.title}" 
                 class="event-card-img"
                 onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';">
            <div class="event-card-media-gradient"></div>
            <span class="event-badge-cat" style="background:${catStyle.bg}; color:${catStyle.color}; border-color:${catStyle.border};">
              ${evt.category}
            </span>
            <span class="event-badge-price" style="background:${isFree ? '#059669' : '#0f172a'}; color:#ffffff; border:1px solid ${isFree ? 'rgba(16,185,129,0.5)' : 'rgba(255,255,255,0.2)'};">
              ${isFree ? 'FREE PASS' : `$${evt.ticketPrice}`}
            </span>
          </div>

          <!-- Body Content -->
          <div class="event-card-body">
            <div class="event-date-row">
              <i class="far fa-calendar-alt"></i>
              <span>${new Date(evt.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
              <span style="color:var(--border-card);">•</span>
              <i class="far fa-clock"></i>
              <span>${evt.time}</span>
            </div>

            <h3 class="event-title-clamp" onclick="openEventDetailsModal('${evt.id}')" title="${evt.title}">
              ${evt.title}
            </h3>

            <p class="event-venue-row">
              <i class="fas fa-map-marker-alt" style="color:#818cf8; flex-shrink:0;"></i>
              <span class="truncate">${evt.venue}</span>
            </p>

            <p class="event-desc-clamp">
              ${evt.description}
            </p>

            <!-- Occupancy bar -->
            <div class="occupancy-wrapper">
              <div class="occupancy-labels">
                <span>Registrations: <strong style="color:#ffffff;">${evt.registeredCount}</strong> / ${evt.capacity}</span>
                <span style="color:${isFull ? '#f43f5e' : occupancy > 80 ? '#fbbf24' : '#94a3b8'};">
                  ${isFull ? 'Sold Out' : `${evt.capacity - evt.registeredCount} seats left`}
                </span>
              </div>
              <div class="occupancy-bar">
                <div class="occupancy-fill ${isFull ? 'danger' : occupancy > 80 ? 'warning' : ''}" 
                     style="width: ${Math.min(100, occupancy)}%"></div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="event-card-footer">
          <button onclick="openEventDetailsModal('${evt.id}')" class="ef-btn ef-btn-secondary ef-btn-sm">
            <i class="fas fa-info-circle" style="color:#94a3b8;"></i>
            <span>Details</span>
          </button>
          <button onclick="openBookingModal('${evt.id}')" 
                  ${isFull ? 'disabled' : ''}
                  class="ef-btn ${isFull ? 'ef-btn-secondary' : 'ef-btn-primary'} ef-btn-sm" 
                  style="${isFull ? 'opacity:0.5; cursor:not-allowed;' : ''}">
            <i class="fas fa-ticket-alt"></i>
            <span>${isFull ? 'Full' : 'Book Pass'}</span>
          </button>
        </div>
      </article>
    `;
  }).join('');
}

// Event Details Modal
async function openEventDetailsModal(eventId) {
  try {
    const res = await api.getEvent(eventId);
    const evt = res.event;
    const tasks = res.workforceTasks || [];
    const speakers = evt.speakers || [];
    const sponsors = evt.sponsors || [];
    const agenda = evt.agenda || [];
    const feedbacks = evt.feedbacks || [];

    const modalContent = document.getElementById('eventDetailsContent');
    modalContent.innerHTML = `
      <div style="position:relative; height:18rem; overflow:hidden;">
        <img src="${evt.bannerUrl}" style="width:100%; height:100%; object-fit:cover;" alt="${evt.title}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=1200&q=80';">
        <div style="position:absolute; inset:0; background:linear-gradient(180deg, rgba(7,10,18,0.2) 0%, rgba(7,10,18,0.7) 50%, rgba(13,19,34,1) 100%);"></div>
        <button onclick="closeModal('eventDetailsModal')" style="position:absolute; top:1.25rem; right:1.25rem; width:2.25rem; height:2.25rem; border-radius:50%; background:rgba(0,0,0,0.6); backdrop-filter:blur(10px); border:1px solid rgba(255,255,255,0.2); color:#ffffff; display:flex; align-items:center; justify-content:center; cursor:pointer;">
          <i class="fas fa-times"></i>
        </button>
        <div style="position:absolute; bottom:1.5rem; left:1.75rem; right:1.75rem; color:#ffffff;">
          <span class="badge-tag" style="background:#6366f1; color:#ffffff; margin-bottom:0.6rem;">
            ${evt.category}
          </span>
          <h2 style="font-size:1.85rem; font-weight:900; line-height:1.2;">${evt.title}</h2>
          <p style="font-size:0.85rem; color:#cbd5e1; margin-top:0.35rem; display:flex; align-items:center; gap:0.5rem;">
            <span>Organized by <strong style="color:#ffffff;">${evt.organizerName}</strong></span>
            <span>•</span>
            <span>${evt.venue}</span>
          </p>
        </div>
      </div>

      <div style="padding:1.75rem; display:flex; flex-direction:column; gap:1.75rem;">
        <!-- Date, Venue & Pricing Grid -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div style="padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem;">
            <span class="telemetry-label" style="margin-top:0;">DATE & TIME</span>
            <p style="font-size:0.95rem; font-weight:800; color:#ffffff; margin-top:0.35rem;">${new Date(evt.date).toDateString()}</p>
            <p style="font-size:0.8rem; color:#818cf8; font-weight:600;">${evt.time}</p>
          </div>
          <div style="padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem;">
            <span class="telemetry-label" style="margin-top:0;">VENUE LOCATION</span>
            <p style="font-size:0.92rem; font-weight:800; color:#ffffff; margin-top:0.35rem;">${evt.venue}</p>
          </div>
          <div style="padding:1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem;">
            <span class="telemetry-label" style="margin-top:0;">ADMISSION TICKET</span>
            <p style="font-size:1.1rem; font-weight:900; color:${evt.ticketPrice === 0 ? '#10b981' : '#ffffff'}; margin-top:0.35rem;">
              ${evt.ticketPrice === 0 ? 'FREE ENTRY' : `$${evt.ticketPrice} / pass`}
            </p>
            <p style="font-size:0.75rem; color:var(--text-muted);">${evt.seatsLeft} of ${evt.capacity} seats remaining</p>
          </div>
        </div>

        <!-- Overview -->
        <div>
          <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-bottom:0.5rem; display:flex; align-items:center; gap:0.5rem;">
            <i class="fas fa-align-left" style="color:#818cf8;"></i> Summit Overview
          </h4>
          <p style="font-size:0.9rem; color:#94a3b8; line-height:1.65;">${evt.description}</p>
        </div>

        <!-- Featured Keynote Speakers -->
        ${speakers.length > 0 ? `
          <div style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
            <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem;">
              <i class="fas fa-microphone-alt" style="color:#818cf8;"></i> Featured Keynote Speakers
            </h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${speakers.map(spk => `
                <div style="padding:0.85rem 1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:1rem; display:flex; align-items:center; gap:0.85rem;">
                  <img src="${spk.avatar}" style="width:3.2rem; height:3.2rem; border-radius:50%; object-fit:cover; border:2px solid #818cf8; flex-shrink:0;" alt="${spk.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80';">
                  <div style="min-width:0;">
                    <p style="font-size:0.9rem; font-weight:800; color:#ffffff;" class="truncate">${spk.name}</p>
                    <p style="font-size:0.75rem; color:#818cf8; font-weight:600;" class="truncate">${spk.role} • ${spk.company}</p>
                    <p style="font-size:0.72rem; color:var(--text-dim); margin-top:0.2rem; font-style:italic;" class="truncate">"${spk.topic}"</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Multi-Track Agenda / Schedule -->
        ${agenda.length > 0 ? `
          <div style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
            <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem;">
              <i class="far fa-calendar-check" style="color:#818cf8;"></i> Session Schedule & Tracks
            </h4>
            <div style="display:flex; flex-direction:column; gap:0.6rem;">
              ${agenda.map(ag => `
                <div style="padding:0.75rem 1rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:0.85rem; display:flex; align-items:center; justify-content:space-between; gap:1rem;">
                  <div style="display:flex; align-items:center; gap:0.85rem;">
                    <span class="font-mono" style="font-size:0.75rem; font-weight:700; padding:0.25rem 0.6rem; border-radius:0.4rem; background:rgba(99,102,241,0.2); color:#a5b4fc; border:1px solid rgba(99,102,241,0.3);">${ag.time}</span>
                    <div>
                      <p style="font-size:0.88rem; font-weight:800; color:#ffffff;">${ag.title}</p>
                      <p style="font-size:0.75rem; color:var(--text-dim);">Presenter: ${ag.speaker}</p>
                    </div>
                  </div>
                  <span class="badge-tag" style="background:rgba(255,255,255,0.05); color:#94a3b8; border:1px solid rgba(255,255,255,0.08);">
                    📍 ${ag.room}
                  </span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Supporting Sponsors -->
        ${sponsors.length > 0 ? `
          <div style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
            <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; margin-bottom:0.85rem; display:flex; align-items:center; gap:0.5rem;">
              <i class="fas fa-handshake" style="color:#818cf8;"></i> Supporting Sponsors & Partners
            </h4>
            <div class="flex items-center gap-2 flex-wrap">
              ${sponsors.map(sp => `
                <div class="sponsor-chip">
                  ${sp.logo ? `<img src="${sp.logo}" style="width:1.2rem; height:1.2rem; border-radius:50%;" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=120&q=80'" alt="">` : ''}
                  <span>${sp.name}</span>
                  <span style="font-size:0.65rem; color:#818cf8; background:rgba(99,102,241,0.15); padding:0.15rem 0.4rem; border-radius:0.3rem;">${sp.tier}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Assigned Workforce Crew Section -->
        <div style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
          <div class="flex items-center justify-between" style="margin-bottom:0.85rem;">
            <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; display:flex; align-items:center; gap:0.5rem;">
              <i class="fas fa-users-cog" style="color:#818cf8;"></i> Assigned EventForce Crew (${tasks.length})
            </h4>
            <span class="telemetry-label" style="margin:0;">Live Shift Status</span>
          </div>

          ${tasks.length === 0 ? `
            <p style="font-size:0.82rem; color:var(--text-dim); font-style:italic;">No crew tasks assigned to this summit yet.</p>
          ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              ${tasks.map(t => `
                <div style="padding:0.75rem 1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:0.85rem; display:flex; align-items:center; justify-content:space-between;">
                  <div>
                    <p style="font-size:0.85rem; font-weight:800; color:#ffffff;">${t.title}</p>
                    <p style="font-size:0.72rem; color:var(--text-dim);">Crew: <span style="color:#818cf8; font-weight:700;">${t.assignedToName}</span> (${t.roleRequired})</p>
                  </div>
                  <span class="badge-tag" style="background:${t.status === 'Completed' ? 'rgba(16,185,129,0.2)' : t.status === 'In Progress' ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.1)'}; color:${t.status === 'Completed' ? '#6ee7b7' : t.status === 'In Progress' ? '#fde68a' : '#cbd5e1'};">
                    ${t.status}
                  </span>
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Attendee Reviews & Star Ratings -->
        <div style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
          <div class="flex items-center justify-between" style="margin-bottom:0.85rem;">
            <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; display:flex; align-items:center; gap:0.5rem;">
              <i class="fas fa-star" style="color:#f59e0b;"></i> Attendee Feedback (${feedbacks.length})
            </h4>
          </div>

          ${feedbacks.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:0.6rem; margin-bottom:1rem;">
              ${feedbacks.map(fb => `
                <div style="padding:0.85rem 1rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.07); border-radius:0.85rem;">
                  <div class="flex items-center justify-between" style="margin-bottom:0.25rem;">
                    <span style="font-size:0.85rem; font-weight:800; color:#ffffff;">${fb.attendeeName}</span>
                    <span style="color:#f59e0b; font-size:0.85rem;">${'★'.repeat(fb.rating)}${'☆'.repeat(5 - fb.rating)}</span>
                  </div>
                  <p style="font-size:0.8rem; color:#94a3b8;">${fb.comment}</p>
                </div>
              `).join('')}
            </div>
          ` : `
            <p style="font-size:0.82rem; color:var(--text-dim); font-style:italic; margin-bottom:1rem;">No reviews submitted yet. Be the first to share your experience!</p>
          `}

          <!-- Review Submission Form -->
          <div style="padding:1rem; background:rgba(99,102,241,0.08); border:1px solid rgba(99,102,241,0.2); border-radius:1rem;">
            <p style="font-size:0.82rem; font-weight:800; color:#ffffff; margin-bottom:0.5rem;">Leave Feedback</p>
            <div class="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select id="reviewRatingSelect" class="form-control" style="width:auto; min-width:130px;">
                <option value="5">★★★★★ (5 Stars)</option>
                <option value="4">★★★★☆ (4 Stars)</option>
                <option value="3">★★★☆☆ (3 Stars)</option>
              </select>
              <input type="text" id="reviewCommentInput" placeholder="Share your experience..." class="form-control" style="flex:1;">
              <button onclick="handleFeedbackSubmit('${evt.id}')" class="ef-btn ef-btn-primary ef-btn-sm" style="flex-shrink:0;">
                Submit
              </button>
            </div>
          </div>
        </div>

        <!-- Action Bar -->
        <div class="flex items-center justify-end gap-3" style="padding-top:1.25rem; border-top:1px solid rgba(255,255,255,0.08);">
          <button onclick="closeModal('eventDetailsModal')" class="ef-btn ef-btn-secondary">
            Close
          </button>
          <button onclick="closeModal('eventDetailsModal'); openBookingModal('${evt.id}')" class="ef-btn ef-btn-primary">
            Proceed to Book Pass
          </button>
        </div>
      </div>
    `;

    openModal('eventDetailsModal');
  } catch (err) {
    showToast('Failed to load event details: ' + err.message, 'error');
  }
}

async function handleFeedbackSubmit(eventId) {
  if (!currentUser) {
    showToast('Please sign in to submit feedback!', 'warning');
    openLoginModal();
    return;
  }
  const rating = document.getElementById('reviewRatingSelect').value;
  const comment = document.getElementById('reviewCommentInput').value.trim();

  try {
    await api.submitFeedback(eventId, rating, comment);
    triggerConfetti();
    showToast('Thank you for your feedback!', 'success');
    openEventDetailsModal(eventId);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Booking Modal
function openBookingModal(eventId) {
  const event = eventsList.find(e => e.id === eventId);
  if (!event) {
    showToast('Event not found', 'error');
    return;
  }

  document.getElementById('bookingEventId').value = event.id;
  document.getElementById('bookingEventTitle').innerText = event.title;
  document.getElementById('bookingEventPrice').innerText = event.ticketPrice === 0 ? 'FREE' : `$${event.ticketPrice}`;
  document.getElementById('bookingEventDate').innerText = `${new Date(event.date).toLocaleDateString()} (${event.time})`;
  document.getElementById('bookingEventVenue').innerText = event.venue;

  if (currentUser) {
    document.getElementById('bookAttendeeName').value = currentUser.name || '';
    document.getElementById('bookAttendeeEmail').value = currentUser.email || '';
    document.getElementById('bookAttendeePhone').value = currentUser.phone || '';
  }

  openModal('bookingModal');
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const eventId = document.getElementById('bookingEventId').value;
  const name = document.getElementById('bookAttendeeName').value.trim();
  const email = document.getElementById('bookAttendeeEmail').value.trim();
  const phone = document.getElementById('bookAttendeePhone').value.trim();
  const college = document.getElementById('bookAttendeeCollege').value.trim();

  if (!currentUser) {
    showToast('Please sign in or use one-click Attendee login to book tickets!', 'warning');
    openLoginModal();
    return;
  }

  try {
    const res = await api.bookTicket({
      eventId,
      attendeeName: name,
      attendeeEmail: email,
      attendeePhone: phone,
      college
    });

    closeModal('bookingModal');
    triggerConfetti();
    showToast('🎉 Admission pass confirmed!', 'success');

    showTicketPass(res.ticket);
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Display Digital Ticket Pass with QR Code
function showTicketPass(ticket) {
  const container = document.getElementById('ticketPassContainer');
  container.innerHTML = `
    <div id="printableTicket" class="ticket-hologram-card" style="padding:2rem;">
      <div class="ticket-notch-left"></div>
      <div class="ticket-notch-right"></div>

      <div class="flex items-center justify-between" style="padding-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.1);">
        <div>
          <span style="font-size:0.68rem; font-weight:800; letter-spacing:0.1em; text-transform:uppercase; color:#818cf8;">EventForce Official Pass</span>
          <h3 style="font-size:1.45rem; font-weight:900; color:#ffffff; margin-top:0.2rem;">${ticket.eventTitle}</h3>
        </div>
        <div class="text-right">
          <span class="telemetry-label" style="margin:0;">PASS SERIAL</span>
          <span class="font-mono" style="font-size:0.95rem; font-weight:800; color:#38bdf8;">${ticket.ticketNumber}</span>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-6" style="padding:1.5rem 0; align-items:center;">
        <div style="display:flex; flex-direction:column; gap:1rem;" class="md:col-span-2">
          <div>
            <span class="telemetry-label" style="margin:0;">DELEGATE / ATTENDEE</span>
            <p style="font-size:1.15rem; font-weight:800; color:#ffffff; margin-top:0.15rem;">${ticket.attendeeName}</p>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <span class="telemetry-label" style="margin:0;">DATE & TIME</span>
              <p style="font-size:0.85rem; font-weight:700; color:#cbd5e1; margin-top:0.15rem;">${ticket.eventDate} | ${ticket.eventTime}</p>
            </div>
            <div>
              <span class="telemetry-label" style="margin:0;">ADMISSION STATUS</span>
              <p style="font-size:0.85rem; font-weight:800; margin-top:0.15rem; color:${ticket.status === 'Checked In' ? '#10b981' : '#38bdf8'};">
                ${ticket.status}
              </p>
            </div>
          </div>
          <div>
            <span class="telemetry-label" style="margin:0;">VENUE / ACCESS HALL</span>
            <p style="font-size:0.85rem; color:#94a3b8; margin-top:0.15rem;">${ticket.eventVenue}</p>
          </div>
        </div>

        <!-- Real QR Code rendering -->
        <div class="flex flex-col items-center justify-center">
          <div class="qr-scan-box">
            <div id="qrcodeBox" style="width:120px; height:120px; display:flex; align-items:center; justify-content:center;"></div>
          </div>
          <span class="font-mono" style="font-size:0.65rem; color:var(--text-dim); margin-top:0.5rem; text-align:center;">Scan at gate for instant admission</span>
        </div>
      </div>

      <div class="ticket-perforation"></div>

      <div class="flex items-center justify-between no-print" style="font-size:0.75rem; color:var(--text-dim);">
        <span>Cryptographically Signed • Tamper Resistant</span>
        <button onclick="window.print()" class="ef-btn ef-btn-primary ef-btn-sm">
          <i class="fas fa-print"></i> Print Ticket Pass
        </button>
      </div>
    </div>
  `;

  // Render QR Code
  setTimeout(() => {
    const qrBox = document.getElementById('qrcodeBox');
    if (qrBox && typeof QRCode !== 'undefined') {
      qrBox.innerHTML = '';
      new QRCode(qrBox, {
        text: ticket.qrData || ticket.ticketNumber,
        width: 120,
        height: 120,
        colorDark: "#090e1a",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
      });
    }
  }, 100);

  openModal('ticketModal');
}

// Load Attendee's Tickets
async function loadMyTickets() {
  const container = document.getElementById('myTicketsList');
  if (!currentUser) {
    container.innerHTML = `
      <div class="glass-card" style="padding:3.5rem 1.5rem; text-align:center;">
        <i class="fas fa-lock" style="font-size:2.5rem; color:#64748b; margin-bottom:1rem;"></i>
        <h3 style="font-size:1.25rem; font-weight:800; color:#ffffff;">Sign In to View Passes</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0.35rem 0 1.5rem;">Please log in or switch to the Attendee interactive persona.</p>
        <button onclick="quickSwitchDemo('attendee')" class="ef-btn ef-btn-primary">
          Switch to Attendee Demo
        </button>
      </div>
    `;
    return;
  }

  try {
    const res = await api.getMyTickets();
    const tickets = res.tickets || [];

    if (tickets.length === 0) {
      container.innerHTML = `
        <div class="glass-card" style="padding:3.5rem 1.5rem; text-align:center;">
          <i class="fas fa-ticket-alt" style="font-size:2.5rem; color:#64748b; margin-bottom:1rem;"></i>
          <h3 style="font-size:1.25rem; font-weight:800; color:#ffffff;">No Passes Found</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin:0.35rem 0 1.5rem;">You haven't reserved passes for any summits yet.</p>
          <button onclick="switchTab('events')" class="ef-btn ef-btn-primary">
            Explore Summits
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = tickets.map(ticket => `
      <div class="glass-card flex flex-col md:flex-row justify-between items-start md:items-center gap-4" style="padding:1.5rem;">
        <div>
          <div class="flex items-center gap-2" style="margin-bottom:0.35rem;">
            <span class="font-mono badge-tag" style="background:rgba(255,255,255,0.06); color:#cbd5e1; border:1px solid rgba(255,255,255,0.1);">
              ${ticket.ticketNumber}
            </span>
            <span class="badge-tag" style="background:${ticket.status === 'Checked In' ? 'rgba(16,185,129,0.2)' : ticket.status === 'Cancelled' ? 'rgba(244,63,94,0.2)' : 'rgba(56,189,248,0.2)'}; color:${ticket.status === 'Checked In' ? '#6ee7b7' : ticket.status === 'Cancelled' ? '#fca5a5' : '#7dd3fc'};">
              ${ticket.status}
            </span>
          </div>
          <h4 style="font-size:1.2rem; font-weight:800; color:#ffffff;">${ticket.eventTitle}</h4>
          <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.35rem; display:flex; align-items:center; gap:0.6rem;">
            <span><i class="far fa-calendar-alt" style="color:#818cf8; margin-right:0.25rem;"></i> ${ticket.eventDate} (${ticket.eventTime})</span>
            <span>•</span>
            <span><i class="fas fa-map-marker-alt" style="color:#818cf8; margin-right:0.25rem;"></i> ${ticket.eventVenue}</span>
          </p>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto">
          <button onclick='showTicketPass(${JSON.stringify(ticket)})' class="ef-btn ef-btn-secondary ef-btn-sm" style="flex:1;">
            <i class="fas fa-qrcode"></i> View Hologram Pass
          </button>
          ${ticket.status !== 'Cancelled' ? `
            <button onclick="handleCancelTicket('${ticket.id}')" class="ef-btn ef-btn-danger ef-btn-sm">
              Cancel
            </button>
          ` : ''}
        </div>
      </div>
    `).join('');
  } catch (err) {
    showToast('Failed to load passes: ' + err.message, 'error');
  }
}

async function handleCancelTicket(ticketId) {
  if (!confirm('Are you sure you want to cancel this event ticket?')) return;
  try {
    await api.cancelTicket(ticketId);
    showToast('Pass cancelled', 'info');
    loadMyTickets();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Workforce Crew Portal
async function loadWorkforcePortal() {
  const container = document.getElementById('workforceTasksList');
  const rosterContainer = document.getElementById('crewDirectoryList');

  try {
    const tasksRes = await api.getWorkforceTasks();
    const tasks = tasksRes.tasks || [];
    const myTasks = currentUser ? tasks.filter(t => t.assignedToUserId === currentUser.id) : tasks;

    // Render Stats
    document.getElementById('wfTotalTasks').innerText = tasks.length;
    document.getElementById('wfActiveTasks').innerText = tasks.filter(t => t.status === 'In Progress').length;
    document.getElementById('wfCompletedTasks').innerText = tasks.filter(t => t.status === 'Completed').length;

    // Render My Assigned Shifts
    if (myTasks.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1.5rem; text-align: center;" class="glass-card">
          <div style="width: 3.5rem; height: 3.5rem; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem; font-size: 1.35rem; color: #64748b;">
            <i class="fas fa-clipboard-check"></i>
          </div>
          <p style="font-size: 0.95rem; font-weight: 800; color: #ffffff;">No shifts assigned to your profile currently.</p>
          <p style="font-size: 0.78rem; color: var(--text-dim); margin-top: 0.25rem;">Switch to Event Director persona to assign shifts or view all shifts.</p>
        </div>
      `;
    } else {
      const priorityStyles = {
        'High': { bg: 'rgba(244,63,94,0.15)', color: '#fca5a5', border: 'rgba(244,63,94,0.35)' },
        'Medium': { bg: 'rgba(245,158,11,0.15)', color: '#fde68a', border: 'rgba(245,158,11,0.35)' },
        'Low': { bg: 'rgba(255,255,255,0.06)', color: '#cbd5e1', border: 'rgba(255,255,255,0.12)' }
      };

      container.innerHTML = myTasks.map(t => {
        const pStyle = priorityStyles[t.priority] || priorityStyles.Medium;
        return `
          <div class="task-item-card">
            <div>
              <div class="flex items-center justify-between gap-2" style="margin-bottom:0.75rem;">
                <span class="badge-tag" style="background:${pStyle.bg}; color:${pStyle.color}; border:1px solid ${pStyle.border};">
                  ${t.priority} Priority
                </span>
                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:600; display:flex; align-items:center; gap:0.35rem;">
                  <i class="far fa-clock" style="color:#818cf8;"></i> ${t.shiftStart} - ${t.shiftEnd}
                </span>
              </div>

              <h4 style="font-size:1.05rem; font-weight:800; color:#ffffff; line-height:1.3;">${t.title}</h4>
              <p style="font-size:0.8rem; font-weight:700; color:#818cf8; margin-top:0.25rem;" class="truncate">${t.eventTitle}</p>
              <p style="font-size:0.8rem; color:var(--text-muted); margin-top:0.5rem; line-height:1.5;">${t.description}</p>

              <div class="grid grid-cols-2 gap-2" style="margin-top:1rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.06); font-size:0.72rem;">
                <div class="truncate">
                  <span class="telemetry-label" style="margin:0;">LOCATION</span>
                  <span style="font-weight:700; color:#ffffff;" class="truncate block">📍 ${t.location || 'Main Venue'}</span>
                </div>
                <div class="truncate">
                  <span class="telemetry-label" style="margin:0;">ASSIGNED CREW</span>
                  <span style="font-weight:700; color:#38bdf8;" class="truncate block">👤 ${t.assignedToName}</span>
                </div>
              </div>
            </div>

            <div class="flex items-center justify-between" style="margin-top:1rem; padding-top:0.85rem; border-top:1px solid rgba(255,255,255,0.06);">
              <span class="telemetry-label" style="margin:0;">Shift Progress:</span>
              <select onchange="updateShiftStatus('${t.id}', this.value)" 
                      class="form-control" style="width:auto; padding:0.35rem 0.65rem; font-size:0.78rem; font-weight:700;">
                <option value="Assigned" ${t.status === 'Assigned' ? 'selected' : ''}>Assigned</option>
                <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
                <option value="Completed" ${t.status === 'Completed' ? 'selected' : ''}>Completed</option>
              </select>
            </div>
          </div>
        `;
      }).join('');
    }

    // Load Crew Directory
    const dirRes = await api.getCrewDirectory();
    const crew = dirRes.crew || [];
    if (rosterContainer) {
      rosterContainer.innerHTML = crew.map(c => `
        <div style="padding:0.75rem 1rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.07); border-radius:0.85rem; display:flex; align-items:center; justify-content:space-between;">
          <div class="flex items-center gap-3">
            <img src="${c.avatar}" style="width:2.25rem; height:2.25rem; border-radius:50%; object-fit:cover; border:1px solid rgba(255,255,255,0.15);" alt="${c.name}" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80';">
            <div>
              <p style="font-size:0.85rem; font-weight:800; color:#ffffff; line-height:1.2;">${c.name}</p>
              <p style="font-size:0.72rem; color:var(--text-dim);">${c.department} • <span style="color:#818cf8; font-weight:600;">${c.specialization}</span></p>
              <p style="font-size:0.68rem; color:#64748b; margin-top:1px;">${c.phone}</p>
            </div>
          </div>
          <div class="text-right">
            <span class="badge-tag" style="background:${c.activeTasks > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(16,185,129,0.15)'}; color:${c.activeTasks > 0 ? '#fde68a' : '#6ee7b7'};">
              ${c.activeTasks} Shifts
            </span>
          </div>
        </div>
      `).join('');
    }

  } catch (err) {
    showToast('Workforce load error: ' + err.message, 'error');
  }
}

async function updateShiftStatus(taskId, status) {
  try {
    await api.updateTaskStatus(taskId, status);
    showToast(`Task status updated to ${status}`, 'success');
    loadWorkforcePortal();
  } catch (err) {
    showToast(err.message, 'error');
    loadWorkforcePortal();
  }
}

// Crew Real-Time Entry Check-In Desk Tool
async function handleCheckInSubmit(e) {
  e.preventDefault();
  const input = document.getElementById('checkInTicketInput');
  const resultBox = document.getElementById('checkInResultBox');
  const code = input.value.trim();

  if (!code) {
    showToast('Please enter a ticket number or scan code', 'warning');
    return;
  }

  try {
    const res = await api.checkInTicket(code);
    resultBox.className = 'block';
    resultBox.innerHTML = `
      <div style="padding:1rem; border-radius:0.85rem; background:rgba(16,185,129,0.15); border:1px solid rgba(16,185,129,0.4); display:flex; align-items:flex-start; gap:0.85rem;">
        <div style="width:2rem; height:2rem; border-radius:50%; background:#10b981; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <i class="fas fa-check"></i>
        </div>
        <div>
          <h5 style="font-size:0.95rem; font-weight:800; color:#ffffff;">${res.message}</h5>
          <p style="font-size:0.8rem; color:#cbd5e1; margin-top:0.2rem;">Attendee: <strong style="color:#ffffff;">${res.ticket.attendeeName}</strong> (${res.ticket.college || 'Participant'})</p>
          <p style="font-size:0.75rem; color:#6ee7b7; margin-top:0.25rem;">Pass: ${res.ticket.ticketNumber} • Summit: ${res.ticket.eventTitle}</p>
        </div>
      </div>
    `;
    input.value = '';
    showToast('Check-in confirmed!', 'success');
  } catch (err) {
    resultBox.className = 'block';
    resultBox.innerHTML = `
      <div style="padding:1rem; border-radius:0.85rem; background:rgba(244,63,94,0.15); border:1px solid rgba(244,63,94,0.4); display:flex; align-items:flex-start; gap:0.85rem;">
        <div style="width:2rem; height:2rem; border-radius:50%; background:#f43f5e; color:#ffffff; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          <i class="fas fa-exclamation-triangle"></i>
        </div>
        <div>
          <h5 style="font-size:0.95rem; font-weight:800; color:#ffffff;">Verification Failed</h5>
          <p style="font-size:0.8rem; color:#fca5a5; margin-top:0.2rem;">${err.message}</p>
        </div>
      </div>
    `;
    showToast(err.message, 'error');
  }
}

// Admin Dashboard
async function loadAdminDashboard() {
  try {
    const res = await api.getDashboardAnalytics();
    const stats = res.stats;

    // Stat counters
    document.getElementById('admTotalEvents').innerText = stats.totalEvents;
    document.getElementById('admTotalRegs').innerText = stats.totalRegistrations;
    document.getElementById('admCheckedIn').innerText = `${stats.checkedInAttendees} (${stats.checkInRate}%)`;
    document.getElementById('admTotalStaff').innerText = stats.totalStaff;

    // Render Charts
    renderAnalyticsCharts(stats);

    // Render Event Management Table
    renderAdminEventsTable();

    // Populate dropdowns for shift assignment modal
    populateStaffAndEventDropdowns();

    // Render Attendee Verification Table
    renderAdminAttendeesTable();
  } catch (err) {
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

function renderAnalyticsCharts(stats) {
  // 1. Categories chart
  const catCanvas = document.getElementById('chartCategories');
  if (catCanvas && typeof Chart !== 'undefined') {
    const ctx = catCanvas.getContext('2d');
    if (categoryChartInstance) categoryChartInstance.destroy();

    const labels = Object.keys(stats.categoryCounts);
    const data = Object.values(stats.categoryCounts);

    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: ['#6366f1', '#06b6d4', '#ec4899', '#10b981', '#f59e0b'],
          borderColor: '#0b101d',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { 
            position: 'bottom', 
            labels: { 
              boxWidth: 12, 
              color: '#cbd5e1',
              font: { size: 11, family: "'Plus Jakarta Sans', sans-serif" } 
            } 
          }
        }
      }
    });
  }

  // 2. Workforce Tasks chart
  const wfCanvas = document.getElementById('chartWorkforce');
  if (wfCanvas && typeof Chart !== 'undefined') {
    const ctx = wfCanvas.getContext('2d');
    if (workforceChartInstance) workforceChartInstance.destroy();

    workforceChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Assigned', 'In Progress', 'Completed'],
        datasets: [{
          label: 'Shifts & Tasks',
          data: [
            stats.taskStatusCounts['Assigned'] || 0,
            stats.taskStatusCounts['In Progress'] || 0,
            stats.taskStatusCounts['Completed'] || 0
          ],
          backgroundColor: ['#64748b', '#f59e0b', '#10b981'],
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { 
            beginAtZero: true, 
            ticks: { stepSize: 1, color: '#94a3b8' },
            grid: { color: 'rgba(255,255,255,0.06)' }
          },
          x: {
            ticks: { color: '#94a3b8' },
            grid: { display: false }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }
}

async function renderAdminEventsTable() {
  const tableBody = document.getElementById('adminEventsTableBody');
  const res = await api.getEvents();
  const events = res.events || [];

  tableBody.innerHTML = events.map(e => `
    <tr>
      <td>
        <div class="flex items-center gap-3">
          <img src="${e.bannerUrl}" style="width:2.5rem; height:2.5rem; border-radius:0.5rem; object-fit:cover;" alt="" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1540575467063-178a50c2df87?auto=format&fit=crop&w=300&q=80';">
          <div>
            <p style="font-size:0.88rem; font-weight:800; color:#ffffff;">${e.title}</p>
            <p style="font-size:0.75rem; color:var(--text-dim);">${e.venue}</p>
          </div>
        </div>
      </td>
      <td>
        <span class="badge-tag" style="background:rgba(255,255,255,0.06); color:#cbd5e1;">
          ${e.category}
        </span>
      </td>
      <td style="color:#cbd5e1;">
        ${new Date(e.date).toLocaleDateString()}
      </td>
      <td style="font-weight:700; color:#ffffff;">
        ${e.registeredCount} / ${e.capacity}
      </td>
      <td style="font-weight:800; color:${e.ticketPrice === 0 ? '#10b981' : '#ffffff'};">
        ${e.ticketPrice === 0 ? 'Free' : `$${e.ticketPrice}`}
      </td>
      <td style="text-align:right;">
        <button onclick="handleDeleteEvent('${e.id}')" style="background:transparent; border:none; color:var(--text-dim); cursor:pointer; padding:0.4rem; transition:color 0.2s;" onmouseover="this.style.color='#f43f5e'" onmouseout="this.style.color='var(--text-dim)'" title="Delete Summit">
          <i class="fas fa-trash-alt"></i>
        </button>
      </td>
    </tr>
  `).join('');
}

async function handleDeleteEvent(eventId) {
  if (!confirm('Are you sure you want to delete this event and its crew assignments?')) return;
  try {
    await api.deleteEvent(eventId);
    showToast('Event deleted successfully', 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function populateStaffAndEventDropdowns() {
  try {
    const eventsRes = await api.getEvents();
    const staffRes = await api.getUsers('staff');

    const eventSelect = document.getElementById('assignEventSelect');
    const staffSelect = document.getElementById('assignStaffSelect');

    if (eventSelect) {
      eventSelect.innerHTML = (eventsRes.events || []).map(e => `
        <option value="${e.id}">${e.title}</option>
      `).join('');
    }

    if (staffSelect) {
      staffSelect.innerHTML = (staffRes.users || []).map(s => `
        <option value="${s.id}">${s.name} (${s.department || 'Staff'})</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error populating dropdowns:', err);
  }
}

async function renderAdminAttendeesTable() {
  const container = document.getElementById('adminAttendeesTableBody');
  try {
    const events = (await api.getEvents()).events || [];
    let allRegistrations = [];

    for (const evt of events) {
      const regRes = await api.getEventAttendees(evt.id);
      if (regRes.registrations) {
        allRegistrations.push(...regRes.registrations);
      }
    }

    if (allRegistrations.length === 0) {
      container.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-dim);">No attendee registrations recorded yet.</td></tr>`;
      return;
    }

    container.innerHTML = allRegistrations.map(r => `
      <tr>
        <td class="font-mono" style="font-weight:700; color:#38bdf8;">${r.ticketNumber}</td>
        <td>
          <p style="font-weight:800; color:#ffffff;">${r.attendeeName}</p>
          <p style="font-size:0.72rem; color:var(--text-dim);">${r.attendeeEmail} • ${r.attendeePhone || 'N/A'}</p>
        </td>
        <td class="truncate" style="max-width:200px; color:#cbd5e1;">${r.eventTitle}</td>
        <td>
          <span class="badge-tag" style="background:${r.status === 'Checked In' ? 'rgba(16,185,129,0.2)' : 'rgba(56,189,248,0.2)'}; color:${r.status === 'Checked In' ? '#6ee7b7' : '#7dd3fc'};">
            ${r.status}
          </span>
        </td>
        <td style="color:var(--text-dim);">${new Date(r.registeredAt).toLocaleDateString()}</td>
        <td style="text-align:right;">
          ${r.status !== 'Checked In' ? `
            <button onclick="quickAdminCheckIn('${r.ticketNumber}')" class="ef-btn ef-btn-primary ef-btn-sm">
              Verify Check-In
            </button>
          ` : `
            <span style="font-size:0.75rem; color:#10b981; font-weight:800;"><i class="fas fa-check-circle mr-1"></i>Verified</span>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error rendering attendees:', err);
  }
}

async function quickAdminCheckIn(ticketNum) {
  try {
    await api.checkInTicket(ticketNum);
    showToast(`Checked in ticket ${ticketNum}`, 'success');
    renderAdminAttendeesTable();
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Assign Crew Task Form
async function handleAssignTaskSubmit(e) {
  e.preventDefault();
  const eventId = document.getElementById('assignEventSelect').value;
  const staffId = document.getElementById('assignStaffSelect').value;
  const title = document.getElementById('assignTaskTitle').value.trim();
  const role = document.getElementById('assignTaskRole').value.trim();
  const start = document.getElementById('assignShiftStart').value.trim();
  const end = document.getElementById('assignShiftEnd').value.trim();
  const priority = document.getElementById('assignPriority').value;
  const description = document.getElementById('assignDescription').value.trim();

  try {
    await api.createWorkforceTask({
      eventId,
      assignedToUserId: staffId,
      title,
      roleRequired: role,
      shiftStart: start,
      shiftEnd: end,
      priority,
      description
    });

    closeModal('assignTaskModal');
    showToast('Crew shift assigned successfully!', 'success');
    loadAdminDashboard();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Create Event Form
async function handleCreateEventSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('createEventTitle').value.trim();
  const category = document.getElementById('createEventCategory').value;
  const date = document.getElementById('createEventDate').value;
  const time = document.getElementById('createEventTime').value.trim();
  const venue = document.getElementById('createEventVenue').value.trim();
  const capacity = document.getElementById('createEventCapacity').value;
  const ticketPrice = document.getElementById('createEventPrice').value;
  const bannerUrl = document.getElementById('createEventBanner').value.trim();
  const description = document.getElementById('createEventDescription').value.trim();

  try {
    await api.createEvent({
      title,
      category,
      date,
      time,
      venue,
      capacity,
      ticketPrice,
      bannerUrl,
      description
    });

    closeModal('createEventModal');
    showToast('New summit created and published!', 'success');
    loadAdminDashboard();
    loadEvents();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Setup Event Listeners
function setupEventListeners() {
  const searchInput = document.getElementById('eventSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(window.searchTimer);
      window.searchTimer = setTimeout(loadEvents, 300);
    });
  }

  // Modals & Forms
  const bookingForm = document.getElementById('bookingForm');
  if (bookingForm) bookingForm.addEventListener('submit', handleBookingSubmit);

  const checkInForm = document.getElementById('checkInForm');
  if (checkInForm) checkInForm.addEventListener('submit', handleCheckInSubmit);

  const assignTaskForm = document.getElementById('assignTaskForm');
  if (assignTaskForm) assignTaskForm.addEventListener('submit', handleAssignTaskSubmit);

  const createEventForm = document.getElementById('createEventForm');
  if (createEventForm) createEventForm.addEventListener('submit', handleCreateEventSubmit);

  const loginForm = document.getElementById('loginForm');
  if (loginForm) loginForm.addEventListener('submit', handleLoginSubmit);

  const registerForm = document.getElementById('registerForm');
  if (registerForm) registerForm.addEventListener('submit', handleRegisterSubmit);
}

// Auth Form Handlers
async function handleLoginSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  try {
    const res = await api.login(email, password);
    currentUser = res.user;
    updateAuthUI();
    closeModal('loginModal');
    showToast(res.message, 'success');
    if (currentTab === 'my-tickets') loadMyTickets();
    if (currentTab === 'workforce') loadWorkforcePortal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const role = document.getElementById('regRole').value;
  const phone = document.getElementById('regPhone').value.trim();
  const department = document.getElementById('regDept').value.trim();

  try {
    const res = await api.register({
      name,
      email,
      password,
      role,
      phone,
      department
    });
    currentUser = res.user;
    updateAuthUI();
    closeModal('registerModal');
    showToast(res.message, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Modal Helpers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add('hidden');
    document.body.style.overflow = '';
  }
}

function openLoginModal() {
  openModal('loginModal');
}

function openRegisterModal() {
  openModal('registerModal');
}

// Toast System
function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  const typeConfig = {
    success: { bg: 'linear-gradient(135deg, #059669 0%, #10b981 100%)', icon: 'fa-check-circle', border: 'rgba(16,185,129,0.4)' },
    error: { bg: 'linear-gradient(135deg, #e11d48 0%, #f43f5e 100%)', icon: 'fa-times-circle', border: 'rgba(244,63,94,0.4)' },
    warning: { bg: 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)', icon: 'fa-exclamation-triangle', border: 'rgba(245,158,11,0.4)' },
    info: { bg: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)', icon: 'fa-info-circle', border: 'rgba(99,102,241,0.4)' }
  };

  const cfg = typeConfig[type] || typeConfig.info;

  toast.style.cssText = `
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 0.85rem 1.25rem;
    border-radius: 0.85rem;
    background: ${cfg.bg};
    border: 1px solid ${cfg.border};
    color: #ffffff;
    font-size: 0.85rem;
    font-weight: 700;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    transform: translateY(10px);
    opacity: 0;
    transition: all 0.25s var(--ease-smooth);
    pointer-events: auto;
  `;

  toast.innerHTML = `
    <i class="fas ${cfg.icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transform = 'translateY(0)';
    toast.style.opacity = '1';
  }, 10);

  setTimeout(() => {
    toast.style.transform = 'translateY(10px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 260);
  }, 3800);
}

// Confetti Celebration Helper
function triggerConfetti() {
  if (typeof confetti === 'function') {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
  }
}
