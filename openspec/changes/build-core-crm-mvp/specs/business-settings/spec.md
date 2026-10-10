# Business settings

## Purpose

Let either user manage the business's preferences and reusable content without changing live work unexpectedly.

## ADDED Requirements

### Requirement: Global settings
Both users SHALL edit one business-wide settings page. General SHALL hold business name, timezone, date format, and Tasks enabled state. Currency SHALL be fixed to USD with no currency selector. Invalid preference values MUST be rejected. No per-user overrides or configurable stage/type editor SHALL exist in this MVP.

#### Scenario: Shared preferences
- **WHEN** the assistant changes the business timezone and the realtor next loads a view
- **THEN** both users' date formatting and overdue calculations use the saved preference rather than device timezone

### Requirement: Complete editable template matrix
Pipeline settings SHALL contain all 16 type/stage templates seeded from `docs/checklists.md`, with a type selector and four stage tabs around one focused editor. Users SHALL add/rename/reorder/remove steps and confirm resets; empty templates SHALL be valid. Linked stage checklists SHALL follow edits while retaining matching progress. Structurally customized stage lists MUST NOT be rewritten.

#### Scenario: Reset selected template
- **WHEN** a user confirms Reset this template for Buyer / Active lead
- **THEN** only that template's seed structure is restored; the other 15 templates and customized opportunity lists remain unchanged
- **AND** linked lists retain progress for still-present items, restored removed steps start incomplete and undated, and displaced work remains only in history

#### Scenario: Explicit reset of all templates
- **WHEN** a user separately selects Reset all templates and confirms the stated 16-template impact
- **THEN** all seed structures are restored with the same linked-progress and customized-list rules as a single-template reset

#### Scenario: Empty template
- **WHEN** a user removes every item from a template
- **THEN** the empty template persists, linked stage lists reflect its empty structure, and customized lists remain intact

### Requirement: Intentional template change feedback
The template editor SHALL identify the selected type/stage and linked/customized impact, preserve unsaved edits during validation failure, and require confirmation for destructive removal/reset. Reset this template SHALL affect only the selected template; Reset all templates MUST be a separately labeled secondary action. Template identities SHALL survive rename/reorder and resets without resurrecting removed progress.

#### Scenario: Edit a populated template
- **WHEN** a user removes a step or resets a template used by opportunities
- **THEN** the editor communicates the affected linked lists and protected customizations before confirmation, without presenting 16 simultaneous editors

### Requirement: Business-wide checklist attention scope
Pipeline settings SHALL provide All visited stages and Current stage only attention options, defaulting to All visited stages. Either business user SHALL change the shared preference. Aggregate card/inbox/dashboard attention MUST update consistently without deleting progress or changing per-stage preview status.

#### Scenario: Shared scope preference
- **WHEN** the assistant selects Current stage only and the realtor reloads attention views
- **THEN** both see only current-stage checklist attention while prior-stage work remains inspectable and retained

### Requirement: Tag vocabulary management
Client registry settings SHALL allow adding, renaming, recoloring, and retiring tags, seeded with sphere, nurture, and referral. Tags in use MUST NOT be deleted outright. Retired tags SHALL be unavailable for new application and retained on existing clients unless the user explicitly confirms stripping them.

#### Scenario: Rename and recolor
- **WHEN** a user renames or recolors a tag in use
- **THEN** clients and inherited opportunity tags show the updated label/color without losing associations

#### Scenario: Retire without stripping
- **WHEN** a user retires a tag and declines to remove existing assignments
- **THEN** existing clients retain it, opportunities continue inheriting it, and new assignment controls exclude it

#### Scenario: Confirm stripping
- **WHEN** a user explicitly confirms removing a retired tag from existing clients
- **THEN** those assignments are removed and opportunity tag projections update accordingly
