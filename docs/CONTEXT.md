# Meadow CRM

Shared business language for the realtor CRM. A glossary only: no implementation detail, no requirements, no decisions.

## The business

**Business**:
The real estate practice using the CRM. At launch it is one realtor and one assistant, sharing all data.

**User**:
A person with their own identity for accessing the CRM on behalf of the business. The realtor and the assistant are separate users of the same business.

**Module**:
A coherent area of CRM behavior. Core modules are always present; optional modules can be switched off for the business.

**View**:
A presentation of records that combines information from modules without owning a separate copy of it.

**Inbox**:
The cross-module list of items waiting on a person: overdue work, clients needing a follow-up, and anything held for review. Each entry points at the record that produced it.

**Integration**:
The CRM's support for an external service, including its authorization and configuration. One integration may serve several modules.

**Settings**:
The business-wide configuration of modules, their options, checklist templates, and the tag vocabulary. Settings change how the CRM behaves for everyone.

**Milestone**:
A scoped delivery of new capability. Each milestone has its own research and, where needed, its own spec.

## People and work

**Client**:
A person whose relationship with the business is recorded in the CRM. A client exists independently of any single engagement and can take part in several opportunities. The app's list of clients is the client registry. Assistants do not have clients of their own.

**Opportunity**:
A prospective engagement with one or more clients. Opportunities are what the pipeline tracks.

**Opportunity type**:
The kind of engagement an opportunity represents. There are exactly four: **Buyer**, **Seller**, **Estate Sale**, and **Construction**. There is no generic "other" type; an engagement that fits none of the four is still recorded against its closest fit.

- **Buyer** — the client is buying a home.
- **Seller** — the client is selling a home.
- **Estate Sale** — the business works with a local company that coordinates and runs estate sales, so the work here is the referral relationship rather than the sale itself.
- **Construction** — construction work the owner takes on personally for a client, as a side line rather than through a brokerage.

**Lead source**:
Where a client came from — a referral, an open house, a sign, the website, a walk-in. It is a field on the client, and it is how the business understands which of those relationships are worth more.

**Pipeline**:
The progression of opportunities through the stages of an engagement.

**Stage**:
A position in the pipeline, saying how far along an engagement is. There are exactly four, in order, and they are fixed rather than user-defined.

- **New lead** — an inquiry the business has not yet worked in depth: a new lead, a walk-in, a referral, an incoming call, or a past client returning for something new.
- **Active lead** — the client is committed and the work is underway: qualifying, preparing, searching, marketing, showing, negotiating, and making offers. Most of the time is spent here.
- **Under contract** — a signed agreement is in force and the engagement is in due diligence, contingencies, and closing.
- **Closed** — the engagement finished and was completed: the transaction closed, the job was delivered.

**Timeline**:
How soon the client expects to transact: **1-3 mo**, **3-6 mo**, or **6+ mo**. It expresses the client's own stated horizon and is used to prioritize, filter, and sort — never to gate or judge an opportunity.

**Tag**:
A label describing a relationship rather than a stage. Clients are tagged; opportunities inherit the tags of the clients involved in them. The starting vocabulary is **sphere**, **nurture**, and **referral**, and it can be extended in settings.

- **sphere** — in the realtor's sphere of influence: past clients, friends and family, and the wider network they come from.
- **nurture** — worth staying in touch with, but not looking to transact now. For now it is purely a label: nothing follows from it automatically.
- **referral** — the client was referred to the business. It says how the relationship started, not that the client refers others.

**Checklist**:
The list of steps that apply to one opportunity, copied from a checklist template when the user asks for it. Items can be completed, given a due date, or removed.

**Checklist template**:
The default set of steps for a given opportunity type at a given stage. Templates are edited in settings and copied onto an opportunity, never linked to it, so later edits to a template never rewrite work already in progress.

**Task**:
Work the assistant records and assigns to the realtor. Tasks are a module, distinct from a checklist: a checklist is the deal's own steps, a task is something the realtor is being asked to do.

**Event**:
Something scheduled on a calendar: a showing, an inspection, a closing, a client meeting.

**Reference**:
A labeled pointer from a record to another CRM record or to an external URL or document. References give context; they do not create dependencies or change other records.

**Review queue**:
A holding area where incoming or automatically suggested changes wait for a human decision before they become records.

## Lifecycle

**Archive**:
To remove a client or opportunity from the default views without losing it. Archived records keep every field, every link, and their history, can be searched and restored, and stop appearing in the pipeline and the client registry by default.
