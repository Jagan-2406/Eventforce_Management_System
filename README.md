# ⚡ EventForce Management System

> **Next-Generation Enterprise Event Operations & Live Workforce Management Platform**  
> Developed for Capstone & Enterprise Event Orchestration with Dynamic QR Admission Passes, Real-Time Shift Dispatch, and Salesforce Synchronization.

---

## 🌟 Key Features

### 1. 🎙️ Comprehensive Event Showcase & Catalog
- **Multi-Category Exploration**: Conferences, Technical Hackathons, Cultural Arts, Esports, and Tech Masterclasses.
- **Dynamic Search & Filtering**: Real-time keyword search across titles, descriptions, and venues with instant count telemetry.
- **Summit Detail Modal**: Deep dive into keynote speaker profiles, multi-track session agendas, sponsor showcases, and attendee reviews.
- **Live Occupancy Meters**: Visual seat capacity bars preventing overbooking.

### 2. 🎫 Admission Passes & Cryptographic QR Codes
- **Instant Booking Engine**: Seamless ticket booking for attendees.
- **Holographic Digital Passes**: Luxury VIP boarding pass interface featuring real-time generated cryptographic QR barcodes.
- **Print Pass Capability**: Clean, formatted print layout for on-ground physical lanyards.

### 3. 👷 Workforce Crew Operations Center
- **Shift & Duty Allocation**: Organize AV production, security checkpoints, VIP logistics, and catering.
- **Live Duty Progress**: On-the-fly status updates (`Assigned` ➔ `In Progress` ➔ `Completed`).
- **Real-Time Gate Scanner Terminal**: Validate admission ticket numbers with animated laser scan verification.
- **Active Crew Directory**: Real-time staff specialization roster and shift count.

### 4. 👑 Executive Director Console (Admin Analytics)
- **Real-Time Operational KPIs**: Total events, bookings, gate check-in conversion rate, and active crew specialists.
- **Interactive Visualizations (Chart.js)**:
  - Event Category Distribution (Doughnut Chart)
  - Workforce Shift Progression (Bar Chart)
- **Event Portfolio Directory**: Create, publish, and delete events.
- **Attendee Ticket Audit**: Inspect attendees and execute rapid check-in overrides.
- **CSV Data Export**: One-click download of all attendee records for spreadsheet auditing.

### 5. ☁️ Salesforce Enterprise Integration
- Native Apex controllers (`EventForceController.cls`) and triggers (`EventRegistrationTrigger.trigger`).
- Lightning Web Components (LWCs): `eventCatalog` and `gateCheckInScanner` for native Salesforce CRM operations.

---

## 🚀 Tech Stack

- **Backend**: Node.js, Express.js REST API
- **Frontend**: Vanilla JavaScript (ES6+), Vanilla CSS Custom Design System (Neo-Enterprise Glass Aesthetic)
- **Typography**: Google Fonts (*Outfit*, *Plus Jakarta Sans*, *JetBrains Mono*)
- **Libraries**: Chart.js, QRCode.js, Canvas-Confetti, FontAwesome 6
- **Database**: Persistent JSON Storage Engine with BCrypt password hashing & JWT security
- **CRM Sync**: Salesforce Apex & Lightning Web Components (LWC)

---

## 🛠️ Quick Start & Running Locally

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/Jagan-2406/Eventforce_Management_System.git

# Navigate into the project folder
cd Eventforce_Management_System

# Install dependencies (if not already installed)
npm install

# Start the server
npm start
```

Visit **[http://localhost:5000](http://localhost:5000)** in your browser.

---

## 🔑 Demo Login Credentials

You can use the one-click **Role Preview** buttons in the top announcement bar or log in manually:

| Role | Email | Password |
|---|---|---|
| **👑 Event Director / Admin** | `admin@eventforce.com` | `admin123` |
| **👷 Crew Staff** | `staff1@eventforce.com` | `staff123` |
| **🎓 Student Attendee** | `attendee@eventforce.com` | `user123` |

---

## 📂 Project Architecture

```
├── data/
│   └── eventforce.db.json        # Persistent local JSON database
├── public/
│   ├── css/
│   │   └── style.css             # Vanilla CSS Luxury Design System
│   ├── js/
│   │   ├── api.js                # Frontend API client service
│   │   └── app.js                # Core SPA controller & dynamic rendering
│   └── index.html                # Semantic HTML5 Application Shell
├── salesforce/
│   ├── classes/                  # Apex Controllers & Test suites
│   ├── lwc/                      # Lightning Web Components (Catalog, Scanner)
│   └── triggers/                 # Event Registration Apex Triggers
├── src/
│   ├── config/
│   │   └── db.js                 # Database engine & seed data loader
│   ├── middleware/
│   │   └── authMiddleware.js     # JWT verification & RBAC guard
│   └── routes/                   # Modular Express REST API routes
│       ├── analyticsRoutes.js
│       ├── authRoutes.js
│       ├── eventRoutes.js
│       ├── registrationRoutes.js
│       └── workforceRoutes.js
├── .gitignore
├── package.json
├── README.md
└── server.js                     # Express application entrypoint
```

---

## 📄 License
ISC License