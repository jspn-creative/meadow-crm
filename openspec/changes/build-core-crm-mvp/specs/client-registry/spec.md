# Client registry

## Purpose

Maintain the business's people independently of engagements, with fast retrieval and reversible record management.

## ADDED Requirements

### Requirement: Client editing and linked work
Users SHALL create and edit clients with name, contact details, address, lead source, notes, and tags. The registry SHALL open client details in a side panel and show associated opportunities linking to their details. Saved clients MUST carry created/updated timestamps.

#### Scenario: Independent client
- **WHEN** a user creates a named client without an opportunity
- **THEN** it saves successfully and can later be linked to multiple opportunities

#### Scenario: Client detail navigation
- **WHEN** a user opens a client and selects one of their opportunities
- **THEN** the client opens in a detail side panel and the selected opportunity's details are reachable

### Requirement: Registry retrieval
The registry SHALL support sortable columns and immediate keyword filtering across name, contact details, address, notes, and tags. It SHALL combine filters for tags, lead source, opportunity count, and archive state and visibly indicate when archived clients are included.

#### Scenario: Combined search
- **WHEN** a user searches a term occurring in notes and applies a tag and lead-source filter
- **THEN** only clients matching the search and both filters are shown
- **AND** clearing filters restores the default non-archived list

#### Scenario: Opportunity count and sorting
- **WHEN** a user filters for clients with no opportunities and sorts by name
- **THEN** only clients with zero linked opportunities appear in name order

### Requirement: URL-backed registry views
Registry search, filters, archive state, sorting, page, and page size SHALL be represented by validated query parameters. Reload, bookmarks, sharing, and Back/Forward MUST restore that view. Filter changes MUST reset/clamp pagination. Row selection and client record content MUST NOT be serialized into view URLs. Named saved-view management is outside this change.

#### Scenario: Restore a bookmarked filter set
- **WHEN** a user opens a URL containing a tag filter, archive choice, and name sort
- **THEN** controls and rows reflect those choices, and reload preserves them

#### Scenario: Back and invalid parameters
- **WHEN** a user navigates Back after changing filters, or opens a URL with invalid sort/page parameters
- **THEN** the prior valid view is restored or invalid values fall back safely without a broken registry

### Requirement: Featured registry controls without demo feature creep
The registry SHALL provide pagination/page size, sorting, filtering, selection/bulk actions, and useful column controls as part of its actual workflow. These controls MUST share the workspace's styling and phone/keyboard behavior. Example table features MUST NOT implicitly add export, spreadsheet editing, or reporting requirements.

#### Scenario: Selection across view changes
- **WHEN** a user selects rows and changes search, filters, archive state, sorting, page, or page size, including through Back/Forward
- **THEN** selection clears and no bulk action can target the former selection

### Requirement: Current-page selection
Selection SHALL be limited to rows on the current page with a visible selected count. Select all MUST select only that page, never all matching records. Changes to search, filters, archive state, sorting, page, or page size SHALL clear selection.

#### Scenario: Select all on a filtered page
- **WHEN** a filtered registry has three pages and the user selects all on page one
- **THEN** only page one's rows are selected and the displayed count matches that scope

### Requirement: Client-owned tags and bulk actions
Users SHALL apply/remove available tags on clients and bulk apply tags or archive selected clients. Opportunities MUST derive their read-only tags from associated clients rather than saving a second editable tag set.

#### Scenario: Tag update propagates
- **WHEN** a tag is removed from one client
- **THEN** linked opportunities lose that inherited tag unless another associated client still carries it

#### Scenario: Bulk tagging
- **WHEN** a user selects several clients and applies a tag
- **THEN** all selected clients receive it once, while unselected clients are unchanged

### Requirement: All-or-nothing bulk changes
Bulk tag/archive SHALL succeed for every selected client or change none. A stale or invalid selected client MUST reject the entire operation without partial record or history changes. The interface SHALL explain the conflict and prompt refresh and reselection.

#### Scenario: One selected client has changed
- **WHEN** another user edits one selected client before a bulk archive is saved
- **THEN** no selected client is archived, no successful archive history is written, and the user receives conflict feedback

### Requirement: Independent reversible client archive
Archiving SHALL exclude a client from the default registry without deleting fields, links, or history or archiving their opportunities. Explicit archived views SHALL permit search and restoration.

#### Scenario: Archive and restore a linked client
- **WHEN** a user archives a client with a live opportunity, then finds and restores the client
- **THEN** the opportunity remains on the board throughout and the restored client retains all details and associations
