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

### Module 6: Communications Hub

- **1-on-1 SMS & Gmail Simulator:**
    - Real-time client search input to locate specific threads.
    - Chronological chat history thread view with distinct visual bubbles, timestamps, and channel indicators (SMS vs. Gmail).
    - Direct input form to compose and dispatch new messages.
- **Bulk Email Marketing Campaign Manager:**
    - Campaign Creator: Define campaign title, target audience filter (e.g., all Past Clients, active Buyers), and dispatch schedule.
    - Performance Analytics: Track sent counts, open rates, click-through rates (CTR), and bounce logs.
    - Bulk dispatch testing simulator.

### Module 7: Social Media Hub

- **Connected Profiles Management:** Status toggles and follower count metrics for Facebook, Instagram, LinkedIn, and X/Twitter.
- **Multi-Platform Post Composer:** Select target channels, input caption text, attach media/listing URLs, and choose between immediate publish or scheduling.
- **Live Post Preview & Approval Workflow:**
    - **Preview Modal:** Renders an exact replica of how the post will look on live mobile/desktop feeds for the chosen network.
    - **Approval Queue:** Requires explicit broker sign-off ("Approve & Publish") before scheduled posts move to the live publishing queue.

### Module 8: Google Business Profile Integration

- **OAuth 2.0 Connection Panel:** Secure authorization flow to link the local Google Business account.
- **Reviews Hub:** Real-time stream of incoming Google reviews with star ratings and direct in-app reply capabilities.
- **Local Post Publisher:** Create and push "Just Listed / Just Sold" updates directly to Google Search & Maps.
- **Analytics Dashboard:** Track Search vs. Maps discovery metrics, phone call clicks, direction requests, and website link clicks.

### Module 9: Zillow Premier Agent Account Integration

- **Webhook & Lead Routing Configuration:** Settings to manage Zillow Connect webhook endpoints and configure instant "Speed-to-Lead" auto-responders (automated SMS/Email fired within 30 seconds of ingestion).
- **ROI & Ad Spend Tracker:** Input monthly Zillow ad spend to automatically calculate Cost Per Lead (CPL) and Return on Ad Spend (ROAS).
- **Listing Sync & Review Automation:** Monitor active syndicated listings and trigger automated review request workflows for closed Zillow clients.
