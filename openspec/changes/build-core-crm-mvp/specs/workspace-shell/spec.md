# Workspace shell

## Purpose

Give both users a consistent, phone-usable workspace without treating visual examples as product requirements.

## ADDED Requirements

### Requirement: Shared navigation
The sidebar SHALL provide exactly Dashboard, Pipeline, and Registry, with an identifiable current location. Tasks and the attention view SHALL be capabilities reached through Dashboard and linked records, never sidebar destinations or modules. Settings SHALL be reached through the workspace account menu. Quiet Cream SHALL guide visual styling only; Active Clients, Calendar, and example widgets MUST NOT become additional modules through this change. Calendar is intended for MVP delivery but requires a scoped implementation-plan update; this shell includes only its requested dashboard empty state.

#### Scenario: Initial shell review
- **WHEN** the user reviews the first interface milestone
- **THEN** the main view and sidebar use the Quiet Cream direction, DM Sans UI text, and Newsreader display text with working navigation and fictional development data or empty states; fixture provenance stays in code/documentation rather than repeated workspace warnings
- **AND** Phone, review queues, and commission tools are absent; Recent activity and Upcoming events use the user-requested dashboard empty states without claiming connected data sources

#### Scenario: Tasks disabled
- **WHEN** Tasks is disabled business-wide
- **THEN** task navigation and task actions are hidden while the core views remain available

### Requirement: Consistent controls and feedback
Controls in each delivered surface SHALL have consistent focus/press/pending/error feedback. Fields MUST have labels and icon actions MUST have accessible names. Consistency MUST NOT require scaffolding unused controls or imposing dashboard-card styling on unrelated record/settings surfaces.

#### Scenario: Failed form save
- **WHEN** a form save fails
- **THEN** the interface identifies the failure, retains entered values, and allows correction or retry without reporting success

### Requirement: Phone and keyboard operation
All shipped workflows SHALL work on phones and by keyboard. Navigation and detail panels MUST remain reachable, focus MUST be visible, overlays MUST return focus on dismissal, and primary actions MUST NOT depend on hovering or dragging.

#### Scenario: Narrow-screen record edit
- **WHEN** a user opens and edits a record at a 375px viewport width
- **THEN** fields and save/cancel actions remain usable without page-level horizontal overflow
- **AND** a wide table or board scrolls within its own region or offers an adapted presentation

#### Scenario: Keyboard panel dismissal
- **WHEN** a keyboard user opens and dismisses an overlay detail panel
- **THEN** focus enters the panel, Escape dismisses it, and focus returns to the opener

### Requirement: Early demo login
The first visual milestone SHALL include a development-only `/login` with cream/white split surfaces and a demo submission that navigates to the dashboard. It MUST NOT authenticate users, persist passwords, or imply that the app is protected before real login is implemented.

#### Scenario: Demo submission
- **WHEN** the user submits the local demo login
- **THEN** the white login panel transitions into the destination workspace main panel and the cream surface becomes the sidebar region
- **AND** the demo does not send or store a real password

### Requirement: Collapsed sidebar
Users SHALL toggle expanded and collapsed sidebar states with a smooth layout transition. Destinations MUST remain identifiable and keyboard/touch operable in either state, and collapse MUST NOT reset the current route or unsaved edits.

#### Scenario: Collapse during an edit
- **WHEN** a user collapses and re-expands the sidebar while editing a record
- **THEN** the main region adjusts smoothly while the draft and current location remain unchanged

### Requirement: Motion-led navigation
Supported client-side route changes SHALL coordinate the shared surfaces and destination content through bounded transitions rather than abruptly replacing them. Errors, interruption, unsupported APIs, and reduced-motion preferences MUST NOT prevent navigation or leave controls inaccessible.

#### Scenario: Login and workspace continuity
- **WHEN** navigation proceeds from login to the requested page or between workspace pages
- **THEN** cream/white surfaces preserve visual continuity and content appears in a coordinated transition, even when a bounded animation phase slightly delays navigation

#### Scenario: Interrupted or reduced-motion navigation
- **WHEN** navigation is interrupted, fails, or the user requests reduced motion
- **THEN** the app settles into a usable destination/error state without a stuck animation, trapped focus, or unnecessary spatial motion
