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
			"A feature with its own sidebar item. A module owns one or more views. The modules are Dashboard, Pipeline, and Registry, and none of them can be switched off; later modules may be optional.",
		not: ["section", "area", "app"],
	},
	{
		term: "View",
		kind: "Concept",
		meaning:
			"Something a user navigates to that shows records or tools. Most views belong to a module, and a module can have several. A few views belong to no module, such as Settings and the Glossary.",
		not: ["page", "screen"],
		children: [
			{
				term: "View options",
				kind: "Concept",
				meaning:
					"A discreet panel on a view that chooses what the view shows, such as which details the board's opportunity cards show. Saved in the user's browser.",
				not: ["display settings", "settings"],
			},
		],
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
					"Hide a client or opportunity from default views while keeping every field, link, and its history; it can be restored. Archiving is how dead work leaves the board; Closed is reserved for completed engagements. A record created by mistake is deleted, not archived.",
				not: ["delete", "remove", "close"],
			},
			{
				term: "Delete",
				kind: "Action",
				meaning:
					"Remove a record permanently, as far as users can tell; behind the scenes it may be kept briefly. Clients can be deleted, only from the Registry; opportunities and tasks can be deleted too.",
				not: ["archive"],
			},
		],
	},
	{
		term: "Dashboard",
		kind: "Module",
		meaning:
			"The landing module. For now there are two fixed versions: one for the realtor and one for the assistant. Dashboards users customize themselves may come later.",
		not: ["home", "overview"],
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
							"On the assistant's dashboard: things the assistant should do or check, each linking to its record. It lists overdue tasks until they are no longer overdue, and clients, opportunities, and tasks the realtor created until the assistant marks them done. It replaces the earlier idea of a review queue.",
						not: ["review queue", "queue", "notifications", "messages", "attention"],
					},
					{
						term: "Upcoming",
						kind: "Widget",
						meaning:
							"On both dashboards: the realtor's tasks whose date or due date falls in the next several days.",
						not: ["upcoming events", "agenda"],
					},
					{
						term: "Key dates",
						kind: "Widget",
						meaning:
							"On the realtor's dashboard: clients' birthdays and key dates coming up in the next few weeks.",
						not: ["occasions"],
					},
					{
						term: "Realtor's day",
						kind: "Widget",
						meaning:
							"On the assistant's dashboard: the realtor's Today's Tasks. The assistant can edit them there, but the widget is locked against accidental edits until deliberately unlocked.",
					},
					{
						term: "Pipeline summary",
						kind: "Widget",
						meaning:
							"On the assistant's dashboard: the number of opportunities in each stage, linking to the board.",
					},
					{
						term: "Recent activity",
						kind: "Widget",
						meaning:
							"On the assistant's dashboard: the latest changes across records, drawn from their history.",
						not: ["feed", "audit log"],
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
							'Exactly four, with no "other": Buyer (the client is buying a home), Seller (the client is selling a home), Estate Sale (a referral to the partner company that runs the sale), Construction (work the realtor takes on personally as a side line). Fixed for now but implemented so another type can be added later without a redesign. Chosen when the opportunity is created and never changed; an opportunity created with the wrong type is deleted and created again.',
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
											"Turn a checklist item into a task on the realtor's task list by giving it a date or a due date. Behind the scenes this creates a task linked to the item. The two always share one title, so renaming either renames both, and completing, reopening, or deleting either one does the same to the other. When the opportunity moves to another stage, each open task promoted from the current stage's checklist can be completed, deleted, or ignored.",
										not: ["convert", "escalate"],
									},
								],
							},
						],
					},
					{
						term: "Checklist template",
						kind: "Concept",
						meaning:
							"The checklist for one opportunity type at one stage, 16 in all, edited in Settings. Edits are saved together and change the default checklists of every opportunity at that type and stage; a removed item stays on opportunities where it is checked off or promoted.",
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
		children: [
			{
				term: "Client",
				kind: "Record",
				meaning:
					"A person, or several people such as a married couple, whom the business treats as one relationship. A client exists on its own and can take part in several opportunities.",
				not: ["contact", "customer", "lead", "prospect"],
				children: [
					{
						term: "Person",
						kind: "Field",
						meaning:
							'One of the people a client holds, with their own name, birthday, and labeled phone numbers and email addresses. "The Millers" is one client holding two people.',
						not: ["contact", "individual", "member"],
					},
					{
						term: "Address",
						kind: "Field",
						meaning:
							"One of a client's addresses, of any kind, with a label from Registry settings and a marker for whether the client owns it. Distinct from an opportunity's property address.",
						not: ["owned property", "holding"],
					},
					{
						term: "Referred by",
						kind: "Field",
						meaning:
							"Who referred the client: another client, linked, or a typed name when the referrer is not a client, such as a lender or another agent.",
						not: ["referrer", "referral source"],
					},
					{
						term: "Relationship",
						kind: "Field",
						meaning:
							"A labeled link between two clients, such as parent, sibling, or colleague. Labels are edited in Registry settings.",
						not: ["connection", "household link"],
					},
					{
						term: "Key date",
						kind: "Field",
						meaning: "A named custom date on a client, such as a wedding anniversary or a home purchase.",
						not: ["important date", "occasion"],
					},
					{
						term: "Preferences",
						kind: "Field",
						meaning:
							"Free text on how to treat a client, including how to address them. Later it may give AI features context.",
						not: ["salutation", "profile", "about"],
					},
					{
						term: "Consent",
						kind: "Field",
						meaning:
							"Whether a client may be contacted by call, text, email, and mail. On for every client by default; the assistant turns channels off, and turning all of them off marks the client as not to be contacted.",
						not: ["contact permissions", "opt-in", "do-not-contact flag"],
					},
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
							"A label saying where a client stands with the business, such as sphere or nurture. An opportunity shows the combined tags of its clients, read-only. How a client came to the business is lead source and Referred by, not a tag.",
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
									"Its follow-up behavior, which is not part of the MVP and will be decided once the MVP has been tested; an interval set per tag is the leading idea.",
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
			"Configuration, opened from the account menu, with a panel for User preferences, one for Business settings, and one per module.",
		not: ["preferences (as the view's name)", "admin", "config"],
	},
	{
		term: "Glossary",
		kind: "View",
		meaning: "This vocabulary as a searchable, expandable table, opened from the account menu.",
		not: ["reference page (a reference is a link on a record)"],
		open: "Whether it grows into a help view with tips and FAQs after the MVP.",
	},
];
