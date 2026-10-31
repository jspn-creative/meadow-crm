<script lang="ts">
	import { untrack, type Snippet } from "svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { Ban, Check, Mail, MessageSquare, Pencil, Phone, Plus, X } from "@lucide/svelte";
	import { saveClient } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { notToBeContacted } from "#lib/data/consent.js";
	import Select from "#lib/ui/Select.svelte";
	import { clientDraft, clientSaveInput, leadSources, type ClientDraft } from "./client-draft.js";
	import { formatCalendarDate, formatPhone } from "./format.js";
	let {
		draft = $bindable(),
		workspace,
		remote,
		saved,
		fresh = false,
		opportunities,
		pending = $bindable(false),
	}: {
		draft: ClientDraft;
		workspace: Workspace;
		remote: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>;
		saved: () => void;
		/** A client just created from a name: start with their first person open for editing. */
		fresh?: boolean;
		/** The client's opportunities, shown between their contact details and the rest. */
		opportunities?: Snippet;
		pending?: boolean;
	} = $props();

	// The panel reads as a profile; each section switches to its fields on its own, and one save covers every open section.
	type Section = "details" | "people" | "addresses" | "relationships" | "keyDates" | "notes";
	const editing = new SvelteSet<Section>();
	let failure = $state("");
	let notesExpanded = $state(false);
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
		{ value: "none", label: "Not referred" },
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
	let tagChoices = $derived(workspace.tags.filter((tag) => !tag.retiredAt || draft.tagIds.includes(tag.id)));
	let appliedTags = $derived(workspace.tags.filter((tag) => draft.tagIds.includes(tag.id)));
	let clientName = (id: string) => workspace.referenceClients.find((client) => client.id === id)?.name ?? "Unknown client";
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
	let referredBy = $derived(draft.referredByMode === "client" && draft.referredByClientId ? clientName(draft.referredByClientId) : draft.referredByMode === "name" ? draft.referredByName : "");
	let preferredMethod = $derived(methods.find(([value]) => value === draft.preferredContactMethod)?.[1] ?? "");

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
		editing.add(section);
	}
	function cancel() {
		if (clientRecord) draft = clientDraft(clientRecord);
		editing.clear();
		failure = "";
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		failure = "";
		const body = clientSaveInput(draft, "");
		const payload = JSON.stringify(body);
		if (payload !== previousPayload) {
			requestId = crypto.randomUUID();
			previousPayload = payload;
		}
		pending = true;
		try {
			await saveClient({ ...body, requestId }).updates(remote);
			draft.revision += 1;
			editing.clear();
			saved();
		} catch {
			failure = "Client could not be saved. Check the fields; if the client changed elsewhere, refresh and reopen it. Your edits are retained.";
		} finally {
			pending = false;
		}
	}
</script>

{#snippet sectionHead(section: Section, title: string)}
	<div class="mb-2 flex min-h-8 items-center justify-between gap-3">
		<h3 id={`client-${section}`} class="font-display text-lg">{title}</h3>
		{#if !editing.has(section)}<button type="button" class="text-action" onclick={() => editing.add(section)}><Pencil size={13} aria-hidden="true" />Edit<span class="sr-only"> {title.toLowerCase()}</span></button>{/if}
	</div>
{/snippet}

{#snippet row(label: string, value: Snippet)}
	<div class="grid min-w-0 gap-x-4 py-1.5 @min-[26rem]/client:grid-cols-[8rem_minmax(0,1fr)]">
		<dt class="text-muted">{label}</dt>
		<dd class="min-w-0 wrap-anywhere">{@render value()}</dd>
	</div>
{/snippet}

{#snippet removeButton(label: string, onclick: () => void)}
	<button type="button" class="control" data-variant="ghost" data-size="sm" data-icon aria-label={label} title={label} {onclick}><X size={16} aria-hidden="true" /></button>
{/snippet}

{#snippet addButton(label: string, onclick: () => void, disabled = false)}
	<button type="button" class="text-action" {disabled} {onclick}><Plus size={14} aria-hidden="true" />{label}</button>
{/snippet}

<form onsubmit={submit} aria-label="Client" class="@container/client min-w-0 text-sm" aria-busy={pending}>
	<header class="pb-5">
		<h2 id="client-panel-heading" class="font-display text-3xl tracking-tight wrap-anywhere">{draft.name || "Client"}</h2>
		<p class="text-muted mt-1">{[others, since && `Client since ${since}`].filter(Boolean).join(" · ")}</p>
		{#if appliedTags.length || doNotContact}
			<div class="mt-3 flex flex-wrap gap-1.5">
				{#if doNotContact}<span class="chip" data-tone="urgent"><Ban size={12} aria-hidden="true" />Do not contact</span>{/if}
				{#each appliedTags as tag (tag.id)}<span class="chip" data-dot style:--dot={tag.color}>{tag.name}{tag.retiredAt ? " (retired)" : ""}</span>{/each}
			</div>
		{/if}
		{#if phone || email}
			<div class="mt-4 flex flex-wrap gap-2">
				{#if phone}
					{#if draft.consentCall}<a class="control" data-size="sm" href={`tel:${phone}`}><Phone size={15} aria-hidden="true" />Call</a>{:else}<button type="button" class="control" data-size="sm" disabled title="No consent to call"><Phone size={15} aria-hidden="true" />Call</button>{/if}
					{#if draft.consentText}<a class="control" data-size="sm" href={`sms:${phone}`}><MessageSquare size={15} aria-hidden="true" />Text</a>{:else}<button type="button" class="control" data-size="sm" disabled title="No consent to text"><MessageSquare size={15} aria-hidden="true" />Text</button>{/if}
				{/if}
				{#if email}
					{#if draft.consentEmail}<a class="control" data-size="sm" href={`mailto:${email}`}><Mail size={15} aria-hidden="true" />Email</a>{:else}<button type="button" class="control" data-size="sm" disabled title="No consent to email"><Mail size={15} aria-hidden="true" />Email</button>{/if}
				{/if}
			</div>
		{/if}
	</header>

	<fieldset disabled={pending} class="divide-hairline border-hairline min-w-0 divide-y border-t *:py-5">
		<section class="min-w-0" aria-labelledby="client-people">
			{@render sectionHead("people", draft.people.length > 1 ? "People" : "Contact")}
			{#if editing.has("people")}
				<div class="space-y-3">
					{#each draft.people as person, personIndex (person.id)}
						{@const n = personIndex + 1}
						<div class="work-row min-w-0 space-y-3 p-3" role="group" aria-label={person.name || `Person ${n}`}>
							<div class="flex items-end gap-2">
								<div class="grid min-w-0 flex-1 gap-3 @min-[26rem]/client:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
									<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium"><span class="sr-only">Person {n} </span>Name</span><input class="field" bind:value={person.name} maxlength="200" autocomplete="off" /></label>
									<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium"><span class="sr-only">Person {n} </span>Birthday</span><input class="field tabular-nums" type="date" bind:value={person.birthday} /></label>
								</div>
								<div class="flex min-h-11 items-center">{@render removeButton(`Remove person ${n}`, () => (draft.people = draft.people.filter((row) => row.id !== person.id)))}</div>
							</div>
							{#each person.phones as phoneRow, phoneIndex (phoneRow.id)}
								<div class="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
									<input class="field" aria-label={`Person ${n} phone ${phoneIndex + 1} label`} bind:value={phoneRow.label} placeholder="Mobile" maxlength="100" />
									<input class="field tabular-nums" aria-label={`Person ${n} phone ${phoneIndex + 1} number`} bind:value={phoneRow.value} type="tel" maxlength="200" placeholder="Phone" />
									{@render removeButton(`Remove person ${n} phone ${phoneIndex + 1}`, () => (person.phones = person.phones.filter((row) => row.id !== phoneRow.id)))}
								</div>
							{/each}
							{#each person.emails as emailRow, emailIndex (emailRow.id)}
								<div class="grid min-w-0 grid-cols-[minmax(0,2fr)_minmax(0,3fr)_auto] items-center gap-2">
									<input class="field" aria-label={`Person ${n} email ${emailIndex + 1} label`} bind:value={emailRow.label} placeholder="Personal" maxlength="100" />
									<input class="field" aria-label={`Person ${n} email ${emailIndex + 1} address`} bind:value={emailRow.value} type="email" maxlength="200" placeholder="Email" />
									{@render removeButton(`Remove person ${n} email ${emailIndex + 1}`, () => (person.emails = person.emails.filter((row) => row.id !== emailRow.id)))}
								</div>
							{/each}
							<div class="flex flex-wrap gap-x-4 gap-y-1">
								{@render addButton("Phone", () => person.phones.push({ id: crypto.randomUUID(), label: "", value: "" }))}
								{@render addButton("Email", () => person.emails.push({ id: crypto.randomUUID(), label: "", value: "" }))}
							</div>
						</div>
					{/each}
					{@render addButton("Add person", () => add("people"))}
				</div>
			{:else if draft.people.length}
				<ul class="space-y-3">
					{#each draft.people as person (person.id)}
						<li class="min-w-0">
							{#if draft.people.length > 1 || person.birthday}
								<p class="font-medium">
									{person.name || "Unnamed person"}{#if person.birthday}<span class="text-muted font-normal"> · Born {formatCalendarDate(person.birthday)}</span>{/if}
								</p>
							{/if}
							<ul class="mt-0.5 space-y-0.5">
								{#each person.phones.filter((row) => row.value) as phoneRow (phoneRow.id)}
									<li class="flex min-w-0 items-baseline gap-2">
										<a class="tabular-nums hover:underline" href={`tel:${phoneRow.value}`}>{formatPhone(phoneRow.value)}</a>{#if phoneRow.label}<span class="text-muted text-xs">{phoneRow.label}</span>{/if}
									</li>
								{/each}
								{#each person.emails.filter((row) => row.value) as emailRow (emailRow.id)}
									<li class="flex min-w-0 items-baseline gap-2">
										<a class="truncate hover:underline" href={`mailto:${emailRow.value}`}>{emailRow.value}</a>{#if emailRow.label}<span class="text-muted shrink-0 text-xs">{emailRow.label}</span>{/if}
									</li>
								{/each}
								{#if !person.phones.some((row) => row.value) && !person.emails.some((row) => row.value)}<li class="text-muted">No phone or email</li>{/if}
							</ul>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-muted">No people yet.</p>
			{/if}
		</section>

		{#if opportunities}<section class="min-w-0" aria-label="Opportunities">{@render opportunities()}</section>{/if}

		<section class="min-w-0" aria-labelledby="client-details">
			{@render sectionHead("details", "Details")}
			{#if editing.has("details")}
				<div class="space-y-3">
					<label class="block space-y-1.5"><span class="text-muted text-xs font-medium">Client name</span><input class="field" bind:value={draft.name} required maxlength="200" autocomplete="off" /></label>
					<div class="grid min-w-0 gap-3 @min-[26rem]/client:grid-cols-2">
						<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Lead source</span><Select bind:value={draft.leadSource} options={[{ value: "", label: "Not set" }, ...leadSourceChoices.map((source) => ({ value: source, label: source }))]} /></label>
						<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Preferred contact</span><Select bind:value={draft.preferredContactMethod} options={[{ value: "", label: "Not set" }, ...methods.map(([value, label]) => ({ value, label }))]} /></label>
						<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Referred by</span><Select bind:value={draft.referredByMode} options={referredByModes} /></label>
						{#if draft.referredByMode === "client"}
							<label class="block min-w-0 space-y-1.5"
								><span class="text-muted text-xs font-medium">Referring client</span><Select bind:value={draft.referredByClientId} required options={[{ value: "", label: "Choose a client" }, ...linkable.map((client) => ({ value: client.id, label: `${client.name}${client.archivedAt ? " (archived)" : ""}` }))]} /></label>
						{:else if draft.referredByMode === "name"}
							<label class="block min-w-0 space-y-1.5"><span class="text-muted text-xs font-medium">Referrer's name</span><input class="field" bind:value={draft.referredByName} required maxlength="200" placeholder="A lender or another agent" /></label>
						{/if}
					</div>
					<div role="group" aria-label="Tags" class="space-y-1.5">
						<p class="text-muted text-xs font-medium" aria-hidden="true">Tags</p>
						<div class="flex flex-wrap gap-2">
							{#each tagChoices as tag (tag.id)}
								{@const applied = draft.tagIds.includes(tag.id)}
								<button type="button" class="control" data-size="sm" aria-pressed={applied} onclick={() => (draft.tagIds = applied ? draft.tagIds.filter((id) => id !== tag.id) : [...draft.tagIds, tag.id])}>
									<span class="size-1.5 shrink-0 rounded-full" style:background={tag.color} aria-hidden="true"></span>{tag.name}{tag.retiredAt ? " (retired)" : ""}
								</button>
							{:else}<p class="text-muted">No tags yet.</p>{/each}
						</div>
					</div>
					<div role="group" aria-label="May contact by" class="space-y-1.5">
						<p class="text-muted text-xs font-medium" aria-hidden="true">May contact by</p>
						<div class="flex flex-wrap gap-2">
							{#each channels as [key, label] (key)}
								<button type="button" class="control" data-size="sm" aria-pressed={draft[key]} onclick={() => (draft[key] = !draft[key])}>{label}</button>
							{/each}
						</div>
						{#if doNotContact}<p class="text-urgent text-xs" role="status">Every channel is off, so this client is marked as not to be contacted.</p>{/if}
					</div>
					<label class="block space-y-1.5"><span class="text-muted text-xs font-medium">Preferences</span><textarea class="field" rows="2" bind:value={draft.preferences} maxlength="20000" placeholder="How to treat this client, including how to address them"></textarea></label>
				</div>
			{:else}
				<dl>
					{#snippet leadValue()}{draft.leadSource || "Not set"}{/snippet}
					{@render row("Lead source", leadValue)}
					{#if referredBy}{#snippet referredValue()}{referredBy}{/snippet}{@render row("Referred by", referredValue)}{/if}
					{#if preferredMethod}{#snippet methodValue()}{preferredMethod}{/snippet}{@render row("Prefers", methodValue)}{/if}
					{#snippet consentValue()}
						<span class="flex flex-wrap gap-1.5">
							{#each channels as [key, label] (key)}
								<span class={["inline-flex items-center gap-1", !draft[key] && "text-muted line-through"]}
									>{#if draft[key]}<Check size={13} class="text-success" aria-hidden="true" />{/if}{label}<span class="sr-only">{draft[key] ? " allowed" : " not allowed"}</span></span>
							{/each}
						</span>
					{/snippet}
					{@render row("May contact by", consentValue)}
					{#if draft.preferences}{#snippet preferencesValue()}<span class="whitespace-pre-wrap">{draft.preferences}</span>{/snippet}{@render row("Preferences", preferencesValue)}{/if}
				</dl>
			{/if}
		</section>

		{#if draft.addresses.length || editing.has("addresses")}
			<section class="min-w-0" aria-labelledby="client-addresses">
				{@render sectionHead("addresses", draft.addresses.length === 1 ? "Address" : "Addresses")}
				{#if editing.has("addresses")}
					<div class="space-y-3">
						{#each draft.addresses as address, index (address.id)}
							<div class="work-row min-w-0 space-y-2 p-3" role="group" aria-label={`Address ${index + 1}`}>
								<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @min-[26rem]/client:grid-cols-[minmax(0,1fr)_minmax(0,2.5fr)_auto]">
									<input class="field @max-[26rem]/client:col-span-full" aria-label={`Address ${index + 1} label`} bind:value={address.label} placeholder="Home" maxlength="100" />
									<input class="field" aria-label={`Address ${index + 1}`} bind:value={address.address} maxlength="1000" autocomplete="off" placeholder="Street, city, state, zip" />
									{@render removeButton(`Remove address ${index + 1}`, () => (draft.addresses = draft.addresses.filter((row) => row.id !== address.id)))}
								</div>
								<label class="flex min-h-9 items-center gap-3"><input class="check" type="checkbox" bind:checked={address.owned} /><span>The client owns this property</span></label>
							</div>
						{/each}
						{@render addButton("Add address", () => add("addresses"))}
					</div>
				{:else}
					<ul class="space-y-1.5">
						{#each draft.addresses as address (address.id)}
							<li class="flex min-w-0 items-baseline gap-2"><span class="min-w-0 wrap-anywhere">{address.address}</span><span class="text-muted shrink-0 text-xs">{[address.label, address.owned && "Owned"].filter(Boolean).join(" · ")}</span></li>
						{/each}
					</ul>
				{/if}
			</section>
		{/if}

		{#if draft.relationships.length || draft.keyDates.length || editing.has("relationships") || editing.has("keyDates")}
			<section class="min-w-0 space-y-4" aria-label="Relationships and key dates">
				{#if draft.relationships.length || editing.has("relationships")}
					<div>
						{@render sectionHead("relationships", "Relationships")}
						{#if editing.has("relationships")}
							<div class="space-y-2">
								{#each draft.relationships as relationship, index (relationship.id)}
									<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2 @min-[26rem]/client:grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto]">
										<Select class="@max-[26rem]/client:col-span-full" label={`Relationship ${index + 1} client`} bind:value={relationship.relatedClientId} required options={[{ value: "", label: "Choose a client" }, ...relatable().map((client) => ({ value: client.id, label: client.name }))]} />
										<input class="field" aria-label={`Relationship ${index + 1} label`} bind:value={relationship.label} placeholder="Parent, sibling, colleague" maxlength="100" required />
										{@render removeButton(`Remove relationship ${index + 1}`, () => (draft.relationships = draft.relationships.filter((row) => row.id !== relationship.id)))}
									</div>
								{/each}
								{@render addButton("Add relationship", () => add("relationships"), !workspace.referenceClients.length)}
							</div>
						{:else}
							<dl>
								{#each draft.relationships as relationship (relationship.id)}
									{#snippet relatedValue()}{clientName(relationship.relatedClientId)}{/snippet}
									{@render row(relationship.label || "Related", relatedValue)}
								{/each}
							</dl>
						{/if}
					</div>
				{/if}
				{#if draft.keyDates.length || editing.has("keyDates")}
					<div>
						{@render sectionHead("keyDates", "Key dates")}
						{#if editing.has("keyDates")}
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
						{:else}
							<dl>
								{#each draft.keyDates as keyDate (keyDate.id)}
									{#snippet dateValue()}<span class="tabular-nums">{keyDate.date ? formatCalendarDate(keyDate.date) : "No date"}</span>{/snippet}
									{@render row(keyDate.name || "Key date", dateValue)}
								{/each}
							</dl>
						{/if}
					</div>
				{/if}
			</section>
		{/if}

		{#if draft.notes || editing.has("notes")}
			<section class="min-w-0" aria-labelledby="client-notes">
				{@render sectionHead("notes", "Notes")}
				{#if editing.has("notes")}
					<label class="block"><span class="sr-only">Notes</span><textarea class="field" rows="6" bind:value={draft.notes} maxlength="20000"></textarea></label>
				{:else}
					<p class={["wrap-anywhere whitespace-pre-wrap", !notesExpanded && "line-clamp-4"]}>{draft.notes}</p>
					{#if draft.notes.length > 240 || draft.notes.split("\n").length > 4}<button type="button" class="text-action mt-1" onclick={() => (notesExpanded = !notesExpanded)}>{notesExpanded ? "Show less" : "Show more"}</button>{/if}
				{/if}
			</section>
		{/if}

		<!-- Empty sections stay out of the way until someone adds to them. -->
		{#if !draft.addresses.length || !draft.relationships.length || !draft.keyDates.length || !draft.notes}
			{@const missing = [
				!draft.addresses.length && !editing.has("addresses") && (["addresses", "Address"] as const),
				!draft.relationships.length && !editing.has("relationships") && workspace.referenceClients.length > 1 && (["relationships", "Relationship"] as const),
				!draft.keyDates.length && !editing.has("keyDates") && (["keyDates", "Key date"] as const),
				!draft.notes && !editing.has("notes") && (["notes", "Note"] as const),
			].filter((item) => item !== false)}
			{#if missing.length}
				<div class="flex flex-wrap gap-x-4 gap-y-1">
					{#each missing as [section, label] (section)}{@render addButton(label, () => add(section))}{/each}
				</div>
			{/if}
		{/if}

		{#if clientRecord?.importedData.length}
			<details class="min-w-0">
				<summary class="text-muted cursor-pointer">Imported data <span class="font-normal">· {clientRecord.importedData.length} fields from the previous CRM, read-only</span></summary>
				<dl class="mt-2 text-xs">
					{#each clientRecord.importedData as item (item.label)}
						{#snippet importedValue()}<span class="whitespace-pre-wrap">{item.value}</span>{/snippet}
						{@render row(item.label, importedValue)}
					{/each}
				</dl>
			</details>
		{/if}
	</fieldset>

	{#if editing.size}
		<!-- The save bar stays in reach while sections are open; its negative margins match the panel's gutters. -->
		<div class="bg-canvas/95 border-hairline sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
			<button class="control" data-variant="primary" data-size="sm" disabled={pending} aria-busy={pending}>{pending ? "Saving…" : "Save changes"}</button>
			<button type="button" class="control" data-variant="ghost" data-size="sm" disabled={pending} onclick={cancel}>Cancel</button>
			{#if failure}<p class="text-urgent min-w-0 flex-1 text-xs" role="alert">{failure}</p>{/if}
		</div>
	{/if}
</form>
