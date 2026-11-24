<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { ArrowLeft, Ban, Cake, Check, Flag, Mail, MessageSquare, Maximize2, NotebookPen, Pencil, Phone, Plus, X } from "@lucide/svelte";
	import { getActivity, getLastContact, saveClient } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { notToBeContacted } from "#lib/data/consent.js";
	import { userFirstName } from "#lib/data/users.js";
	import Select from "#lib/ui/Select.svelte";
	import { leadSources, referralSource } from "#lib/data/lead-sources.js";
	import { overflowFade } from "#lib/attachments/overflow-fade.js";
	import ActivitySection from "#lib/activity/ActivitySection.svelte";
	import LogContactPane from "#lib/activity/LogContactPane.svelte";
	import NoteComposer from "#lib/activity/NoteComposer.svelte";
	import { calledName as callName, clientFacts } from "#lib/activity/client-facts.js";
	import type { ActivityLookup } from "#lib/activity/entries.js";
	import { channelNoun, outcomeLabels } from "#lib/activity/describe.js";
	import { activityDates } from "#lib/activity/feed.js";
	import { RecordActivity, type NewOpportunity } from "#lib/activity/record-activity.svelte.js";
	import { mainPaneClass, SubPanel, subPaneClass } from "#lib/activity/sub-panel.svelte.js";
	import type { ActivityOpportunity, ContactEntry } from "#lib/activity/types.js";
	import OpportunityPanel from "#lib/pipeline/OpportunityPanel.svelte";
	import { clientDraft, clientSaveInput, type ClientDraft } from "./client-draft.js";
	import { formatCalendarDate, formatPhone, preferenceItems } from "./format.js";
	import PreferencesEditor from "./PreferencesEditor.svelte";
	import type { PanelSection } from "./SectionCrumb.svelte";
	let {
		draft = $bindable(),
		workspace,
		remote,
		updates = [],
		saved,
		fresh = false,
		opportunities,
		pending = $bindable(false),
		section = $bindable({ name: "", forward: true }),
		onpopout,
	}: {
		draft: ClientDraft;
		workspace: Pick<Workspace, "clients" | "referenceClients" | "tags" | "identity" | "links" | "opportunities" | "settings">;
		remote?: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>;
		/** Other queries showing this client, such as the Registry list, refreshed with the save. */
		updates?: Parameters<ReturnType<typeof saveClient>["updates"]>;
		saved: () => void;
		/** A client just created from a name: start with their first person open for editing. */
		fresh?: boolean;
		/** The client's opportunities, shown between their contact details and the rest. It receives a function that opens one in the drawer. */
		opportunities?: Snippet<[open: (id: string) => void]>;
		pending?: boolean;
		/** The section scrolled under the top of the panel, such as Activity, for the dialog's breadcrumb; empty while the client's header shows. */
		section?: PanelSection;
		/** Leaves the drawer's opportunity for its full dialog, over the client. */
		onpopout?: (id: string) => void;
	} = $props();

	// The details read as a profile; each section switches to its fields on its own, and one save covers every open section.
	type Section = "flag" | "details" | "people" | "addresses" | "relationships" | "keyDates";
	const editing = new SvelteSet<Section>();
	let announcement = $state("");
	let failure = $state("");
	let conflict = $state(false);
	let conflictRefreshing = $state(false);
	let conflictReady = $state(false);
	let refreshFailed = $state(false);
	let reviewedRevision = $state<number | null>(null);
	let clientRecord = $derived(workspace.clients.find((client) => client.id === draft.id));
	let previousPayload = "";
	let requestId = "";
	const methods = [
		["call", "Call"],
		["text", "Text"],
		["email", "Email"],
		["mail", "Mail"],
	] as const;
	const referredByModes: { value: ClientDraft["referredByMode"]; label: string }[] = [
		{ value: "client", label: "An existing client" },
		{ value: "name", label: "A typed name" },
	];
	const channels = [
		["consentCall", "Call"],
		["consentText", "Text"],
		["consentEmail", "Email"],
		["consentMail", "Mail"],
	] as const;
	let linkable = $derived(workspace.referenceClients.filter((client) => client.id !== draft.id && (!client.archivedAt || client.id === draft.referredByClientId)));
	let leadSourceChoices = $derived(draft.leadSource && !leadSources.includes(draft.leadSource) ? [...leadSources, draft.leadSource] : leadSources);
	let referral = $derived(draft.leadSource === referralSource);
	// Imported referrals arrived without a referrer; they can still be saved until someone fills it in.
	let referrerRequired = $derived(!(clientRecord?.leadSource === referralSource && !clientRecord.referredByClientId && !clientRecord.referredByName));
	let tagChoices = $derived(workspace.tags.filter((tag) => !tag.retiredAt || draft.tagIds.includes(tag.id)));
	let appliedTags = $derived(workspace.tags.filter((tag) => draft.tagIds.includes(tag.id)));
	let clientName = (id: string) => workspace.referenceClients.find((client) => client.id === id)?.name ?? "Unknown client";
	let savedReview = $derived.by(() => {
		if (!clientRecord) return [];
		const current = clientDraft(clientRecord);
		return [
			["Name", current.name],
			["Flag", current.flagged ? `Flagged for review${current.flagNote ? `\n${current.flagNote}` : " · no note added"}` : "Not flagged"],
			["Lead source", current.leadSource],
			["Referred by", current.referredByClientId ? clientName(current.referredByClientId) : current.referredByName],
			["Preferences", current.preferences],
			["Preferred contact method", methods.find(([value]) => value === current.preferredContactMethod)?.[1]],
			["Consent", channels.map(([field, label]) => `${label}: ${current[field] ? "allowed" : "not allowed"}`).join(" · ")],
			["People", current.people.map((person) => [person.name, person.birthday && `Birthday: ${formatCalendarDate(person.birthday)}`, ...person.phones.map((phone) => `${phone.label}: ${formatPhone(phone.value)}`), ...person.emails.map((email) => `${email.label}: ${email.value}`)].filter(Boolean).join("\n")).join("\n\n")],
			["Addresses", current.addresses.map((address) => `${address.label}: ${address.address}${address.owned ? " · owned" : ""}`).join("\n")],
			["Relationships", current.relationships.map((relationship) => `${relationship.label}: ${clientName(relationship.relatedClientId)}`).join("\n")],
			["Key dates", current.keyDates.map((date) => `${date.name}: ${formatCalendarDate(date.date)}`).join("\n")],
			["Tags", clientRecord.tags.map((tag) => tag.name).join(", ")],
		];
	});
	function relatable() {
		return workspace.referenceClients.filter((client) => client.id !== draft.id && (!client.archivedAt || draft.relationships.some((row) => row.relatedClientId === client.id)));
	}

	let phone = $derived(draft.people.flatMap((person) => person.phones).find((row) => row.value.trim())?.value);
	let email = $derived(draft.people.flatMap((person) => person.emails).find((row) => row.value.trim())?.value);
	let doNotContact = $derived(notToBeContacted(draft));
	let others = $derived(
		draft.people.length === 1 && draft.people[0]?.name === draft.name
			? ""
			: draft.people
					.map((person) => person.name)
					.filter(Boolean)
					.join(" & "),
	);
	let since = $derived(clientRecord ? new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(new Date(clientRecord.createdAt)) : "");
	let referredBy = $derived(!referral ? "" : draft.referredByMode === "client" ? (draft.referredByClientId ? clientName(draft.referredByClientId) : "") : draft.referredByName);
	let preferences = $derived(preferenceItems(draft.preferences));
	let preferredMethod = $derived(methods.find(([value]) => value === draft.preferredContactMethod)?.[1] ?? "");
	let missing = $derived(
		[
			!draft.addresses.length && !editing.has("addresses") && (["addresses", "Address"] as const),
			!draft.relationships.length && !editing.has("relationships") && workspace.referenceClients.length > 1 && (["relationships", "Relationship"] as const),
			!draft.keyDates.length && !editing.has("keyDates") && (["keyDates", "Key date"] as const),
			!draft.flagged && !editing.has("flag") && (["flag", "Flag for review"] as const),
		].filter((item) => item !== false),
	);

	// Only the panel's first render decides this; later prop changes never reopen sections.
	if (untrack(() => fresh)) {
		if (!draft.people.length) draft.people.push({ id: crypto.randomUUID(), name: draft.name, birthday: "", phones: [{ id: crypto.randomUUID(), label: "Mobile", value: "" }], emails: [{ id: crypto.randomUUID(), label: "Personal", value: "" }] });
		editing.add("people");
	}

	function add(section: Section) {
		if (section === "people") draft.people.push({ id: crypto.randomUUID(), name: "", birthday: "", phones: [], emails: [] });
		if (section === "addresses") draft.addresses.push({ id: crypto.randomUUID(), label: "Home", address: "", owned: false });
		if (section === "relationships") draft.relationships.push({ id: crypto.randomUUID(), relatedClientId: "", label: "" });
		if (section === "keyDates") draft.keyDates.push({ id: crypto.randomUUID(), name: "", date: "" });
		if (section === "flag") draft.flagged = true;
		editing.add(section);
	}
	function cancel() {
		if (clientRecord) draft = clientDraft(clientRecord);
		editing.clear();
		failure = "";
		conflict = false;
	}
	async function refreshSaved() {
		conflictRefreshing = true;
		try {
			await Promise.all([remote?.refresh(), ...updates.flatMap((query) => ("refresh" in query ? [query.refresh()] : []))]);
			refreshFailed = false;
			conflictReady = true;
		} catch {
			refreshFailed = true;
		} finally {
			conflictRefreshing = false;
		}
	}
	function reapplyDraft() {
		if (!clientRecord || reviewedRevision !== clientRecord.revision) return;
		draft.revision = clientRecord.revision;
		conflict = false;
		failure = "";
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (conflict || pending || !remote) return;
		failure = "";
		refreshFailed = false;
		const body = clientSaveInput(draft, "");
		const payload = JSON.stringify(body);
		if (payload !== previousPayload) {
			requestId = crypto.randomUUID();
			previousPayload = payload;
		}
		pending = true;
		try {
			// A command refreshes only the queries the client names, so the save names getActivity for the History row it writes.
			const result = await saveClient({ ...body, requestId }).updates(remote, ...updates, getActivity);
			draft = { ...draft, revision: Number(result.revision), flagNote: body.flagNote };
			refreshFailed = result.refreshFailed === true;
			editing.clear();
			saved();
		} catch (cause) {
			if (typeof cause === "object" && cause !== null && "status" in cause && cause.status === 409) {
				conflict = true;
				conflictReady = false;
				reviewedRevision = null;
				failure = "This client changed elsewhere. Your draft is retained. Review the saved version before reapplying your edits.";
				await refreshSaved();
			} else failure = "Client could not be saved. Your edits are retained; check the fields and retry.";
		} finally {
			pending = false;
		}
	}

	// --- Activity ---------------------------------------------------------------
	const shellFade = overflowFade({ axis: "y", fadePercent: 12 });
	// The current section is the last one whose top has reached the top of the scroller.
	function trackSection(scroller: HTMLElement) {
		let frame = 0;
		let lastTop = scroller.scrollTop;
		const update = () => {
			frame = 0;
			const forward = scroller.scrollTop >= lastTop;
			lastTop = scroller.scrollTop;
			const top = scroller.getBoundingClientRect().top + 1;
			let current = "";
			for (const node of scroller.querySelectorAll<HTMLElement>("[data-section]")) if (node.getBoundingClientRect().top <= top) current = node.dataset.section!;
			if (current !== section.name) section = { name: current, forward };
		};
		const schedule = () => (frame ||= requestAnimationFrame(update));
		scroller.addEventListener("scroll", schedule, { passive: true });
		schedule();
		return () => {
			cancelAnimationFrame(frame);
			scroller.removeEventListener("scroll", schedule);
		};
	}

	let timeZone = $derived(workspace.settings?.timezone ?? "America/Los_Angeles");
	let dates = $derived(activityDates(timeZone));
	let userId = $derived(workspace.identity.effectiveUserId);
	// The name sentences use: the first person's first name, or the client's name when it holds several people.
	let calledName = $derived(callName(draft));
	let linkedOpportunities = $derived(workspace.links.filter((link) => link.clientId === draft.id).flatMap((link) => workspace.opportunities.find((row) => row.id === link.opportunityId) ?? []));
	let openOpportunities = $derived(linkedOpportunities.filter((row) => !row.archivedAt && row.stage !== "closed"));
	const record = new RecordActivity(
		{ clientId: untrack(() => draft.id) },
		{
			identity: () => workspace.identity,
			// A new opportunity from Log contact joins the client's Opportunities and the Registry's counts.
			extra: () => [...(remote ? [remote] : []), ...updates],
		},
	);
	const lookup: ActivityLookup = { client: (id) => clientName(id), tag: (id) => workspace.tags.find((tag) => tag.id === id)?.name ?? "a removed" };
	let entries = $derived(record.entries(lookup));
	// Last contacted and the latest attempt come from the server, counting contact logged on the client's opportunities too (ACT-9). Logging or deleting contact anywhere refreshes them with the Registry's rows.
	const lastContact = getLastContact({ clientId: untrack(() => draft.id) });
	let summary = $derived(lastContact.current ?? { lastContacted: undefined, latestAttempt: undefined });
	let facts = $derived(clientFacts(draft, lastContact.current));

	let activity: ReturnType<typeof ActivitySection> | undefined = $state();
	// Log contact and an opportunity slide over the client as a sub-panel. Log contact opens on a channel when the user reached out from the header, and plain Log contact opens on Call. The breadcrumb names the sub-panel, and the opportunity's own, while it is open, and returns to the section the user left.
	type Panel = { kind: "log"; channel?: "call" | "text" | "email" } | { kind: "opportunity"; id: string };
	let beforePanel: PanelSection = { name: "", forward: true };
	/** The sub-panel last opened, kept while it slides away. */
	let shown = $state<Panel | null>(null);
	let innerCrumb = $state("");
	const panel = new SubPanel<Panel>((open) => {
		if (open) beforePanel = section;
		else section = { ...beforePanel, forward: false };
	});
	const panelName = (value: Panel) => (value.kind === "log" ? "Log contact" : [linkedOpportunities.find((row) => row.id === value.id)?.title ?? "Opportunity", innerCrumb].filter(Boolean).join(" / "));
	function openPanel(value: Panel) {
		shown = value;
		innerCrumb = "";
		panel.open(value);
		section = { name: panelName(value), forward: true };
	}
	function crumb(name: string) {
		innerCrumb = name;
		if (panel.current) section = { name: panelName(panel.current), forward: !!name };
	}
	function popOut() {
		if (panel.current?.kind !== "opportunity") return;
		const { id } = panel.current;
		panel.close();
		onpopout?.(id);
	}
	const who = (entry: ContactEntry) => (entry.actor.kind === "user" ? `by ${userFirstName(entry.actor.userId)}` : entry.actor.kind === "client" ? `from ${calledName}` : "by BoldTrail");
	const recap = (entry: ContactEntry) => [channelNoun(entry), entry.outcome && outcomeLabels[entry.outcome].toLowerCase(), who(entry)].filter(Boolean).join(" · ");

	// The drawer's opportunity: its clients' key details, with Last contacted only for this client, whose whole Activity is loaded.
	let shownOpportunity = $derived.by(() => {
		const value = shown;
		return value?.kind === "opportunity" ? linkedOpportunities.find((row) => row.id === value.id) : undefined;
	});
	let opportunityClients = $derived(shownOpportunity ? workspace.links.filter((link) => link.opportunityId === shownOpportunity.id).flatMap((link) => (link.clientId === draft.id ? [facts] : workspace.clients.filter((client) => client.id === link.clientId).map((client) => clientFacts(client)))) : []);

	async function show(id: string) {
		await activity?.reveal(id);
	}
	async function postNote(body: string) {
		const { id, saved } = record.post(body);
		void show(id);
		const posted = await saved;
		announcement = posted ? "Note posted." : "";
		return posted;
	}
	async function logContact(entry: ContactEntry, about: ActivityOpportunity[], created?: NewOpportunity) {
		const { id, saved } = record.log(entry, about, created);
		if (!(await saved)) return false;
		panel.close();
		announcement = created ? "Opportunity created and contact logged." : "Contact logged.";
		void show(id);
		return true;
	}
</script>

{#snippet sectionHead(section: Section, title: string)}
	<div class="mb-2 flex min-h-6 items-center justify-between gap-3">
		<h3 id={`client-${section}`} class="font-display text-base">{title}</h3>
		{#if !editing.has(section)}<button type="button" class="icon-action" aria-label={`Edit ${title.toLowerCase()}`} title={`Edit ${title.toLowerCase()}`} onclick={() => editing.add(section)}><Pencil size={14} aria-hidden="true" /></button>{/if}
	</div>
{/snippet}

{#snippet row(label: string, value: Snippet)}
	<div class="grid min-w-0 items-baseline gap-x-4 py-1 leading-[1.4] @min-[22rem]/details:grid-cols-[7rem_minmax(0,1fr)]">
		<dt class="text-muted">{label}</dt>
		<dd class="min-w-0 wrap-anywhere">{@render value()}</dd>
	</div>
{/snippet}

<!-- A section short enough to read as one row: its title sits in the label column and its pencil at the end. Editing opens the full section. -->
{#snippet compact(section: Section, title: string, value: Snippet)}
	<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-1 leading-[1.4] @min-[22rem]/details:grid-cols-[7rem_minmax(0,1fr)_auto]">
		<h3 id={`client-${section}`} class="text-muted">{title}</h3>
		<button type="button" class="icon-action h-lh @min-[22rem]/details:order-last" aria-label={`Edit ${title.toLowerCase()}`} title={`Edit ${title.toLowerCase()}`} onclick={() => editing.add(section)}><Pencil size={14} aria-hidden="true" /></button>
		<div class="min-w-0 wrap-anywhere @max-[22rem]/details:col-span-2">{@render value()}</div>
	</div>
{/snippet}

<!-- One way to reach someone, under their name: what it is, the value, and its label. -->
{#snippet way(icon: typeof Phone, label: string, value: Snippet)}
	{@const Icon = icon}
	<li class="col-span-2 grid min-w-0 grid-cols-subgrid items-center">
		<Icon size={14} class="text-muted" aria-hidden="true" />
		<span class="flex min-w-0 items-baseline gap-2"
			>{@render value()}{#if label}<span class="text-muted shrink-0 text-xs">{label}</span>{/if}</span>
	</li>
{/snippet}

{#snippet removeButton(label: string, onclick: () => void)}
	<button type="button" class="icon-action mx-2" aria-label={label} title={label} {onclick}><X size={16} aria-hidden="true" /></button>
{/snippet}

{#snippet addButton(label: string, onclick: () => void, disabled = false)}
	<button type="button" class="text-action" {disabled} {onclick}><Plus size={14} aria-hidden="true" />{label}</button>
{/snippet}

{#snippet fieldLabel(text: string, hint = "")}
	<span class="field-label"
		>{text}{#if hint}<span class="font-normal">{" · "}{hint}</span>{/if}</span>
{/snippet}

<!-- Reaching out and recording it are one motion: the link starts the call, text, or email, and Log contact opens on that channel. -->
{#snippet reach(icon: typeof Phone, label: string, href: string, allowed: boolean, channel: "call" | "text" | "email")}
	{@const Icon = icon}
	{#if allowed}<a class="control" data-size="sm" {href} title={`${label} ${calledName}, then log it`} onclick={() => openPanel({ kind: "log", channel })}><Icon size={15} aria-hidden="true" />{label}</a>{:else}<button type="button" class="control" data-size="sm" disabled title={`No consent to ${label.toLowerCase()}`}
			><Icon size={15} aria-hidden="true" />{label}</button
		>{/if}
{/snippet}

<!-- How long ago leads, because that is the question; who, how, and the date follow. A filled dot means the client was reached. -->
{#snippet contactRow(term: string, entry: ContactEntry | undefined, empty: string, wasReached: boolean)}
	{#if entry}
		<button type="button" class="hover:bg-highlight grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-baseline gap-x-2.5 rounded-lg px-2.5 py-2 text-left transition-colors" title="Show in Activity" onclick={() => show(entry.id)}>
			<span class={["size-2 self-center rounded-full", wasReached ? "bg-success" : "border-muted border"]} aria-hidden="true"></span>
			<span class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1.5"><span class="text-muted">{term}</span><span class="font-medium">{dates.ago(entry.at)}</span><span class="text-muted text-xs">{recap(entry)}</span></span>
			<span class="text-muted text-xs tabular-nums">{dates.short(entry.at)}</span>
		</button>
	{:else}
		<p class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-2.5 px-2.5 py-2"><span class="border-muted size-2 self-center rounded-full border" aria-hidden="true"></span><span><span class="text-muted">{term}</span> <span class="font-medium">{empty}</span></span></p>
	{/if}
{/snippet}

<p class="sr-only" role="status">{announcement}</p>
<!-- One scroller holds the header, the details, and Activity; what the user acts with stays pinned under it. -->
<!-- The client and Log contact share one cell and trade places: the client slides aside toward the start as Log contact arrives from the end, and the dialog widens to fit its key details. -->
<div class="@container/shell flex min-h-0 flex-1 flex-col text-sm" data-layout={panel.current?.kind === "log" || (panel.current && innerCrumb) ? "logging" : "stacked"} {@attach panel.stepBack}>
	<div class="shell grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] overflow-hidden">
		<div class={mainPaneClass} data-active={!panel.current} inert={!!panel.current}>
			<div class="min-h-0 flex-1 [scrollbar-gutter:stable] overflow-y-auto overscroll-contain" {@attach shellFade} {@attach trackSection}>
				<header class="px-(--gutter) pt-5 pb-5">
					<h2 id="client-panel-heading" class="font-display min-w-0 text-2xl tracking-tight wrap-anywhere @min-[36rem]/shell:text-3xl">{draft.name || "Client"}</h2>
					{#if others || since}<p class="text-muted mt-1.5">{[others, since && `Client since ${since}`].filter(Boolean).join(" · ")}</p>{/if}
					{#if appliedTags.length || doNotContact || draft.flagged}
						<div class="mt-3 flex flex-wrap gap-1.5">
							{#if doNotContact}<span class="chip" data-tone="urgent"><Ban size={12} aria-hidden="true" />Do not contact</span>{/if}
							{#if draft.flagged}<span class="chip"><Flag size={12} class="text-field" aria-hidden="true" />Flagged for review</span>{/if}
							{#each appliedTags as tag (tag.id)}<span class="chip" data-dot style:--dot={tag.color}>{tag.name}{tag.retiredAt ? " (retired)" : ""}</span>{/each}
						</div>
					{/if}
					<div class="mt-4 flex flex-wrap items-center gap-2">
						{#if phone}
							{@render reach(Phone, "Call", `tel:${phone}`, draft.consentCall, "call")}
							{@render reach(MessageSquare, "Text", `sms:${phone}`, draft.consentText, "text")}
						{/if}
						{#if email}{@render reach(Mail, "Email", `mailto:${email}`, draft.consentEmail, "email")}{/if}
						<button type="button" class="control ml-auto @max-[26rem]/shell:w-full" data-variant="primary" data-size="sm" onclick={() => openPanel({ kind: "log" })}><NotebookPen size={15} aria-hidden="true" />Log contact</button>
					</div>
					<div class="work-row mt-3 p-1">
						{#if lastContact.loading && !lastContact.current}
							<p class="text-muted px-2.5 py-2" role="status">Loading contact…</p>
						{:else if summary.lastContacted || summary.latestAttempt}
							{@render contactRow("Last contacted", summary.lastContacted, "never", true)}
							<!-- ACT-9: an attempt that reached the client is already Last contacted, so it shows once. -->
							{#if summary.latestAttempt?.id !== summary.lastContacted?.id}{@render contactRow("Latest attempt", summary.latestAttempt, "none yet", false)}{/if}
						{:else}
							<p class="text-muted px-2.5 py-2">No contact logged yet.</p>
						{/if}
					</div>
				</header>

				<form onsubmit={submit} id="client-pane-details" aria-label="Client details" class="border-hairline @container/details min-w-0 border-t px-(--gutter)" aria-busy={pending}>
					<!-- Every block between dividers gets the same room, so nothing sits tight against a rule. -->
					<fieldset disabled={pending} class="divide-hairline min-w-0 divide-y [&>:not(legend)]:py-5">
						<legend class="sr-only">Client details</legend>
						{#if draft.flagged || editing.has("flag")}
							<section class="min-w-0" aria-labelledby="client-flag" data-section="Flag">
								{@render sectionHead("flag", "Flag")}
								{#if editing.has("flag")}
									<label class="flex min-h-9 items-center gap-3"
										><input
											class="check"
											type="checkbox"
											bind:checked={draft.flagged}
											onchange={(event) => {
												if (!event.currentTarget.checked) draft.flagNote = "";
											}} /><span>Flag for review</span></label>
									{#if draft.flagged}<label class="labeled mt-2">{@render fieldLabel("Flag note", "optional")}<textarea class="field block field-sizing-content min-h-20 resize-none leading-[1.4]" bind:value={draft.flagNote} maxlength="2000" placeholder="What needs to be reviewed?"></textarea></label>{/if}
								{:else}
									<div class="work-row px-3 py-2.5">
										<p class="text-field flex items-center gap-2 leading-none font-medium"><Flag size={14} aria-hidden="true" />Flagged for review</p>
										<p class="mt-1.5 wrap-anywhere whitespace-pre-wrap">{draft.flagNote || "No note added."}</p>
									</div>
								{/if}
							</section>
						{/if}

						<section class="min-w-0" aria-labelledby="client-people" data-section="People">
							{@render sectionHead("people", "People")}
							{#if editing.has("people")}
								<div class="space-y-3">
									{#each draft.people as person, personIndex (person.id)}
										{@const n = personIndex + 1}
										<div class="work-row min-w-0 space-y-2 p-3" role="group" aria-label={person.name || `Person ${n}`}>
											<div class="flex items-end gap-1">
												<div class="grid min-w-0 flex-1 gap-2 @min-[24rem]/details:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
													<label class="labeled"><span class="sr-only">Person {n} </span>{@render fieldLabel("Name")}<input class="field" bind:value={person.name} maxlength="200" autocomplete="off" /></label>
													<label class="labeled"><span class="sr-only">Person {n} </span>{@render fieldLabel("Birthday")}<input class="field tabular-nums" type="date" bind:value={person.birthday} /></label>
												</div>
												<div class="flex min-h-11 items-center">{@render removeButton(`Remove person ${n}`, () => (draft.people = draft.people.filter((row) => row.id !== person.id)))}</div>
											</div>
											<!-- A phone or email is one boundary: its icon, its label, its value, and its remove button. -->
											{#each person.phones as phoneRow, phoneIndex (phoneRow.id)}
												<div class="field-group gap-0">
													<span class="field-addon"><Phone size={13} aria-hidden="true" /></span>
													<input class="field-bare w-22 flex-none" aria-label={`Person ${n} phone ${phoneIndex + 1} label`} bind:value={phoneRow.label} placeholder="Mobile" maxlength="100" />
													<span class="bg-hairline h-5 w-px shrink-0" aria-hidden="true"></span>
													<input class="field-bare tabular-nums" aria-label={`Person ${n} phone ${phoneIndex + 1} number`} bind:value={phoneRow.value} type="tel" maxlength="200" placeholder="Phone number" />
													{@render removeButton(`Remove person ${n} phone ${phoneIndex + 1}`, () => (person.phones = person.phones.filter((row) => row.id !== phoneRow.id)))}
												</div>
											{/each}
											{#each person.emails as emailRow, emailIndex (emailRow.id)}
												<div class="field-group gap-0">
													<span class="field-addon"><Mail size={13} aria-hidden="true" /></span>
													<input class="field-bare w-22 flex-none" aria-label={`Person ${n} email ${emailIndex + 1} label`} bind:value={emailRow.label} placeholder="Personal" maxlength="100" />
													<span class="bg-hairline h-5 w-px shrink-0" aria-hidden="true"></span>
													<input class="field-bare" aria-label={`Person ${n} email ${emailIndex + 1} address`} bind:value={emailRow.value} type="email" maxlength="200" placeholder="Email address" />
													{@render removeButton(`Remove person ${n} email ${emailIndex + 1}`, () => (person.emails = person.emails.filter((row) => row.id !== emailRow.id)))}
												</div>
											{/each}
											<div class="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
												{@render addButton("Phone", () => person.phones.push({ id: crypto.randomUUID(), label: "", value: "" }))}
												{@render addButton("Email", () => person.emails.push({ id: crypto.randomUUID(), label: "", value: "" }))}
											</div>
										</div>
									{/each}
									{@render addButton("Add person", () => add("people"))}
								</div>
							{:else if draft.people.length}
								<ul class="space-y-4">
									{#each draft.people as person (person.id)}
										<li class="min-w-0">
											{#if draft.people.length > 1 || person.name !== draft.name}<p class="item-title mb-2">{person.name || "Unnamed person"}</p>{/if}
											<ul class="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-2">
												{#each person.phones.filter((row) => row.value) as phoneRow (phoneRow.id)}
													{#snippet phoneValue()}<a class="tabular-nums hover:underline" href={`tel:${phoneRow.value}`}>{formatPhone(phoneRow.value)}</a>{/snippet}
													{@render way(Phone, phoneRow.label, phoneValue)}
												{/each}
												{#each person.emails.filter((row) => row.value) as emailRow (emailRow.id)}
													{#snippet emailValue()}<a class="truncate hover:underline" href={`mailto:${emailRow.value}`}>{emailRow.value}</a>{/snippet}
													{@render way(Mail, emailRow.label, emailValue)}
												{/each}
												{#if person.birthday}
													{#snippet birthdayValue()}<span class="tabular-nums">{formatCalendarDate(person.birthday)}</span>{/snippet}
													{@render way(Cake, "Birthday", birthdayValue)}
												{/if}
												{#if !person.phones.some((row) => row.value) && !person.emails.some((row) => row.value)}<li class="text-muted col-span-2">No phone or email</li>{/if}
											</ul>
										</li>
									{/each}
								</ul>
							{:else}
								<p class="text-muted">No people yet.</p>
							{/if}
						</section>

						{#if opportunities}<section class="min-w-0" aria-label="Opportunities" data-section="Opportunities">{@render opportunities((id) => openPanel({ kind: "opportunity", id }))}</section>{/if}

						<section class="min-w-0" aria-labelledby="client-details" data-section="Details">
							{@render sectionHead("details", "Details")}
							{#if editing.has("details")}
								<div class="space-y-3.5">
									<label class="labeled">{@render fieldLabel("Client name")}<input class="field" bind:value={draft.name} required maxlength="200" autocomplete="off" /></label>
									<div class="grid min-w-0 gap-3 @min-[24rem]/details:grid-cols-2">
										<label class="labeled">{@render fieldLabel("Lead source")}<Select bind:value={draft.leadSource} options={[{ value: "", label: "Not set" }, ...leadSourceChoices.map((source) => ({ value: source, label: source }))]} /></label>
										<label class="labeled">{@render fieldLabel("Preferred contact")}<Select bind:value={draft.preferredContactMethod} options={[{ value: "", label: "Not set" }, ...methods.map(([value, label]) => ({ value, label }))]} /></label>
										{#if referral}
											<label class="labeled">{@render fieldLabel("Referred by")}<Select bind:value={draft.referredByMode} options={referredByModes} /></label>
											{#if draft.referredByMode === "client"}
												<label class="labeled"
													>{@render fieldLabel("Referring client")}<Select bind:value={draft.referredByClientId} required={referrerRequired} options={[{ value: "", label: "Choose a client" }, ...linkable.map((client) => ({ value: client.id, label: `${client.name}${client.archivedAt ? " (archived)" : ""}` }))]} /></label>
											{:else}
												<label class="labeled">{@render fieldLabel("Referrer's name")}<input class="field" bind:value={draft.referredByName} required={referrerRequired} maxlength="200" placeholder="A lender or another agent" /></label>
											{/if}
										{/if}
									</div>
									<div role="group" aria-label="Tags" class="labeled">
										<p aria-hidden="true">{@render fieldLabel("Tags")}</p>
										<div class="flex flex-wrap gap-2">
											{#each tagChoices as tag (tag.id)}
												{@const applied = draft.tagIds.includes(tag.id)}
												<button type="button" class="control" data-size="sm" aria-pressed={applied} onclick={() => (draft.tagIds = applied ? draft.tagIds.filter((id) => id !== tag.id) : [...draft.tagIds, tag.id])}>
													<span class="size-1.5 shrink-0 rounded-full" style:background={tag.color} aria-hidden="true"></span>{tag.name}{tag.retiredAt ? " (retired)" : ""}
												</button>
											{:else}<p class="text-muted">No tags yet.</p>{/each}
										</div>
									</div>
									<div role="group" aria-label="May contact by" class="labeled">
										<p aria-hidden="true">{@render fieldLabel("May contact by")}</p>
										<div class="segmented">
											{#each channels as [key, label] (key)}
												<button type="button" aria-pressed={draft[key]} onclick={() => (draft[key] = !draft[key])}
													>{#if draft[key]}<Check size={13} aria-hidden="true" />{/if}{label}</button>
											{/each}
										</div>
										{#if doNotContact}<p class="text-urgent text-xs" role="status">Every channel is off, so this client is marked as not to be contacted.</p>{/if}
									</div>
									<PreferencesEditor bind:value={draft.preferences} />
								</div>
							{:else}
								<dl>
									{#snippet leadValue()}{draft.leadSource || "Not set"}{/snippet}
									{@render row("Lead source", leadValue)}
									{#if referredBy}{#snippet referredValue()}{referredBy}{/snippet}{@render row("Referred by", referredValue)}{/if}
									{#if preferredMethod}{#snippet methodValue()}{preferredMethod}{/snippet}{@render row("Prefers", methodValue)}{/if}
									{#snippet consentValue()}
										<span class="flex flex-wrap gap-x-2 gap-y-0.5">
											{#each channels as [key, label] (key)}
												<span class={["inline-flex items-center gap-1", !draft[key] && "text-muted line-through"]}
													>{#if draft[key]}<Check size={13} class="text-success" aria-hidden="true" />{/if}{label}<span class="sr-only">{draft[key] ? " allowed" : " not allowed"}</span></span>
											{/each}
										</span>
									{/snippet}
									{@render row("May contact by", consentValue)}
									{#if preferences.length}
										{#snippet preferencesValue()}
											{#if preferences.length > 1}<ul class="marker:text-muted list-disc space-y-1 pl-4">
													{#each preferences as item}<li>{item}</li>{/each}
												</ul>{:else}{preferences[0]}{/if}
										{/snippet}
										{@render row("Preferences", preferencesValue)}
									{/if}
								</dl>
							{/if}
						</section>

						<!-- Short sections share one block as rows; an empty one stays out of the way until someone adds to it. -->
						{#if draft.addresses.length || draft.relationships.length || draft.keyDates.length || editing.has("addresses") || editing.has("relationships") || editing.has("keyDates") || missing.length}
							<div class="min-w-0 space-y-1">
								{#if editing.has("addresses")}
									<section class="min-w-0 py-3 first:pt-0" aria-labelledby="client-addresses">
										{@render sectionHead("addresses", draft.addresses.length === 1 ? "Address" : "Addresses")}
										<div class="space-y-3">
											{#each draft.addresses as address, index (address.id)}
												<div class="work-row min-w-0 space-y-2 p-3" role="group" aria-label={`Address ${index + 1}`}>
													<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @min-[24rem]/details:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_auto]">
														<input class="field @max-[24rem]/details:col-span-full" aria-label={`Address ${index + 1} label`} bind:value={address.label} placeholder="Home" maxlength="100" />
														<input class="field" aria-label={`Address ${index + 1}`} bind:value={address.address} maxlength="1000" autocomplete="off" placeholder="Street, city, state, zip" />
														{@render removeButton(`Remove address ${index + 1}`, () => (draft.addresses = draft.addresses.filter((row) => row.id !== address.id)))}
													</div>
													<label class="flex min-h-9 items-center gap-3"><input class="check" type="checkbox" bind:checked={address.owned} /><span>The client owns this property</span></label>
												</div>
											{/each}
											{@render addButton("Add address", () => add("addresses"))}
										</div>
									</section>
								{:else if draft.addresses.length}
									{#snippet addressesValue()}
										<ul class="space-y-1">
											{#each draft.addresses as address (address.id)}
												<li>
													{address.address}{#if address.label || address.owned}<span class="text-muted text-xs">{" · "}{[address.label, address.owned && "Owned"].filter(Boolean).join(" · ")}</span>{/if}
												</li>
											{/each}
										</ul>
									{/snippet}
									{@render compact("addresses", draft.addresses.length === 1 ? "Address" : "Addresses", addressesValue)}
								{/if}
								{#if editing.has("relationships")}
									<section class="min-w-0 py-3 first:pt-0" aria-labelledby="client-relationships">
										{@render sectionHead("relationships", "Relationships")}
										<div class="space-y-2">
											{#each draft.relationships as relationship, index (relationship.id)}
												<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @min-[24rem]/details:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]">
													<Select class="@max-[24rem]/details:col-span-full" label={`Relationship ${index + 1} client`} bind:value={relationship.relatedClientId} required options={[{ value: "", label: "Choose a client" }, ...relatable().map((client) => ({ value: client.id, label: client.name }))]} />
													<input class="field" aria-label={`Relationship ${index + 1} label`} bind:value={relationship.label} placeholder="Parent, sibling, colleague" maxlength="100" required />
													{@render removeButton(`Remove relationship ${index + 1}`, () => (draft.relationships = draft.relationships.filter((row) => row.id !== relationship.id)))}
												</div>
											{/each}
											{@render addButton("Add relationship", () => add("relationships"), !workspace.referenceClients.length)}
										</div>
									</section>
								{:else if draft.relationships.length}
									{#snippet relationshipsValue()}
										<ul class="space-y-1">
											{#each draft.relationships as relationship (relationship.id)}
												<li>{clientName(relationship.relatedClientId)}<span class="text-muted text-xs">{" · "}{relationship.label || "Related"}</span></li>
											{/each}
										</ul>
									{/snippet}
									{@render compact("relationships", "Relationships", relationshipsValue)}
								{/if}
								{#if editing.has("keyDates")}
									<section class="min-w-0 py-3 first:pt-0" aria-labelledby="client-keyDates">
										{@render sectionHead("keyDates", "Key dates")}
										<div class="space-y-2">
											{#each draft.keyDates as keyDate, index (keyDate.id)}
												<div class="grid min-w-0 grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] items-center gap-2">
													<input class="field" aria-label={`Key date ${index + 1} name`} bind:value={keyDate.name} placeholder="Wedding anniversary" maxlength="100" />
													<input class="field tabular-nums" aria-label={`Key date ${index + 1} date`} type="date" bind:value={keyDate.date} />
													{@render removeButton(`Remove key date ${index + 1}`, () => (draft.keyDates = draft.keyDates.filter((row) => row.id !== keyDate.id)))}
												</div>
											{/each}
											{@render addButton("Add key date", () => add("keyDates"))}
										</div>
									</section>
								{:else if draft.keyDates.length}
									{#snippet keyDatesValue()}
										<ul class="space-y-1">
											{#each draft.keyDates as keyDate (keyDate.id)}
												<li>{keyDate.name || "Key date"}<span class="text-muted text-xs tabular-nums">{" · "}{keyDate.date ? formatCalendarDate(keyDate.date) : "No date"}</span></li>
											{/each}
										</ul>
									{/snippet}
									{@render compact("keyDates", "Key dates", keyDatesValue)}
								{/if}
								{#if missing.length}
									<div class="flex flex-wrap gap-x-4 gap-y-1 not-first:pt-3">
										{#each missing as [section, label] (section)}{@render addButton(label, () => add(section))}{/each}
									</div>
								{/if}
							</div>
						{/if}

						{#if clientRecord?.importedData.length}
							<details class="min-w-0">
								<summary class="text-muted cursor-pointer">Imported data <span class="font-normal">· {clientRecord.importedData.length} fields from the previous CRM, read-only</span></summary>
								<dl class="mt-2 text-xs [&_dt]:leading-[1.1]">
									{#each clientRecord.importedData as item (item.label)}
										{#snippet importedValue()}<span class="whitespace-pre-wrap">{item.value}</span>{/snippet}
										{@render row(item.label, importedValue)}
									{/each}
								</dl>
							</details>
						{/if}
					</fieldset>

					{#if refreshFailed}
						<div class="bg-pending-soft text-pending mb-4 flex flex-wrap items-center gap-3 rounded-xl p-3 text-xs" role="status">
							<p class="min-w-0 flex-1">{conflict ? "The saved version could not refresh. Your draft is retained." : "Client saved, but displayed data could not refresh."}</p>
							<button type="button" class="text-action" disabled={conflictRefreshing} onclick={refreshSaved}>Retry refresh</button>
						</div>
					{/if}
					{#if conflict}
						<div class="bg-pending-soft text-pending mb-4 space-y-3 rounded-xl p-3 text-sm" role="alert">
							<p>{failure}</p>
							{#if conflictReady && clientRecord}
								<details
									ontoggle={(event) => {
										if (event.currentTarget.open) reviewedRevision = clientRecord?.revision ?? null;
									}}>
									<summary class="cursor-pointer font-medium">Review saved version · revision {clientRecord.revision}</summary>
									<dl class="mt-3 space-y-3 text-xs">
										{#each savedReview as [label, value] (label)}
											<div>
												<dt class="font-medium">{label}</dt>
												<dd class="mt-1 leading-[1.4] wrap-anywhere whitespace-pre-wrap">{value || "Not set"}</dd>
											</div>
										{/each}
									</dl>
								</details>
								<div class="flex flex-wrap gap-2">
									<button type="button" class="control" data-size="sm" disabled={reviewedRevision !== clientRecord.revision} onclick={reapplyDraft}>Reapply draft to this version</button><button type="button" class="control" data-variant="ghost" data-size="sm" onclick={cancel}>Discard draft and reload</button>
								</div>
							{/if}
						</div>
					{/if}
				</form>

				<ActivitySection bind:this={activity} id="client" {entries} client={calledName} opportunities={linkedOpportunities} {timeZone} failure={record.failure} opportunityHref={(id) => `/pipeline?opportunity=${id}`} onedit={(id, text) => record.edit(id, text)} ondelete={(id) => void record.remove(id)}>
					{#snippet empty()}
						{#if record.query.loading && !record.query.current}
							<p class="text-muted py-6 text-center" role="status">Loading Activity…</p>
						{:else if record.query.error}
							<p class="text-urgent py-6 text-center" role="alert">Activity could not load. <button type="button" class="text-action" onclick={() => record.query.refresh()}>Try again</button></p>
						{:else}
							<p class="border-hairline text-muted rounded-xl border border-dashed px-4 py-6 text-center">Nothing here yet. Add a note below, or log your first contact.</p>
						{/if}
					{/snippet}
				</ActivitySection>
			</div>

			{#if editing.size}
				<!-- One bar at a time: while sections are open it is the save bar, otherwise the note composer. Both sit outside the scroller, in reach and never faded. -->
				<div class="bg-canvas/95 border-hairline flex shrink-0 flex-wrap items-center gap-2 border-t px-(--gutter) py-3" data-pinned-bar>
					<button class="control" data-variant="primary" data-size="sm" form="client-pane-details" disabled={pending || conflict} aria-busy={pending}>{pending ? "Saving…" : "Save changes"}</button>
					<button type="button" class="control" data-variant="ghost" data-size="sm" disabled={pending} onclick={cancel}>Cancel</button>
					{#if failure && !conflict}<p class="text-urgent min-w-0 flex-1 text-xs" role="alert">{failure}</p>{/if}
				</div>
			{:else}
				<NoteComposer placeholder={`Add a note about ${calledName}…`} onpost={postNote} />
			{/if}
		</div>
		<section class={subPaneClass} data-active={!!panel.current} inert={!panel.current} aria-labelledby={shown?.kind === "opportunity" ? undefined : "log-contact-heading"} aria-label={shown?.kind === "opportunity" ? "Opportunity" : undefined}>
			{#if shown?.kind === "opportunity"}
				<!-- The opportunity stays the client's: Back returns to them, and the full dialog is one step away. -->
				<div class="flex shrink-0 items-center justify-between gap-3 px-(--gutter) pt-4">
					<button bind:this={panel.heading} type="button" class="text-action min-w-0" onclick={() => panel.close()}><ArrowLeft size={14} aria-hidden="true" /><span class="truncate">{draft.name || "Client"}</span></button>
					{#if onpopout}<button type="button" class="control" data-variant="ghost" data-size="sm" onclick={popOut}><Maximize2 size={14} aria-hidden="true" />Open full view</button>{/if}
				</div>
				{#if shownOpportunity}
					{#key panel.key}
						<OpportunityPanel
							opportunity={shownOpportunity}
							clients={opportunityClients}
							called={opportunityClients.length === 1 ? opportunityClients[0]!.called : opportunityClients.map((client) => client.name).join(" and ")}
							identity={() => workspace.identity}
							{timeZone}
							{lookup}
							clientActivity={record.query}
							oncrumb={crumb} />
					{/key}
				{/if}
			{:else}
				<LogContactPane panel={panel as SubPanel<unknown>} back={draft.name || "Client"} headingId="log-contact-heading" client={calledName} clients={[facts]} opportunities={openOpportunities} {timeZone} {userId} channel={shown?.kind === "log" ? shown.channel : undefined} creatable onlog={logContact} />
			{/if}
		</section>
	</div>
</div>

<style>
	.shell {
		--gutter: calc(var(--spacing) * 4);
		@container shell (min-width: 30rem) {
			--gutter: calc(var(--spacing) * 6);
		}
	}
</style>
