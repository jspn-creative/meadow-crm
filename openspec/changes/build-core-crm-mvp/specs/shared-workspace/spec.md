# Shared workspace

## Purpose

Protect the business's client information and keep both users working from durable, consistent shared records.

## ADDED Requirements

### Requirement: App-managed access
The completed app SHALL provide login/logout for two equal business users and a separately provisioned support admin. Unauthenticated requests MUST NOT read/mutate CRM data; public signup MUST be unavailable. Sessions MUST expire and logout MUST invalidate them. Demo identity SHALL be restricted to local development/test and disabled in production.

#### Scenario: Protected request
- **WHEN** a visitor without a valid session requests a CRM page or data endpoint
- **THEN** no client information is returned and page navigation goes to login while data requests reject access

#### Scenario: Independent equal users
- **WHEN** either provisioned user logs in
- **THEN** the same shared records and settings are available, with no role-gated CRM actions

#### Scenario: Logout and signup rejection
- **WHEN** a user logs out or a visitor attempts public signup
- **THEN** the old session no longer grants access or the signup is rejected, respectively

#### Scenario: Development shortcut cannot escape
- **WHEN** a production build receives a demo-identity request or authentication is unconfigured
- **THEN** it refuses CRM access rather than falling back to an unauthenticated development user

### Requirement: Attributable admin impersonation
The admin SHALL select either business user and perform CRM actions as that effective user through server-verified impersonation. The UI MUST identify the impersonated user and offer switch/exit. Ordinary users MUST NOT impersonate. Changes MUST record both actual actor and effective user; the admin MUST NOT act on CRM records without selecting a business-user identity.

#### Scenario: Admin acts as the assistant
- **WHEN** the admin selects the assistant and edits an opportunity
- **THEN** the interface clearly shows the assistant identity while history attributes the action to the admin acting as the assistant

#### Scenario: Forbidden identity switch
- **WHEN** an ordinary user attempts impersonation or a request forges an effective-user ID
- **THEN** the server rejects it without changing sessions or records

#### Scenario: Switch or exit impersonation
- **WHEN** the admin switches business users or exits impersonation
- **THEN** identity-dependent data is refreshed/isolated, the previous effective identity no longer authorizes new actions, and exit returns to the admin's identity-selection state

### Requirement: Durable shared records
Saved records/settings SHALL survive reloads and sessions and be available to both business users. Views MUST project the same records. Fictional clients/opportunities SHALL be available early in isolated development through an explicit seed/reset path. Production seeds MUST NOT introduce those fixtures, and browser caches MUST NOT replace shared persistence.

#### Scenario: Two-user persistence
- **WHEN** one user saves a client and the other loads the registry in a separate session
- **THEN** the second user sees the saved client, and it remains after both browsers reload

#### Scenario: Repeat development seeding
- **WHEN** the local fictional record seed runs twice
- **THEN** it provides useful client/opportunity scenarios without duplicates or silently overwriting user edits
- **AND** the production seed includes only approved defaults, not fictional clients/opportunities

### Requirement: Validated and conflict-safe writes
The server SHALL validate every mutation and reject malformed or stale writes without partially applying the operation. Failed writes MUST preserve the last committed state and MUST NOT silently overwrite a newer edit.

#### Scenario: Concurrent editing
- **WHEN** two users edit the same record revision and the second saves after the first
- **THEN** the second save reports a conflict and retains their draft instead of overwriting the first save

#### Scenario: Stale write with related changes
- **WHEN** a stale opportunity save also attempts to change client links and record a history entry
- **THEN** the opportunity, links, and successful-change history all remain unchanged by that rejected save

#### Scenario: Invalid related record
- **WHEN** a mutation references a nonexistent client or submits an invalid stage
- **THEN** the entire operation is rejected and existing records and links remain unchanged

### Requirement: Retained change history
Record changes SHALL retain an attributable history including timestamp, acting user, and changed data. Archiving MUST NOT erase that history. Record details SHALL expose the retained history without requiring a reporting module.

#### Scenario: Archived history
- **WHEN** an opportunity changes stage and is later archived and restored
- **THEN** its detail still shows the stage change and archive/restore actions with the acting users and timestamps

### Requirement: Optimistic interaction with confirmed persistence
Safe small edits SHALL provide immediate optimistic feedback and identifiable pending state. Server rejection MUST roll back tentative presentation without corrupting confirmed data or silently discarding recoverable drafts. Offline writes and realtime delivery MUST NOT be represented as supported unless separately implemented and verified.

#### Scenario: Rejected optimistic stage move
- **WHEN** a stage move appears immediately but the server rejects it due to a stale revision
- **THEN** the tentative position is reverted, the conflict is explained, and the user's recoverable edit is retained

#### Scenario: Unavailable network
- **WHEN** a mutation cannot reach the server without a verified durable offline outbox
- **THEN** it is not reported as saved and the user receives retry/recovery feedback
