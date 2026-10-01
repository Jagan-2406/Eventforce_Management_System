# EventForce Management System

**Naan Mudhalvan Project — Event Planner Solutions CRM Implementation**

---

## 1. Project Overview
The **EventForce Management System** is a streamlined Customer Relationship Management (CRM) platform engineered to digitize and automate end-to-end event planning operations. It manages client onboarding, venue reservations, vendor coordination, feedback collection, automated approval workflows, and business analytics.

Based on the **Naan Mudhalvan EventForce Salesforce Specification**, this implementation maps enterprise CRM architectures into an accessible, robust, and easy-to-demonstrate full-stack web application.

---

## 2. Objectives & Business Value
- **Centralize Operations:** Replaces fragmented spreadsheets with a structured, relational database.
- **Prevent Double-Booking:** Automates venue scheduling rules to prevent multi-event collisions on identical dates.
- **Workflow Automation:** Implements multi-tier approval processes for event cancellations, with automated notifications.
- **Client Engagement:** Enforces feedback collection with relational lookup filters and automated 3-day reminder triggers.
- **Operational Insights:** Provides real-time dashboards and reports (e.g., *Upcoming Events by Month Report* with budget summation).
- **Target Efficiency:** Achieves a 60% reduction in manual processes and a 40% enhancement in booking turnaround.

---

## 3. Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (ES6+), Chart.js
- **Backend:** Node.js, Express.js
- **Database:** Local JSON File Persistence (`data/eventforce.json`)
- **Architecture:** Client-Server RESTful Architecture with Role-Based Access Control (RBAC)

---

## 4. System Modules & Data Architecture

### Core Objects / Collections
1. **Event (`Event__c`)**:
   - Fields: `id`, `name`, `date`, `type`, `status`, `budget`, `clientId`, `venueId`, `description`, `owner`
   - Types: *Wedding, Corporate, Birthday, Anniversary, Festival, Concert, Other*
   - Statuses: *Planned, Confirmed, Completed, Pending Cancellation, Canceled, Rejected*
   - Budget Formula: Automatically defaults to type values (*Wedding: 50,000 | Corporate: 30,000 | Birthday: 10,000 | Anniversary: 20,000 | Festival: 60,000 | Concert: 40,000 | Other: 15,000*).

2. **Client (`Client__c`)**:
   - Fields: `id`, `name`, `email`, `phone`, `address`, `country`, `city`
   - Validation: Strict Regex email validation matching Salesforce rules.

3. **Vendor (`Vendor__c`)**:
   - Fields: `id`, `name`, `email`, `phone`, `serviceType`, `status`, `rating`
   - Services: *Catering, Decor, Photography, Videography, Lighting, Stage Setup, Makeup Artist, DJ/Music, Transportation, Hosting/Anchor*

4. **Venue (`Venue__c`)**:
   - Fields: `id`, `name`, `address`, `location` (URL/Map), `capacity`, `availabilityStatus` (*Available, Reserved, Not Available*)

5. **Feedback (`Feedback__c`)**:
   - Fields: `id` (Auto Number `F-{0000}`), `clientId`, `eventId`, `rating` (1–5), `comments`, `date`
   - Lookup Filter: Only events belonging to the selected client can be reviewed.

6. **EventVendor Junction Object (`EventVendor__c`)**:
   - Fields: `id`, `eventId`, `vendorId`, `serviceType`, `notes`
   - Facilitates Many-to-Many relationships between Events and multiple specialized Vendors.

---

## 5. Relationships & ER Diagram

```
       [ Client ] 1 ───────< N [ Event ] >─────── 1 [ Venue ]
           │                       │
           │                       │ 1
           │ 1                     │
           │                       V N
           │               [ EventVendor ] (Junction)
           │                       │
           │                       │ N
           │                       V 1
           │                  [ Vendor ]
           │
           V 1
     [ Feedback ] >─────────────── N [ Event ]
     (with Client Lookup Filter)
```

---

## 6. Salesforce to Web Application Mapping

| Salesforce Architecture Component | Equivalent Web Application Implementation |
| :--- | :--- |
| **Custom Object** (`Event__c`, `Client__c`, etc.) | JSON Data Collections & Express REST Endpoints |
| **Junction Object** (`EventVendor__c`) | `eventVendors` collection linking `eventId` & `vendorId` |
| **Lookup Filter** (`Feedback.Event__c` = `Feedback.Client__c`) | Dynamic filtered dropdown and backend relationship verification |
| **Validation Rules** (Email format regex) | `NOT(REGEX(Email__c, "^[a-zA-Z0-9._]+@[a-zA-Z0-9.]+\.[a-zA-Z]{2,}$"))` |
| **Formula Fields** (`Event_Budget__c`) | Automatic budget assignment based on Event Type lookup map |
| **Apex Trigger** (`PreventDoubleBooking`) | Pre-save validation preventing overlapping venue dates |
| **Apex Class & Trigger** (`VenueStatusHelper`) | Automatic status toggle (`Confirmed` → `Reserved`, `Canceled` → `Available`) |
| **Approval Process** (`Event_Cancellation_Process`) | Approval Queue (`Pending Cancellation` → Admin Approve/Reject) |
| **Record-Triggered Flow** (`Client Reminder 3 Days Before`) | Date-delta scanner sending simulated automated email notifications |
| **Batchable & Schedulable Apex** (`BatchCompleteEvents`) | Schedulable night runner marking past events as `Completed` |
| **Profiles & Roles** (Admin, Coordinator, Vendor Mgr, Client) | Live Role Switcher with granular UI and action guards |
| **Lightning Reports & Dashboards** | KPI summary cards, Chart.js Donut/Bar visualizations, and CSV exports |

---

## 7. Business Rules & Automations

### A. Prevent Double-Booking (Apex Trigger equivalent)
When creating or editing an event, the system checks whether the selected venue is already booked for another non-canceled event on that exact date. If a conflict is found, the system rejects the operation with:
> *"Validation Error: This Venue is already booked on this date."*

### B. Venue Availability Automation (VenueStatusHelper equivalent)
- When an event status is set to `Confirmed`, its venue availability status is automatically updated to `Reserved`.
- When an event is `Canceled`, the venue is automatically freed and marked `Available` (provided no other active event is scheduled).

### C. Event Cancellation Approval Process (Milestone 6)
1. **Submit Request:** Event owner or coordinator submits cancellation request.
2. **Pending State:** Event status transitions to `Pending Cancellation`.
3. **Alert Dispatched:** Email alert is sent to Event Coordinator & Manager.
4. **Admin Review:** Event Admin evaluates the request:
   - **Approve:** Event status becomes `Canceled`. Venue status returns to `Available`. Client and Owner receive confirmation emails.
   - **Reject:** Event status reverts to `Confirmed`. Rejection notice is logged.

### D. 3-Day Client Reminder Flow (Milestone 7)
Checks all `Confirmed` events. If the event date is 3 days or fewer away, it dispatches an automated reminder notice to the client with date, venue, and event type.

### E. Nightly Batch Event Completion (Milestone 10)
Scans for events where `date < today` and status is not `Completed` or `Canceled`, automatically updating their status to `Completed`.

---

## 8. Installation & Running Locally

### Prerequisites
- Node.js (v18.0 or higher)
- npm (Node Package Manager)

### Quick Start
```bash
# 1. Unzip the project folder
unzip EventForce.zip
cd EventForce

# 2. Install dependencies (express)
npm install

# 3. Start the application
npm start
```
The server will start on port 3000:
Open your browser to: **`http://localhost:3000`**

---

## 9. Demonstration Workflow for Evaluators & Viva

1. **Open Dashboard:** Observe KPI cards (Total Events, Clients, Vendors, Venues, Avg Rating) and the *Upcoming Events by Month* Chart.js donut chart.
2. **Role Switching:** In the top bar, switch between **Event Admin**, **Event Coordinator**, **Vendor Manager**, and **Client** to showcase role-based visibility.
3. **Double-Booking Prevention Test:**
   - Go to **Events** → click **+ New Event**.
   - Select **ITC Grand Chola** on date **2026-10-15** (which is already booked for Arun & Meera Grand Wedding).
   - Try to save → Observe the system preventing double-booking with an instant validation error.
4. **Create a Client & Event:**
   - Add a new client with email validation test (invalid email triggers error).
   - Create a valid event. Notice how the budget automatically populates based on the Event Type formula.
5. **Junction Object Demonstration:**
   - Go to **Event Vendors** → Assign a caterer or decorator to the newly created event.
6. **Lookup Filter Demonstration:**
   - Go to **Feedback** → click **+ Submit Feedback**.
   - Change the Client dropdown → Notice the Event dropdown dynamically filters to only show events that belong to that selected client.
7. **Cancellation Workflow:**
   - On an active event, click **Cancel** / **Request Cancel**. Enter a reason.
   - Event status changes to `Pending Cancellation`.
   - Go to **Approvals & Flows** tab. Under Approval Queue, click **Approve Cancellation**.
   - Verify the event is now `Canceled`, the venue is released back to `Available`, and check the **Automated Email Dispatch Log** on the right!
8. **Automation Triggers:**
   - Click **Trigger 3-Day Reminders** to see automated reminders dispatched for upcoming events.
   - Click **Run Nightly Batch** to see past events automatically marked as `Completed`.
9. **Reports & Analytics:**
   - Open the **Reports** tab to inspect all 7 standardized reports and export to CSV.

---

## 10. Top Viva Questions & Answers

**Q1: Why is a junction object needed between Event and Vendor?**  
*A:* A single event requires multiple vendors (catering, photography, music, lighting), and a vendor participates in many events over time. Since relational databases cannot store arrays in a normalized form, the `EventVendor` junction object resolves this many-to-many relationship into two one-to-many relationships.

**Q2: How does the web implementation replicate Salesforce Validation Rules?**  
*A:* Both client-side JavaScript form listeners and Express server route validators enforce field presence, regex matching on email formats, and non-negative constraints on budget before persisting to the database.

**Q3: How is the Salesforce Approval Process modeled in this application?**  
*A:* Through status state-transitions (`Confirmed` → `Pending Cancellation` → `Canceled` / `Confirmed`) managed via dedicated API review endpoints, accompanied by event-driven notification logs replicating Salesforce Classic Email Alerts.

**Q4: What is Organization-Wide Default (OWD) and how is it simulated?**  
*A:* In Salesforce, OWD sets default baseline record access (e.g., Private). In our application, when switching to the Client role, the system restricts the view to only records belonging to that specific client (`clientId === 'CLI-1001'`), ensuring private data isolation.

---

## 11. Conclusion
The **EventForce Management System** fulfills all architectural requirements established in the Naan Mudhalvan curriculum. By translating complex enterprise Salesforce abstractions into a clean, lightweight Node.js/Express web platform, it provides students with an intuitive, reliable project that is effortless to run, easy to demonstrate, and technically robust.
