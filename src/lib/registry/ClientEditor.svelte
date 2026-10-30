<script lang="ts">
	import { saveClient } from "#lib/crm.remote.js";
	import type { Workspace } from "#lib/data/workspace.js";
	import { notToBeContacted } from "#lib/data/consent.js";
	import Select from "#lib/ui/Select.svelte";
	import { clientSaveInput, leadSources, type ClientDraft } from "./client-draft.js";
	let {
		draft = $bindable(),
		workspace,
		remote,
		saved,
		pending = $bindable(false),
	}: {
		draft: ClientDraft;
		workspace: Workspace;
		remote: ReturnType<typeof import("#lib/crm.remote.js").getWorkspace>;
		saved: () => void;
		pending?: boolean;
	} = $props();
	let failure = $state("");
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
	function relatable() {
		return workspace.referenceClients.filter((client) => client.id !== draft.id && (!client.archivedAt || draft.relationships.some((row) => row.relatedClientId === client.id)));
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
			saved();
		} catch {
			failure = "Client could not be saved. Check the fields; if the client changed elsewhere, refresh and reopen it. Your draft is retained.";
		} finally {
			pending = false;
		}
	}
</script>

<form onsubmit={submit} aria-label="Client editor" class="@container/client min-w-0 space-y-8" aria-busy={pending}>
	<fieldset disabled={pending} class="min-w-0 space-y-8">
		<section class="min-w-0 space-y-4" aria-labelledby="client-basics">
			<h3 id="client-basics" class="font-display text-2xl">Client</h3>
			<label class="block space-y-2"><span class="font-medium">Client name</span><input class="field" bind:value={draft.name} required maxlength="200" autocomplete="off" /></label>
			<div class="grid min-w-0 gap-4 @min-[28rem]/client:grid-cols-2">
				<label class="block min-w-0 space-y-2"><span class="font-medium">Lead source</span><Select label="Lead source" bind:value={draft.leadSource} options={[{ value: "", label: "Not set" }, ...leadSourceChoices.map((source) => ({ value: source, label: source }))]} /></label>
				<label class="block min-w-0 space-y-2"><span class="font-medium">Preferred contact method</span><Select label="Preferred contact method" bind:value={draft.preferredContactMethod} options={[{ value: "", label: "Not set" }, ...methods.map(([value, label]) => ({ value, label }))]} /></label>
			</div>
			<div class="grid min-w-0 gap-4 @min-[28rem]/client:grid-cols-2">
				<label class="block min-w-0 space-y-2"><span class="font-medium">Referred by</span><Select label="Referred by" bind:value={draft.referredByMode} options={referredByModes} /></label>
				{#if draft.referredByMode === "client"}
					<label class="block min-w-0 space-y-2"
						><span class="font-medium">Referring client</span><Select label="Referring client" bind:value={draft.referredByClientId} required options={[{ value: "", label: "Choose a client" }, ...linkable.map((client) => ({ value: client.id, label: `${client.name}${client.archivedAt ? " (archived)" : ""}` }))]} /></label>
				{:else if draft.referredByMode === "name"}
					<label class="block min-w-0 space-y-2"><span class="font-medium">Referrer's name</span><input class="field" bind:value={draft.referredByName} required maxlength="200" placeholder="A lender or another agent" /></label>
				{/if}
			</div>
			<label class="block space-y-2"><span class="font-medium">Preferences</span><textarea class="field" rows="3" bind:value={draft.preferences} maxlength="20000" placeholder="How to treat this client, including how to address them"></textarea></label>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-people">
			<h3 id="client-people" class="font-display text-2xl">People</h3>
			{#each draft.people as person, personIndex (person.id)}
				<div class="border-hairline min-w-0 space-y-4 border-b pb-6">
					<div class="grid min-w-0 gap-4 @min-[28rem]/client:grid-cols-2">
						<label class="block min-w-0 space-y-2"><span class="font-medium">Person {personIndex + 1} name</span><input class="field" bind:value={person.name} maxlength="200" autocomplete="off" /></label>
						<label class="block min-w-0 space-y-2"><span class="font-medium">Person {personIndex + 1} birthday</span><input class="field tabular-nums" type="date" bind:value={person.birthday} /></label>
					</div>
					<div class="space-y-3">
						<p class="font-medium">Phone numbers</p>
						{#each person.phones as phone, phoneIndex (phone.id)}
							<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
								<input class="field" aria-label={`Person ${personIndex + 1} phone ${phoneIndex + 1} label`} bind:value={phone.label} placeholder="Mobile" maxlength="100" />
								<input class="field tabular-nums" aria-label={`Person ${personIndex + 1} phone ${phoneIndex + 1} number`} bind:value={phone.value} type="tel" maxlength="200" />
								<button type="button" class="control" onclick={() => (person.phones = person.phones.filter((row) => row.id !== phone.id))}>Remove phone {phoneIndex + 1}</button>
							</div>
						{/each}
						<button type="button" class="control" onclick={() => person.phones.push({ id: crypto.randomUUID(), label: "", value: "" })}>Add phone</button>
					</div>
					<div class="space-y-3">
						<p class="font-medium">Email addresses</p>
						{#each person.emails as email, emailIndex (email.id)}
							<div class="grid min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_auto] gap-2">
								<input class="field" aria-label={`Person ${personIndex + 1} email ${emailIndex + 1} label`} bind:value={email.label} placeholder="Work" maxlength="100" />
								<input class="field" aria-label={`Person ${personIndex + 1} email ${emailIndex + 1} address`} bind:value={email.value} type="email" maxlength="200" />
								<button type="button" class="control" onclick={() => (person.emails = person.emails.filter((row) => row.id !== email.id))}>Remove email {emailIndex + 1}</button>
							</div>
						{/each}
						<button type="button" class="control" onclick={() => person.emails.push({ id: crypto.randomUUID(), label: "", value: "" })}>Add email</button>
					</div>
					<button type="button" class="control" onclick={() => (draft.people = draft.people.filter((row) => row.id !== person.id))}>Remove person {personIndex + 1}</button>
				</div>
			{:else}<p class="text-muted">No people yet.</p>{/each}
			<button type="button" class="control" onclick={() => draft.people.push({ id: crypto.randomUUID(), name: "", birthday: "", phones: [], emails: [] })}>Add person</button>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-addresses">
			<h3 id="client-addresses" class="font-display text-2xl">Addresses</h3>
			{#each draft.addresses as address, index (address.id)}
				<div class="border-hairline min-w-0 space-y-3 border-b pb-4">
					<div class="grid min-w-0 gap-4 @min-[28rem]/client:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
						<label class="block min-w-0 space-y-2"><span class="font-medium">Address {index + 1} label</span><input class="field" bind:value={address.label} placeholder="Home" maxlength="100" /></label>
						<label class="block min-w-0 space-y-2"><span class="font-medium">Address {index + 1}</span><input class="field" bind:value={address.address} maxlength="1000" autocomplete="off" /></label>
					</div>
					<label class="flex min-h-11 items-center gap-3"><input class="check" type="checkbox" bind:checked={address.owned} /><span>The client owns this property</span></label>
					<button type="button" class="control" onclick={() => (draft.addresses = draft.addresses.filter((row) => row.id !== address.id))}>Remove address {index + 1}</button>
				</div>
			{:else}<p class="text-muted">No addresses yet.</p>{/each}
			<button type="button" class="control" onclick={() => draft.addresses.push({ id: crypto.randomUUID(), label: "", address: "", owned: false })}>Add address</button>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-relationships">
			<h3 id="client-relationships" class="font-display text-2xl">Relationships</h3>
			{#each draft.relationships as relationship, index (relationship.id)}
				<div class="grid min-w-0 gap-2 @min-[28rem]/client:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
					<Select label={`Relationship ${index + 1} client`} bind:value={relationship.relatedClientId} required options={[{ value: "", label: "Choose a client" }, ...relatable().map((client) => ({ value: client.id, label: client.name }))]} />
					<input class="field" aria-label={`Relationship ${index + 1} label`} bind:value={relationship.label} placeholder="Parent, sibling, colleague" maxlength="100" required />
					<button type="button" class="control" onclick={() => (draft.relationships = draft.relationships.filter((row) => row.id !== relationship.id))}>Remove relationship {index + 1}</button>
				</div>
			{:else}<p class="text-muted">No relationships yet.</p>{/each}
			<button type="button" class="control" disabled={!workspace.referenceClients.length} onclick={() => draft.relationships.push({ id: crypto.randomUUID(), relatedClientId: "", label: "" })}>Add relationship</button>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-key-dates">
			<h3 id="client-key-dates" class="font-display text-2xl">Key dates</h3>
			{#each draft.keyDates as keyDate, index (keyDate.id)}
				<div class="grid min-w-0 gap-2 @min-[28rem]/client:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto]">
					<input class="field" aria-label={`Key date ${index + 1} name`} bind:value={keyDate.name} placeholder="Wedding anniversary" maxlength="100" />
					<input class="field tabular-nums" aria-label={`Key date ${index + 1} date`} type="date" bind:value={keyDate.date} />
					<button type="button" class="control" onclick={() => (draft.keyDates = draft.keyDates.filter((row) => row.id !== keyDate.id))}>Remove key date {index + 1}</button>
				</div>
			{:else}<p class="text-muted">No key dates yet.</p>{/each}
			<button type="button" class="control" onclick={() => draft.keyDates.push({ id: crypto.randomUUID(), name: "", date: "" })}>Add key date</button>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-consent">
			<h3 id="client-consent" class="font-display text-2xl">Consent</h3>
			<fieldset class="min-w-0">
				<legend class="mb-2 font-medium">May contact by</legend>
				<div class="grid min-w-0 gap-2 @min-[28rem]/client:grid-cols-2">
					{#each channels as [key, label] (key)}
						<label class="flex min-h-11 items-center gap-3"><input class="check" type="checkbox" bind:checked={draft[key]} /><span>{label}</span></label>
					{/each}
				</div>
			</fieldset>
			{#if notToBeContacted(draft)}<p class="text-urgent" role="status">Every channel is off, so this client is marked as not to be contacted.</p>{/if}
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-tags">
			<h3 id="client-tags" class="font-display text-2xl">Tags</h3>
			<fieldset class="min-w-0">
				<legend class="mb-2 font-medium">Where this client stands</legend>
				<div class="surface grid min-w-0 gap-1 p-2 @min-[28rem]/client:grid-cols-2">
					{#each tagChoices as tag (tag.id)}
						<label class="flex min-h-11 min-w-0 items-center gap-3 px-2"><input class="check" type="checkbox" value={tag.id} bind:group={draft.tagIds} /><span class="min-w-0 wrap-anywhere">{tag.name}{tag.retiredAt ? " (retired)" : ""}</span></label>
					{:else}<p class="text-muted p-2">No tags yet.</p>{/each}
				</div>
			</fieldset>
		</section>

		<section class="min-w-0 space-y-4" aria-labelledby="client-notes">
			<h3 id="client-notes" class="font-display text-2xl">Notes</h3>
			<label class="block space-y-2"><span class="sr-only">Notes</span><textarea class="field" rows="5" bind:value={draft.notes} maxlength="20000"></textarea></label>
		</section>
	</fieldset>
	{#if failure}<p class="text-urgent" role="alert">{failure}</p>{/if}
	<div class="flex flex-wrap gap-2"><button class="control" data-variant="primary" disabled={pending}>{pending ? "Saving…" : "Save client"}</button></div>
</form>
