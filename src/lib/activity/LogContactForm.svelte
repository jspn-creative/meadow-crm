<script lang="ts">
	import { untrack, type Component } from "svelte";
	import { Ban, Check, Mail, Megaphone, MessageSquare, Phone, Users } from "@lucide/svelte";
	import { stageLabels, stageTones, timelineLabels, typeLabels, typeStyles } from "#lib/pipeline/labels.js";
	import { formatPhone, preferenceItems } from "#lib/registry/format.js";
	import type { ClientFacts } from "./client-facts.js";
	import { channelNoun, outcomeLabels } from "./describe.js";
	import { activityDates } from "./feed.js";
	import type { ActivityOpportunity, Channel, ContactEntry, Direction, Outcome } from "./types.js";

	type LogChannel = Exclude<Channel, "zillow">;
	type OpenOpportunity = ActivityOpportunity & { stage: keyof typeof stageLabels; timeline: keyof typeof timelineLabels | null; address: string | null; budgetCents: number | null };
	type OpportunityType = ActivityOpportunity["type"];

	let {
		client,
		clients,
		opportunities,
		timeZone,
		userId,
		channel: initialChannel = "call",
		creatable = false,
		about: subject,
		onlog,
		oncancel,
	}: {
		/** The name the client, or an opportunity's clients, go by in sentences. */
		client: string;
		/** Whom the contact was with, with the key details shown beside the form. */
		clients: ClientFacts[];
		/** The client's open opportunities; with any, the form asks which of them the contact covered. */
		opportunities: OpenOpportunity[];
		timeZone: string;
		userId: string;
		/** The channel to open on, such as Call after the user tapped the client's number. */
		channel?: LogChannel;
		/** Offer a new opportunity among the answers to "What was this about?", created with the contact as a New lead. */
		creatable?: boolean;
		/** Logged from an opportunity: the contact is about it, so the form asks nothing and shows its key details. */
		about?: OpenOpportunity;
		/** Saves the contact, about the given opportunities; resolves false when it failed, which keeps the form as it was. */
		onlog: (entry: ContactEntry, about: ActivityOpportunity[], created?: { id: string; type: OpportunityType; title: string }) => Promise<boolean>;
		oncancel: () => void;
	} = $props();

	const uid = $props.id();
	const channels: { value: LogChannel; label: string; icon: Component }[] = [
		{ value: "call", label: "Call", icon: Phone },
		{ value: "text", label: "Text", icon: MessageSquare },
		{ value: "email", label: "Email", icon: Mail },
		{ value: "meeting", label: "Meeting", icon: Users },
		{ value: "other", label: "Other", icon: Megaphone },
	];
	const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
	let dates = $derived(activityDates(timeZone));

	// The only open opportunity is preselected, and with none the contact is about the client in general; with several, the user has to say which ones, or that it was about none of them.
	let about = $state<string[]>(untrack(() => (opportunities.length === 1 ? [opportunities[0]!.id] : [])));
	let general = $state(untrack(() => !opportunities.length));
	// A new opportunity needs only its type and title here; the rest is filled in on the opportunity.
	let creating = $state(false);
	let newType = $state<OpportunityType>("buyer");
	let newTitle = $state("");
	const newId = crypto.randomUUID();
	// One ID per opening, so logging again after a failure retries the same contact rather than adding a second.
	const entryId = crypto.randomUUID();
	let logging = $state(false);
	let channel = $state<LogChannel>(untrack(() => initialChannel));
	let label = $state("");
	let direction = $state<Direction>("outgoing");
	let outcome = $state<Outcome>("talked");
	let bounced = $state(false);
	let when = $state(localNow());
	let note = $state("");

	function localNow() {
		const now = new Date();
		return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
	}

	let outcomes = $derived<Outcome[]>(channel === "call" ? ["talked", "voicemail", "no-answer", "wrong-number"] : channel === "meeting" ? ["met", "no-show"] : []);
	let canBounce = $derived((channel === "text" || channel === "email") && direction === "outgoing");
	const names = (list: ClientFacts[]) =>
		list.length < 2
			? (list[0]?.name ?? "")
			: `${list
					.slice(0, -1)
					.map((row) => row.name)
					.join(", ")} and ${list.at(-1)!.name}`;
	let selected = $derived(subject ? [subject] : opportunities.filter((opportunity) => about.includes(opportunity.id)));
	let asked = $derived(!subject && (opportunities.length > 0 || creatable));
	let answered = $derived(!asked || general || about.length > 0 || creating);
	// A meeting has no direction: both sides were there.
	let directed = $derived(channel !== "meeting");
	let incoming = $derived(directed && direction === "incoming");
	let withoutConsent = $derived.by(() => {
		const reached = channel;
		return !incoming && (reached === "call" || reached === "text" || reached === "email") ? clients.filter((row) => !row.consent[reached]) : [];
	});
	let notePrompt = $derived(channel === "call" || channel === "meeting" ? "What was said, and what happens next" : incoming ? `What ${client} wrote` : channel === "other" ? "What happened" : "What you sent");
	let submitLabel = $derived(channel === "other" ? "Log contact" : `Log ${channel}`);

	function choose(next: LogChannel) {
		channel = next;
		settle();
	}
	// Keep the chosen outcome among the ones this channel and direction offer.
	function settle() {
		if (!outcomes.includes(outcome)) outcome = outcomes[0] ?? "talked";
		if (!canBounce) bounced = false;
	}
	async function submit(event: SubmitEvent) {
		event.preventDefault();
		if (!answered || logging) return;
		const created = creating ? { id: newId, type: newType, title: newTitle.trim() } : undefined;
		const about = [...selected.map(({ id, title, type }) => ({ id, title, type })), ...(created ? [created] : [])];
		const ids = about.map((opportunity) => opportunity.id);
		logging = true;
		await onlog(
			{
				id: entryId,
				kind: "contact",
				at: new Date(when).toISOString(),
				actor: incoming ? { kind: "client" } : { kind: "user", userId },
				loggedBy: incoming ? userId : undefined,
				opportunityIds: ids.length ? ids : undefined,
				channel,
				channelLabel: channel === "other" ? label.trim() : undefined,
				direction: incoming ? "incoming" : "outgoing",
				outcome: outcomes.length ? outcome : bounced ? "bounced" : undefined,
				note: note.trim() || undefined,
			},
			about,
			created,
		);
		logging = false;
	}
	const recap = (entry: ContactEntry) => `${dates.short(entry.at)} · ${channelNoun(entry)}${entry.outcome ? `, ${outcomeLabels[entry.outcome].toLowerCase()}` : ""}`;
</script>

{#snippet fact(term: string, value: string)}
	<div class="contents">
		<dt class="text-muted">{term}</dt>
		<dd class="min-w-0 wrap-anywhere">{value}</dd>
	</div>
{/snippet}

<div class="@container/log min-w-0 text-sm">
	<div class="grid gap-5 @min-[44rem]/log:grid-cols-[minmax(0,1fr)_19rem] @min-[44rem]/log:gap-7">
		<form class="@container/contact-fields min-w-0 space-y-5" aria-label="Log contact" onsubmit={submit}>
			{#if asked}
				<fieldset class="grid min-w-0 gap-1.5">
					<legend class="field-label mb-label">What was this about?</legend>
					{#each opportunities as opportunity (opportunity.id)}
						<label class="choice py-2">
							<input class="check" type="checkbox" value={opportunity.id} bind:group={about} onchange={() => (general = false)} />
							<span class="item-title min-w-0 flex-1 truncate">{opportunity.title}</span>
							<span class="chip shrink-0" data-tone={stageTones[opportunity.stage]}>{stageLabels[opportunity.stage]}</span>
						</label>
					{/each}
					{#if creatable}
						<!-- Contact is often how an opportunity starts, so one can begin here; its type and title are all it needs to exist. -->
						<div class="grid min-w-0">
							<label class={["choice py-2", creating && "rounded-b-none"]}>
								<input
									class="check"
									type="checkbox"
									bind:checked={creating}
									onchange={() => {
										if (creating) general = false;
									}} />
								<span class="min-w-0 flex-1"><span class="item-title">New opportunity</span><span class="text-muted">{" · "}starts as a New lead</span></span>
							</label>
							{#if creating}
								<div class="border-field grid min-w-0 gap-3 rounded-b-xl border border-t-0 bg-white p-3">
									<div class="segmented grid grid-cols-2 @min-[30rem]/contact-fields:grid-cols-4" role="radiogroup" aria-label="Opportunity type">
										{#each Object.entries(typeLabels) as [value, text] (value)}
											{@const Icon = typeStyles[value as OpportunityType].icon}
											<label><input type="radio" name={`${uid}-type`} {value} bind:group={newType} /><Icon size={14} aria-hidden="true" />{text}</label>
										{/each}
									</div>
									<input class="field" aria-label="Opportunity title" bind:value={newTitle} required maxlength="200" placeholder="What should we call this opportunity?" {@attach (node) => node.focus()} />
								</div>
							{/if}
						</div>
					{/if}
					<label class="choice py-2">
						<input
							class="check"
							type="checkbox"
							bind:checked={general}
							onchange={() => {
								if (general) {
									about = [];
									creating = false;
								}
							}} />
						<span class="min-w-0 flex-1"><span class="item-title">No opportunity</span><span class="text-muted">{" · "}about {client} in general</span></span>
					</label>
				</fieldset>
			{/if}

			<fieldset class="min-w-0">
				<legend class="field-label mb-label">Channel</legend>
				<!-- Five equal columns, so no channel wraps onto a row of its own; the icon sits over its label until there is room beside it. -->
				<div class="segmented grid grid-cols-5">
					{#each channels as option (option.value)}
						<label class="flex-col gap-1 px-1 text-xs @min-[34rem]/contact-fields:flex-row @min-[34rem]/contact-fields:gap-2 @min-[34rem]/contact-fields:text-sm"
							><input type="radio" name={`${uid}-channel`} value={option.value} checked={channel === option.value} onchange={() => choose(option.value)} /><option.icon size={14} aria-hidden="true" />{option.label}</label>
					{/each}
				</div>
				{#if channel === "other"}
					<!-- Other's label belongs to the channel choice, so it sits directly under it and carries its icon. -->
					<div class="field-group mt-1.5 gap-0">
						<span class="field-addon"><Megaphone size={13} aria-hidden="true" /></span>
						<input class="field-bare" aria-label="What kind of contact" bind:value={label} required maxlength="40" placeholder="What kind? Open house, mailed card…" {@attach (node) => node.focus()} />
					</div>
				{/if}
			</fieldset>

			<div class={["grid min-w-0 gap-4", directed && "@min-[26rem]/contact-fields:grid-cols-2"]}>
				{#if directed}
					<fieldset class="min-w-0">
						<legend class="field-label mb-label">Direction</legend>
						<div class="segmented">
							<label><input type="radio" name={`${uid}-direction`} value="outgoing" bind:group={direction} onchange={() => (bounced = false)} />Outgoing</label>
							<label><input type="radio" name={`${uid}-direction`} value="incoming" bind:group={direction} onchange={() => (bounced = false)} />Incoming</label>
						</div>
					</fieldset>
				{/if}
				<div class="labeled"><label for={`${uid}-when`} class="field-label">When</label><input id={`${uid}-when`} class="field tabular-nums" type="datetime-local" bind:value={when} required /></div>
			</div>

			{#if outcomes.length}
				<fieldset class="min-w-0">
					<legend class="field-label mb-label">Outcome</legend>
					<div class="segmented">
						{#each outcomes as option (option)}
							<label class="basis-[calc(50%-var(--spacing))] @min-[30rem]/contact-fields:basis-0"><input type="radio" name={`${uid}-outcome`} value={option} bind:group={outcome} />{outcomeLabels[option]}</label>
						{/each}
					</div>
				</fieldset>
			{:else if canBounce}
				<label class="flex min-h-9 items-center gap-3"><input class="check" type="checkbox" bind:checked={bounced} /><span>It bounced, so it never reached {client}</span></label>
			{/if}

			{#if withoutConsent.length}
				<p class="bg-urgent-soft text-urgent flex items-start gap-2 rounded-xl px-3 py-2 text-xs" role="status">
					<Ban size={13} class="mt-px shrink-0" aria-hidden="true" />Consent is off for {channel === "call" ? "calls" : channel === "text" ? "texts" : "email"} to {clients.length === 1 ? client : names(withoutConsent)}. Log it if it happened, and check Consent before the next one.
				</p>
			{/if}

			<div class="labeled">
				<label for={`${uid}-note`} class="field-label">Note <span class="font-normal">· optional</span></label>
				<textarea id={`${uid}-note`} class="field block field-sizing-content max-h-[30dvh] min-h-20 resize-y leading-[1.4]" bind:value={note} maxlength="20000" placeholder={notePrompt}></textarea>
			</div>

			<div class="flex flex-wrap gap-2">
				<button class="control" data-variant="primary" disabled={!answered || logging} aria-busy={logging} title={answered ? undefined : "Choose what this was about first"}>{logging ? "Logging…" : submitLabel}</button>
				<button type="button" class="control" data-variant="ghost" disabled={logging} onclick={oncancel}>Cancel</button>
			</div>
		</form>

		<!-- Context follows the form on narrow layouts; its facts stay available at every width. -->
		<aside class="grid min-w-0 content-start gap-3" aria-label="Key details">
			{#each selected as opportunity (opportunity.id)}
				{@const look = typeStyles[opportunity.type]}
				<section class="surface min-w-0 p-4" data-tone={look.tone}>
					<p class="flex items-center gap-1.5 text-xs leading-none font-medium text-(--action-color)"><look.icon size={12} aria-hidden="true" />{typeLabels[opportunity.type]} opportunity</p>
					<p class="font-display mt-2 text-base/tight wrap-anywhere">{opportunity.title}</p>
					<dl class="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs leading-[1.4]">
						{@render fact("Stage", stageLabels[opportunity.stage])}
						{@render fact("Timeline", opportunity.timeline ? timelineLabels[opportunity.timeline] : "Not set")}
						{@render fact("Budget", opportunity.budgetCents == null ? "Not set" : money.format(opportunity.budgetCents / 100))}
						{#if opportunity.address}{@render fact("Property", opportunity.address)}{/if}
					</dl>
				</section>
			{/each}
			{#if creating}
				{@const look = typeStyles[newType]}
				<section class="surface min-w-0 p-4" data-tone={look.tone}>
					<p class="flex items-center gap-1.5 text-xs leading-none font-medium text-(--action-color)"><look.icon size={12} aria-hidden="true" />New {typeLabels[newType]} opportunity</p>
					<p class={["font-display mt-2 text-base/tight wrap-anywhere", !newTitle.trim() && "text-muted"]}>{newTitle.trim() || "Untitled"}</p>
					<p class="text-muted mt-3 text-xs leading-[1.4]">Created with this contact as a New lead, with {names(clients)} as its client. Add its timeline, budget, and property on the opportunity.</p>
				</section>
			{/if}
			{#each clients as facts (facts.id)}
				{@const preferences = preferenceItems(facts.preferences)}
				<section class="work-row min-w-0 p-4">
					<p class="text-muted text-xs leading-none font-medium">Client</p>
					<p class="font-display mt-2 text-base/tight wrap-anywhere">{facts.name}</p>
					<dl class="mt-3 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-xs leading-[1.4]">
						{#if facts.phone}{@render fact("Phone", formatPhone(facts.phone))}{/if}
						{#if facts.email}{@render fact("Email", facts.email)}{/if}
						{#if facts.prefers}{@render fact("Prefers", facts.prefers)}{/if}
						<div class="contents">
							<dt class="text-muted">Consent</dt>
							<dd class="flex flex-wrap gap-x-2.5 gap-y-1">
								{#each ["call", "text", "email", "mail"] as const as key (key)}
									<span class={["inline-flex items-center gap-0.5 capitalize", !facts.consent[key] && "text-muted line-through"]}
										>{#if facts.consent[key]}<Check size={11} class="text-success" aria-hidden="true" />{/if}{key}<span class="sr-only">{facts.consent[key] ? " allowed" : " not allowed"}</span></span>
								{/each}
							</dd>
						</div>
						{#if facts.contact}
							{@const { lastContacted, latestAttempt } = facts.contact}
							{@render fact("Last contacted", lastContacted ? recap(lastContacted) : "Never")}
							{#if latestAttempt?.id !== lastContacted?.id}{@render fact("Latest attempt", latestAttempt ? recap(latestAttempt) : "None yet")}{/if}
						{/if}
					</dl>
					{#if preferences.length}
						<ul class="border-hairline text-muted mt-3 list-disc space-y-1.5 border-t pt-3 pl-4 text-xs leading-[1.4]">
							{#each preferences as item}<li>{item}</li>{/each}
						</ul>
					{/if}
				</section>
			{/each}
		</aside>
	</div>
</div>
