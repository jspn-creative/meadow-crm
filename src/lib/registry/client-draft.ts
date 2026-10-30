import type { Workspace } from "#lib/data/workspace.js";

export type ClientRecord = Workspace["clients"][number];
export type ReferredByMode = "none" | "client" | "name";
export type LabeledValue = { id: string; label: string; value: string };
export type PersonDraft = {
	id: string;
	name: string;
	birthday: string;
	phones: LabeledValue[];
	emails: LabeledValue[];
};
export type AddressDraft = { id: string; label: string; address: string; owned: boolean };
export type RelationshipDraft = { id: string; relatedClientId: string; label: string };
export type KeyDateDraft = { id: string; name: string; date: string };
export type ClientDraft = {
	id: string;
	revision: number;
	name: string;
	leadSource: string;
	referredByMode: ReferredByMode;
	referredByClientId: string;
	referredByName: string;
	preferences: string;
	preferredContactMethod: string;
	consentCall: boolean;
	consentText: boolean;
	consentEmail: boolean;
	consentMail: boolean;
	notes: string;
	people: PersonDraft[];
	addresses: AddressDraft[];
	relationships: RelationshipDraft[];
	keyDates: KeyDateDraft[];
	tagIds: string[];
};

export const leadSources = ["A referral", "An open house", "A sign", "The website", "A walk-in"];

export function newClientDraft(id: string, name = "", revision = 1): ClientDraft {
	return {
		id,
		revision,
		name,
		leadSource: "",
		referredByMode: "none",
		referredByClientId: "",
		referredByName: "",
		preferences: "",
		preferredContactMethod: "",
		consentCall: true,
		consentText: true,
		consentEmail: true,
		consentMail: true,
		notes: "",
		people: [],
		addresses: [],
		relationships: [],
		keyDates: [],
		tagIds: [],
	};
}

export function clientDraft(record: ClientRecord): ClientDraft {
	const referredByMode: ReferredByMode = record.referredByClientId
		? "client"
		: record.referredByName
			? "name"
			: "none";
	return {
		id: record.id,
		revision: record.revision,
		name: record.name,
		leadSource: record.leadSource ?? "",
		referredByMode,
		referredByClientId: record.referredByClientId ?? "",
		referredByName: record.referredByName ?? "",
		preferences: record.preferences,
		preferredContactMethod: record.preferredContactMethod ?? "",
		consentCall: record.consentCall,
		consentText: record.consentText,
		consentEmail: record.consentEmail,
		consentMail: record.consentMail,
		notes: record.notes,
		people: record.people.map((person) => ({
			id: person.id,
			name: person.name,
			birthday: person.birthday ?? "",
			phones: person.phones.map((phone) => ({ id: phone.id, label: phone.label, value: phone.value })),
			emails: person.emails.map((email) => ({ id: email.id, label: email.label, value: email.value })),
		})),
		addresses: record.addresses.map((address) => ({
			id: address.id,
			label: address.label,
			address: address.address,
			owned: address.owned,
		})),
		relationships: record.relationships.map((relationship) => ({
			id: relationship.id,
			relatedClientId: relationship.relatedClientId,
			label: relationship.label,
		})),
		keyDates: record.keyDates.map((keyDate) => ({
			id: keyDate.id,
			name: keyDate.name,
			date: keyDate.date,
		})),
		tagIds: record.tags.map((tag) => tag.id),
	};
}

// Rows left completely empty are dropped; a partly filled row is sent as typed so the server names what is missing.
function filled(values: string[]) {
	return values.some((value) => value.trim() !== "");
}

function labeled(rows: LabeledValue[]) {
	return rows
		.filter((row) => filled([row.label, row.value]))
		.map((row) => ({ id: row.id, label: row.label.trim(), value: row.value.trim() }));
}

export function clientSaveInput(draft: ClientDraft, requestId: string) {
	const referredBy =
		draft.referredByMode === "client"
			? { referredByClientId: draft.referredByClientId || null, referredByName: null }
			: draft.referredByMode === "name"
				? { referredByClientId: null, referredByName: draft.referredByName.trim() || null }
				: { referredByClientId: null, referredByName: null };
	return {
		requestId,
		id: draft.id,
		revision: draft.revision,
		name: draft.name.trim(),
		leadSource: draft.leadSource.trim() || null,
		preferences: draft.preferences,
		preferredContactMethod: (draft.preferredContactMethod || null) as
			| "call"
			| "text"
			| "email"
			| "mail"
			| null,
		...referredBy,
		consentCall: draft.consentCall,
		consentText: draft.consentText,
		consentEmail: draft.consentEmail,
		consentMail: draft.consentMail,
		notes: draft.notes,
		people: draft.people
			.filter(
				(person) =>
					filled([person.name, person.birthday]) || person.phones.length || person.emails.length,
			)
			.map((person) => ({
				id: person.id,
				name: person.name.trim(),
				birthday: person.birthday || null,
				phones: labeled(person.phones),
				emails: labeled(person.emails),
			})),
		addresses: draft.addresses
			.filter((address) => filled([address.label, address.address]))
			.map((address) => ({
				id: address.id,
				label: address.label.trim(),
				address: address.address.trim(),
				owned: address.owned,
			})),
		relationships: draft.relationships
			.filter((relationship) => relationship.relatedClientId)
			.map((relationship) => ({
				id: relationship.id,
				relatedClientId: relationship.relatedClientId,
				label: relationship.label.trim(),
			})),
		keyDates: draft.keyDates
			.filter((keyDate) => filled([keyDate.name, keyDate.date]))
			.map((keyDate) => ({ id: keyDate.id, name: keyDate.name.trim(), date: keyDate.date })),
		tagIds: [...draft.tagIds],
	};
}
