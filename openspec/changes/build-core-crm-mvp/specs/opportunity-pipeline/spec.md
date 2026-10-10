# Opportunity pipeline

## Purpose

Track all engagements on one shared board while preserving flexible progress and client relationships.

## ADDED Requirements

### Requirement: Fixed shared pipeline
The board SHALL show non-archived opportunities in New lead, Active lead, Under contract, and Closed, in that order. Buyer, Seller, Estate Sale, and Construction SHALL share those stages; type SHALL supply a labeled visual distinction, not a separate board.

#### Scenario: Mixed work
- **WHEN** opportunities of all four types exist
- **THEN** they appear on the same four-stage board, with type identifiable without relying only on color

### Requirement: Opportunity editing
Users SHALL create/edit opportunities with title, type, stage, one or more clients, optional timeline/property address/budget, notes, and references. Timeline SHALL accept only 1-3 mo, 3-6 mo, 6+ mo, or no value. An address or budget MUST NOT be required. Board selection SHALL open an opportunity modal containing the Pipeline checklist sidebar widget.

#### Scenario: Buyer with no property
- **WHEN** a user creates a titled Buyer opportunity for two clients without an address, budget, timeline, or manually supplied checklist
- **THEN** it saves at the selected stage linked from both clients and displays that stage's default checklist, including an empty template when defined

#### Scenario: Reference management
- **WHEN** a user adds a labeled HTTPS document link or CRM record reference and later removes it
- **THEN** the reference opens its destination while present and its removal does not delete or modify the destination
- **AND** executable URL schemes are rejected

#### Scenario: USD budget
- **WHEN** a user saves a budget of $125,000.50 and reopens the opportunity
- **THEN** the same USD amount appears without rounding away cents or offering another currency

#### Scenario: Opportunity modal
- **WHEN** a user selects a board card
- **THEN** the opportunity opens in a phone/keyboard-usable modal with a compact checklist sidebar widget, not a separate checklist module

### Requirement: Explicit unrestricted stage movement
Users SHALL move opportunities forward, backward, or directly to any fixed stage using a keyboard/touch-operable action without a completion gate. Movement SHALL display the destination stage's inherited/customized checklist while preserving other visited stages' progress and history. Closed MUST mean engagement completion, not discarded work.

#### Scenario: Contract falls through
- **WHEN** a user moves an Under contract opportunity back to Active lead
- **THEN** the same opportunity displays its retained Active lead checklist state, preserves Under contract progress, and records the stage decision

#### Scenario: Close with unfinished steps
- **WHEN** a user marks a completed engagement Closed with unfinished checklist items
- **THEN** the opportunity displays the Closed checklist while unfinished work from the prior stage remains preserved and eligible for attention under the configured scope

### Requirement: Board projections and filtering
Cards SHALL show type, stage, optional timeline, inherited tags, current-stage checklist progress, and derived overdue indicators using the business's checklist attention scope. Other-stage attention MUST be distinguishable from current-stage progress. Users SHALL filter by type/timeline/inherited tags and sort by timeline without creating expiration dates or automated follow-up.

#### Scenario: Timeline filter and order
- **WHEN** a user filters to Buyer opportunities and orders by timeline
- **THEN** matching cards use 1-3 mo, 3-6 mo, 6+ mo order with unset timelines last, and no expiry or health label is generated

### Requirement: Independent opportunity archive
Users SHALL archive and restore opportunities through explicit archived views separate from the board. Archive MUST retain data, client associations, and history without archiving clients. Archived opportunity checklist work MUST be excluded from default attention projections; independent tasks MUST remain actionable.

#### Scenario: Dead engagement
- **WHEN** a user archives an opportunity with a closing note
- **THEN** it leaves the board and its checklist work leaves attention views while clients and independent tasks remain available
- **AND** restoration retains its former stage, note, references, and checklist
