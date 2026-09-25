# Meadow Lane Realty & Development CRM: Technical Specification

## Detailed Module Specifications

### Module 1: Executive Dashboard (Landing View)

- **High-Level Metrics Widgets:**
    - Total Active Clients (dynamic count badge)
    - Under Contract Count
    - Monthly Revenue / Gross Commission Income (GCI)
    - Lead Conversion Rate (%)
- **Data Visualizations (Chart.js):**
    - Monthly Lead Acquisition & Conversion Trends (Bar/Line Chart)
    - Revenue by Pipeline Source / Category (Pie/Doughnut Chart)
- **Operational Feed:**
    - Upcoming Broker Events & Deadlines
    - Live Activity Stream (Recent incoming Zillow leads, review replies, and message logs).

### Module 2: Pipeline Kanban Board

- **Layout Structure:** Fixed-width columns (`w-80 flex-shrink-0`) inside a smooth horizontal scrolling container to prevent text squishing and overlapping.
- **Stages:** _New Lead_ -> _Contacted_ -> _Consultation_ -> _Active Search/Listing_ -> _Under Contract_ -> _Closed_.
- **Card Metadata:** Client Name, Category Tag (Buyer, Seller, Estate Sale, Construction, Under Contract), Property Address, Last Contact Timestamp, and Assigned Agent.
- **Interactions:** Drag-and-drop state transition updates, quick-action buttons for SMS/Email, and manual Zillow lead ingestion simulation button.

### Module 3: Active Clients Dashboard

- **Dynamic Header Badge:** Real-time count of currently active clients.
- **Categorization & Filtering:** Filterable by categories: _Buyer_, _Seller_, _Estate Sale_, _Construction_, and _Under Contract_.
- **Timeline Categories:** Organized into A/B/C timeline urgency categories with visual status badges, client physical addresses, and quick-launcher action icons for communication.

### Module 4: Client Registry

- **Data Grid View:** Comprehensive, searchable database displaying Name, Phone, Email, Physical Address, Category Tags, and Lifecycle Stage.
- **Search & Filter Bar:** Instant keyword search across all fields and multi-tag filtering.
- **Modal Form:** "Add New Client" entry modal supporting validation for required contact info, property address inputs, and initial tag assignments.

### Module 5: Interactive Calendar

- **View Modes:** Month Grid, Hourly Week View (8:00 AM - 6:00 PM time grid), and Agenda List View.
- **Search & Filtering:** Search bar to filter events by client name or property address; color-coded event categories (Closing, Inspection, Open House, Client Meeting).
- **Event Management:** "+ Add Event" modal supporting title, date/time pickers, location/address field, attendee tagging, and recurrence rules (Daily, Weekly, Monthly).

## MVP scope

The MVP includes Modules 1–5 only: Executive Dashboard, Pipeline Kanban Board, Active Clients Dashboard, Client Registry, and Interactive Calendar. Modules after the calendar are deferred and are not included in the MVP.
