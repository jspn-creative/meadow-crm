# Tasks and attention

## Purpose

Surface actionable work from shared records without introducing a separate queue or unspecified reminder automation.

## ADDED Requirements

### Requirement: Optional realtor tasks
When Tasks is enabled, both users SHALL create/edit tasks assigned to the realtor, with a title, optional due date and client/opportunity link, and completion/reopen actions. Tasks MUST persist independently of checklist items. Assistant assignment and event links are outside this MVP.

#### Scenario: Standalone task
- **WHEN** the assistant creates a task without a related record or due date
- **THEN** it saves for the realtor and appears among open tasks without an overdue indicator

#### Scenario: Complete a linked task
- **WHEN** the realtor completes a task linked to an opportunity
- **THEN** the task is completed without completing any checklist item or changing the opportunity's stage

### Requirement: Derived inbox
The inbox SHALL list overdue incomplete checklist work on non-archived opportunities using the configured checklist stage scope, plus overdue tasks when enabled. Overdue means a due date before today in the business timezone. Entries SHALL open their source, including the source checklist stage. Nurture/timeline/calendar/review items and independently maintained queue state MUST NOT be added.

#### Scenario: Attention sources
- **WHEN** there is an overdue checklist item, an overdue task, a nurture-tagged client, and an old timeline value
- **THEN** only the checklist item and enabled task appear in the inbox
- **AND** completing, redating, or archiving the source opportunity removes its checklist attention entry

#### Scenario: Open previous-stage attention
- **WHEN** All visited stages is enabled and a user opens an overdue prior-stage item
- **THEN** the opportunity modal opens with that stage's checklist inspected while the opportunity's actual stage remains unchanged

### Requirement: Inbox task creation
When Tasks is enabled, an overdue checklist entry SHALL offer one action opening a task form prefilled with title, opportunity, and source-stage context without leaving the inbox. Saving creates a separate realtor task without completing/dismissing the source item. Existing task entries SHALL open their task rather than create duplicates.

#### Scenario: Create from checklist attention
- **WHEN** a user opens the prefilled task form and saves it
- **THEN** one task is created with the source opportunity link and the checklist item remains unchanged
- **AND** duplicate submission of the same save request does not create another task

### Requirement: One shared dashboard
Both business users SHALL land on a functioning shared dashboard showing open/overdue realtor tasks when enabled, scoped overdue checklist work, and non-archived opportunity counts by stage. Widgets SHALL link to source records or filtered views. An admin impersonating either user SHALL see that same view. Calendar, Active Clients, and example-derived reporting SHALL remain unimplemented.

#### Scenario: Shared landing view
- **WHEN** either user logs in with the same business data
- **THEN** the same dashboard sections and pipeline counts appear and an empty workspace shows actionable empty states rather than fabricated data

### Requirement: Module disabling preserves work
Disabling Tasks SHALL hide task navigation, dashboard/inbox task projections, and task creation actions and reject task mutations server-side. Existing tasks MUST be retained and reappear when enabled. Core checklist behavior MUST be unaffected.

#### Scenario: Disable and re-enable
- **WHEN** either user disables Tasks and later re-enables it
- **THEN** saved task dates and completion states are preserved and overdue checklist work remains visible throughout
