# Domain glossary

Use these terms consistently. This file defines business language; [SPEC.md](./SPEC.md) defines behavior. If definitions conflict, fix the spec rather than adopting a second meaning. Add a term only when it has a distinctive business meaning not already covered here; propose it before introducing it in code or plans.

| Term | Meaning |
| --- | --- |
| Business | Meadow Lane Realty & Development: one realtor and one assistant sharing all data. |
| User | A person with a separate identity accessing the same business's CRM. The two business users share clients and opportunities; a support admin acts through either identity with both identities recorded. |
| Module | A top-level product area with a sidebar destination. The current modules are Dashboard, Pipeline, and Registry only. Tasks, the attention view, and Settings are not modules. |
| View | A presentation of existing records, never a second copy or separate data-entry store. |
| Client | A person recorded independently of an engagement; may participate in multiple opportunities. The client registry is the list of these people. |
| Opportunity | A prospective engagement involving one or more clients; the unit tracked on the pipeline. |
| Opportunity type | Buyer (home purchase), Seller (home sale), Estate Sale (referral to the partner company that runs the sale), or Construction (the realtor's personal side work). No generic other type. |
| Pipeline | The shared progression of opportunities through stages. |
| Stage | New lead (initial inquiry), Active lead (engaged and working), Under contract (signed agreement and work toward completion), or Closed (engagement completed), in that order. |
| Timeline | The client's stated horizon: 1-3 mo, 3-6 mo, or 6+ mo; optional, not a deadline or health score. |
| Lead source | A field recording where a client came from, such as a referral or open house; distinct from tags and notes. |
| Tag | A relationship label owned by clients and inherited by their opportunities. Sphere means the realtor's wider network; nurture means worth staying in touch with, without automatic behavior; referral means referred to the business. |
| Checklist | An opportunity's retained steps and progress for one visited stage, independent of Tasks. Linked to defaults until structurally customized as a whole; an explicit reset clears that stage's customization and progress. |
| Checklist template | Default steps for one opportunity type/stage combination, inherited by linked stage checklists. Completion and due dates belong to the opportunity, not the template. |
| Task | Work assigned to the realtor, distinct from an opportunity's checklist. |
| Inbox | A cross-module view of work requiring attention; entries point to source records. MVP sources are overdue checklist items and tasks. |
| Reference | A labeled pointer to another CRM record or an external URL/document, not an upload or dependency. |
| Archive | Hide a client or opportunity from default views while preserving its data, links, and history and allowing restoration. |
| Settings | Business-wide configuration, including optional capabilities, templates, and tag vocabulary; accessed through the workspace account menu, not the sidebar. |
| Event | Something scheduled on a calendar, such as a showing. Calendar is intended for the MVP, but event storage, sources, and editing behavior still need definition. |
| Integration | A connection to an external service, including authorization/configuration, that extends product behavior rather than automatically becoming a module. No provider or sync behavior is committed by a prototype. |
| Review queue | Human review of incoming or suggested records; deferred until separately specified automated intake exists. |
| Milestone | A scoped delivery of capability, with its own discovery and specification when needed. |
