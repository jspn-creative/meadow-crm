# Opportunity checklists

## Purpose

Provide Pipeline-owned checklist guidance inside the opportunity modal, with stage-linked defaults and separately retained progress for visited stages.

## ADDED Requirements

### Requirement: Per-stage inherited checklists
An opportunity SHALL automatically display its type/stage defaults on creation and first entry to a stage. Each visited stage SHALL retain its own progress and structural customization. Returning to a stage MUST restore that state; entering another stage MUST NOT clear or merge prior-stage lists. Empty defaults SHALL be valid, and unvisited stages MUST NOT generate attention.

#### Scenario: First stage and return
- **WHEN** an opportunity enters Active lead, completes an item, moves to Under contract, and returns to Active lead
- **THEN** it initially inherits Active lead defaults, displays Under contract defaults on entry, and restores its Active lead completion when returning

### Requirement: Checklist editing independent of Tasks
Users SHALL add, rename, reorder, remove, complete/reopen, and optionally date items within the inspected stage's checklist. These operations MUST remain available when Tasks is disabled and MUST NOT change the opportunity's pipeline stage.

#### Scenario: Tasks disabled
- **WHEN** a user edits and completes a checklist item while Tasks is off
- **THEN** the change persists and checklist progress updates on the opportunity and board

### Requirement: Progress does not detach defaults
Completing/reopening an item or assigning/changing its due date SHALL retain template inheritance. Later template rename/reorder MUST preserve matching items' progress through stable identities; new template steps SHALL appear without fabricated progress. Removed steps MUST stop generating attention while their displaced progress remains in history.

#### Scenario: Template edit after completion
- **WHEN** a user completes/dates a linked step and settings later renames/reorders it and adds another step
- **THEN** the renamed step retains completion/date, the order follows the template, and the new step appears incomplete and undated

#### Scenario: Remove a dated linked step
- **WHEN** an inherited template step with opportunity progress is removed from the template
- **THEN** it disappears from the linked checklist and attention projections but the displaced progress remains in history

### Requirement: Structural customization is stage-specific
Adding/removing/renaming/reordering any opportunity checklist step SHALL detach the entire stage's structure from defaults while preserving its progress. Later template edits MUST NOT rewrite that customized stage. Other stages MUST remain unaffected.

#### Scenario: Customized stage survives movement
- **WHEN** a user adds a custom Active lead step, edits the default in settings, and leaves/returns to Active lead
- **THEN** the customized Active lead structure and progress remain intact while other linked stages continue following their defaults

### Requirement: Deliberate full-stage reset
Reset checklist SHALL replace the selected stage with its template defaults, restore linkage, and clear all completion and due dates, including matching items. The action MUST be secondary and require confirmation naming the stage and discarded work. Former work SHALL remain in history only; other stages MUST remain unchanged.

#### Scenario: Return to defaults
- **WHEN** a user confirms resetting a customized stage with completed and dated default steps
- **THEN** all customization is removed and every default step is incomplete and undated, with the former state retained only in history
- **AND** other stages retain their state

#### Scenario: Cancel reset
- **WHEN** a user opens Reset checklist from the secondary menu and cancels its confirmation
- **THEN** no structure, completion, or due date changes

#### Scenario: Reintroduced default step
- **WHEN** a removed template step is restored to a linked checklist
- **THEN** it appears incomplete and undated rather than recovering its historical completion or due date

### Requirement: Type changes preserve stage work
Changing opportunity type MUST preserve visited stages and identify their retained template sources. Users SHALL rebase each visited stage separately to the new type's defaults using the full-stage reset confirmation and clearing behavior. Unvisited stages SHALL use the current opportunity type's defaults on first entry.

#### Scenario: Change type with existing progress
- **WHEN** a worked Buyer opportunity is changed to Seller without confirming a checklist rebase
- **THEN** existing visited-stage work remains intact rather than being replaced by Seller steps

#### Scenario: Rebase one visited stage
- **WHEN** a user confirms rebasing only Active lead from Buyer to Seller
- **THEN** Active lead receives Seller defaults with no completion, dates, or customization, while other visited stages keep their existing work and template sources

#### Scenario: Enter an unvisited stage after a type change
- **WHEN** a Buyer opportunity changes to Seller and first enters Under contract
- **THEN** Under contract automatically inherits Seller defaults without rebasing the visited stages

### Requirement: Previous-stage preview and inspection
The opportunity modal SHALL show compact status for visited stages and allow preview on hover/focus and inspection by click/tap. Inspecting another stage SHALL transition the widget to its retained items and offer return-to-current. The inspected checklist stage and actual opportunity stage MUST be distinguishable; inspection MUST NOT move the opportunity or discard drafts.

#### Scenario: Inspect prior work without moving the deal
- **WHEN** a user previews and selects a previous stage from an Under contract opportunity
- **THEN** its status/items become accessible with a smooth widget transition while the opportunity remains Under contract
- **AND** a touch or keyboard user can do the same without hover

### Requirement: Date-derived overdue work
An incomplete item SHALL be overdue only when its due date is before today in the business timezone. Completed, undated, due-today, and removed items MUST NOT be overdue. Stage previews SHALL show each stage's status; aggregate card/inbox/dashboard attention SHALL use the same configured visited-stage scope and exclude archived opportunities.

#### Scenario: Date boundary
- **WHEN** an item is due today in the business timezone even though a user's device is already on the next date
- **THEN** it is not overdue until the business date advances

#### Scenario: Completion clears attention
- **WHEN** an overdue item is completed
- **THEN** its overdue indication disappears from the board, detail, inbox, and dashboard after the saved change is loaded

### Requirement: Configurable checklist attention scope
Checklist attention SHALL include current and previously visited stages by default. A business-wide Pipeline setting SHALL permit Current stage only instead of All visited stages. Entries MUST identify their source stage, and opening an entry MUST inspect that stage without moving the opportunity. The setting MUST NOT remove stored progress or alter stage-preview status.

#### Scenario: Change attention scope
- **WHEN** an Active lead item remains overdue after the opportunity moves to Under contract and the user changes All visited stages to Current stage only
- **THEN** its aggregate attention entry disappears while its previous-stage status/progress remains accessible in the modal
- **AND** switching back restores the derived entry without recreating work
