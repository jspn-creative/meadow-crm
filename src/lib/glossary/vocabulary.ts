// The project's single source of business language. `vp run vocabulary` renders it into AGENTS.md; the Glossary view renders it in the app.

export const kinds = [
	"Concept",
	"Role",
	"Module",
	"View",
	"Widget",
	"Record",
	"Field",
	"Value",
	"Status",
	"Action",
] as const;
export type Kind = (typeof kinds)[number];

/** What each kind of term is, shown as the kind's tooltip in the Glossary. */
export const kindDescriptions: Record<Kind, string> = {
	Concept: "An idea or rule that shapes the product; it is not stored or shown on its own.",
	Role: "A kind of person who uses or supports the workspace.",
	Module: "A main area of the app with its own sidebar item.",
	View: "Something you navigate to that shows records or tools.",
	Widget: "A self-contained block on a dashboard.",
	Record: "Something the business stores that opens in its own detail view.",
	Field: "A piece of information kept on a record.",
	Value: "One of the allowed values of a field, or a part of one.",
	Status: "A condition something can be in, such as overdue.",
	Action: "Something a person does to a record.",
};

export type Term = {
	term: string;
	kind: Kind;
	meaning: string;
	/** Words that must not be used for this concept. */
	not?: string[];
	/** What is still undecided; never resolve it silently. */
	open?: string;
	children?: Term[];
};

export const vocabulary: Term[] = [
	{
		term: "Business",
		kind: "Concept",
		meaning: "Meadow Lane Realty & Development: one realtor and one assistant sharing all data.",
		not: ["company", "organization", "tenant", "account"],
		children: [
			{
				term: "User",
				kind: "Role",
				meaning:
					"A person with their own login. The realtor and the assistant are the two business users, and both can see and change every record.",
				not: ["member", "seat"],
				children: [
					{
						term: "Realtor",
						kind: "Role",
						meaning: "The business owner, and the person whose task list tasks land on.",
						not: ["agent (in this repo, an agent is an AI coding agent)"],
					},
					{
						term: "Assistant",
						kind: "Role",
						meaning:
							"Keeps records organized and creates tasks for the realtor, often by promoting checklist items.",
						not: ["admin"],
					},
				],
			},
			{
				term: "Support admin",
				kind: "Role",
				meaning:
					"The developer's own account. It signs in and impersonates either business user to give support, and has no CRM role of its own.",
				not: ["admin user", "superuser", "owner"],
				children: [
					{
						term: "Impersonate",
						kind: "Action",
						meaning:
							"Act as a business user from the support admin account. History records both who acted and who they acted as.",
						not: ["log in as", "switch user", "sudo"],
					},
				],
			},
		],
	},
	{
		term: "Module",
		kind: "Concept",
		meaning:
			"A feature with its own sidebar item. A module owns one or more views. The modules are Dashboard, Pipeline, and Registry.",
		not: ["section", "area", "app"],
		open: "Whether a module can be switched off.",
	},
	{
		term: "View",
		kind: "Concept",
		meaning:
			"Something a user navigates to that shows records or tools. Most views belong to a module, and a module can have several. A few views belong to no module, such as Settings and the Glossary.",
		not: ["page", "screen"],
	},
	{
		term: "Integration",
		kind: "Concept",
		meaning:
			"A connection to an outside service, such as Google Calendar, with its own authorization and configuration. It builds on an existing module rather than becoming one. Calendar integration is deferred.",
		not: ["plugin", "connector", "sync"],
	},
	{
		term: "Record",
		kind: "Concept",
		meaning:
			"Something the business stores that opens in its own detail view to be read or edited: a client from the Registry, an opportunity from its Pipeline card, a task from Today's Tasks. A record's detail view has a references section and a history section.",
		not: ["entry", "object"],
		children: [
			{
				term: "Reference",
				kind: "Field",
				meaning:
					"A link in a record's references section. Its kind sets how it looks: a linked record shown by that record's own name, such as a task's opportunity; a web link, such as a Zillow listing; or an uploaded file, such as a signed contract. Web links and files can be given a friendly name; linked records cannot. Uploads and related records do not get sections of their own; they are references. A promoted task's reference points to its opportunity, and its chip can also show the checklist item.",
				not: ["attachment", "dependency", "related record"],
			},
			{
				term: "History",
				kind: "Field",
				meaning:
					"The saved list of changes to a record: what changed, when, by whom, and as whom when impersonating. Shown in the record's detail view.",
				not: ["audit log", "changelog"],
			},
			{
				term: "Archive",
				kind: "Action",
				meaning:
					"Hide a client or opportunity from default views while keeping every field, link, and its history; it can be restored. Archiving is how dead work leaves the board; Closed is reserved for completed engagements.",
				not: ["delete", "remove", "close"],
			},
			{
				term: "Delete",
				kind: "Action",
				meaning:
					"Remove a record permanently, as far as users can tell; behind the scenes it may be kept briefly.",
				not: ["archive"],
				open: "Which records can be deleted, and how. Some delete options will exist in the MVP.",
			},
		],
	},
	{
		term: "Dashboard",
		kind: "Module",
		meaning:
			"The landing module. For now there are two fixed versions: one for the realtor and one for the assistant.",
		not: ["home", "overview"],
		open: "Letting users customize their own dashboards later.",
		children: [
			{
				term: "Widget",
				kind: "Concept",
				meaning: "A self-contained block on a dashboard, built on `DashboardCard`.",
				not: ["panel", "tile"],
				children: [
					{
						term: "Today's Tasks",
						kind: "Widget",
						meaning:
							"On the realtor's dashboard: incomplete tasks whose date has arrived. An unfinished task rolls over to the next day until it is completed.",
					},
					{
						term: "Inbox",
						kind: "Widget",
						meaning:
							"On the assistant's dashboard: things the assistant should do or check, each linking to its source record. It replaces the earlier idea of a review queue.",
						not: ["review queue", "queue", "notifications", "messages", "attention"],
						open: "What it lists; overdue tasks are a likely start.",
					},
				],
			},
		],
	},
	{
		term: "Pipeline",
		kind: "Module",
		meaning:
			"The module whose single board moves every opportunity through the stages, whatever its type.",
		not: ["funnel", "workflow", "kanban (as a name)"],
		children: [
			{
				term: "Opportunity",
				kind: "Record",
				meaning:
					"A prospective engagement, usually with one or more clients; the unit the pipeline tracks. A client is not required.",
				not: ["deal", "lead", "listing", "job", "project", "transaction"],
				children: [
					{
						term: "Opportunity type",
						kind: "Field",
						meaning:
							"Exactly four, with no \"other\": Buyer (the client is buying a home), Seller (the client is selling a home), Estate Sale (a referral to the partner company that runs the sale), Construction (work the realtor takes on personally as a side line). Fixed for now but implemented so another type can be added later without a redesign. Changing an opportunity's type is treated as a correction and replaces its checklists with the new type's templates.",
						not: ["category", "kind", "deal type"],
					},
					{
						term: "Stage",
						kind: "Field",
						meaning:
							"A fixed position in the pipeline, in order: New lead (an inquiry not yet worked in depth), Active lead (committed and underway: qualifying, searching, showing, negotiating), Under contract (a signed agreement in force, through due diligence and closing), Closed (the engagement completed).",
						not: ["status", "column", "phase", "step"],
						children: [
							{
								term: "Lead",
								kind: "Value",
								meaning:
									'Appears only inside the stage names New lead and Active lead. Never call a client or an opportunity "a lead".',
							},
						],
					},
					{
						term: "Timeline",
						kind: "Field",
						meaning:
							"The client's stated horizon: 1-3 mo, 3-6 mo, or 6+ mo. Optional; used to prioritize, filter, and sort, never to gate or judge.",
						not: ["urgency", "priority", "deadline", "temperature"],
					},
					{
						term: "Checklist",
						kind: "Field",
						meaning:
							"An opportunity's checklist items for one stage. Each stage keeps its own checklist, so returning to a stage shows it as it was left. A checklist starts from its checklist template and keeps following it: template changes reach every opportunity, except items that were added, renamed, removed, or reordered on that opportunity, which keep their local version.",
						not: ["to-do list", "task list"],
						open: "What happens to tasks promoted from items that a type change replaces.",
						children: [
							{
								term: "Checklist item",
								kind: "Value",
								meaning:
									"One line of a checklist. It can be checked off, and giving it a date or a due date promotes it to a task.",
								not: ["step", "to-do"],
								children: [
									{
										term: "Promote",
										kind: "Action",
										meaning:
											"Turn a checklist item into a task on the realtor's task list by giving it a date or a due date. Behind the scenes this creates a task linked to the item. The two share one title, and completing, reopening, or deleting either one does the same to the other. When the opportunity moves to another stage, each open task promoted from the current stage's checklist can be completed, deleted, or ignored.",
										not: ["convert", "escalate"],
										open: "Keeping the task and item titles in sync is a working assumption.",
									},
								],
							},
						],
					},
					{
						term: "Checklist template",
						kind: "Concept",
						meaning:
							"The checklist for one opportunity type at one stage, 16 in all, edited in Settings. Editing a template changes the default checklists of every opportunity at that type and stage.",
						not: ["preset"],
					},
				],
			},
		],
	},
	{
		term: "Registry",
		kind: "Module",
		meaning:
			'The module listing every client. "Client registry" is fine where it reads more clearly.',
		not: ["client list", "contacts", "directory"],
		open: "The name may change.",
		children: [
			{
				term: "Client",
				kind: "Record",
				meaning:
					"A person the business has a relationship with. A client exists on its own and can take part in several opportunities.",
				not: ["contact", "customer", "lead", "prospect"],
				children: [
					{
						term: "Lead source",
						kind: "Field",
						meaning:
							"Where a client came from: a referral, an open house, a sign, the website, a walk-in.",
						not: ["source tag", "channel"],
					},
					{
						term: "Tag",
						kind: "Field",
						meaning:
							"A relationship label on a client. An opportunity shows the combined tags of its clients, read-only.",
						not: ["label", "category"],
						children: [
							{
								term: "Sphere",
								kind: "Value",
								meaning:
									"In the realtor's sphere of influence: past clients, friends and family, and their wider network.",
							},
							{
								term: "Nurture",
								kind: "Value",
								meaning: "Worth staying in touch with, but not looking to transact now.",
								open:
									"The follow-up behavior built on it, which belongs in the MVP but is not specified yet.",
							},
							{
								term: "Referral",
								kind: "Value",
								meaning:
									"The client was referred to the business. It says how the relationship started, not that the client refers others.",
							},
							{
								term: "Retired tag",
								kind: "Status",
								meaning: "A tag that can no longer be applied but stays on existing clients until removed.",
								not: ["archived tag", "deleted tag"],
							},
						],
					},
				],
			},
		],
	},
	{
		term: "Task",
		kind: "Record",
		meaning:
			"Work on the realtor's task list. Usually created by the assistant, directly or by promoting a checklist item; the realtor can create tasks too. A task can carry a time, a location, and a repeat, so scheduled things such as showings are tasks.",
		not: ["to-do", "reminder", "action item", "event", "appointment"],
		children: [
			{
				term: "Date",
				kind: "Field",
				meaning:
					"When the task starts appearing on the task list. If it is not completed, it rolls over to the next day.",
			},
			{
				term: "Due date",
				kind: "Field",
				meaning: "The deadline. A task not completed by its due date becomes overdue.",
				not: ["deadline"],
			},
			{
				term: "Overdue",
				kind: "Status",
				meaning:
					"A task that is not completed and whose due date is before today in the business's timezone; a promoted checklist item shares its task's status. It is a problem for the realtor who missed it and for the assistant who may need to fix it.",
				not: ["late", "urgent", "attention"],
			},
		],
	},
	{
		term: "Settings",
		kind: "View",
		meaning:
			"Configuration, opened from the account menu. Working assumption: panels for User preferences, Business settings, and one per module.",
		not: ["preferences (as the view's name)", "admin", "config"],
		open: "How Settings is organized.",
	},
	{
		term: "Glossary",
		kind: "View",
		meaning: "This vocabulary as a searchable, expandable table, opened from the account menu.",
		not: ["reference page (a reference is a link on a record)"],
		open: "Whether it grows into a help view with tips and FAQs.",
	},
];
