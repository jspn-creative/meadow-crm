# Phone module — research brief

**Status:** not specified, not started. This file is the research agenda, not a plan. Nothing here is a decision, and no provider, number, or feature has been chosen.

The phone is Milestone 2 in [SPEC.md](../SPEC.md). It gets its own milestone because it is the first module that would create records the user did not type, and because it drags in a provider, a phone number, call states, and recording law — each of which is a decision that is expensive to undo.

## Research agenda

**Purpose.** Which of these are actually wanted, in rough order of value: logging calls against a record, click-to-call from the CRM, recording, transcription and summaries, caller ID, call routing and transfer, voicemail handling, after-hours or missed-call follow-up, bulk calling lists.

**Numbers and providers.** Whether the business has a number worth keeping today, and what each route costs and commits to: keep the current cellular number and log only, add a softphone that dials the existing number, adopt a hosted number, or move to a VoIP provider. Cover setup effort, per-minute and per-seat pricing, provider outage and call-drop behavior, number portability on leaving, and reputation filtering and spam.

**Recording and the law.** Whether the business's state requires both parties to consent to recording, how disclosure is delivered, retention limits, and who may listen to a recording. Determine this before designing anything with recording in it, not after.

**Data model.** Whether a call is its own record or an activity on a client or opportunity. How one call involving two clients is stored. Whether a call can create or advance an opportunity, and what happens to a missed unknown number. Whether a call is linked to a checklist item or generates one.

**Pipeline behavior.** Where a call-created lead enters the board, whether it enters at all without review, and how calling relates to the checklists in [checklists.md](../checklists.md).

**Interface.** Where calling lives: a dialer panel, a call button on the client and opportunity, a call log view, or a call history on the record. How notes are captured during and after a call, and how a call's outcome is recorded without stopping to type during the conversation.

**Operations.** Who answers, what happens when nobody does, what the assistant does with the day's calls, and what the business loses if the provider shuts off.

**Value check.** Total monthly cost against what the module would change for the business, and whether a provider dependency is worth taking before the core CRM is in daily use.

## Questions for the business

Answer these before researching providers; several of them can make the research unnecessary.

1. Where do calls come from today, roughly how many a week, and which of them actually matter — missed after-hours leads, cold calling, client updates, agent coordination?
2. Is the business on the realtor's personal cell today, and would they move off it?
3. Who answers when the realtor is showing a home?
4. Is anything already being recorded, and is there a number that must not be lost?
5. Would the business adopt a hosted number if it clearly improved the workflow?
6. Is the business in a state with two-party recording consent, and is transcription of client calls acceptable to them at all?
