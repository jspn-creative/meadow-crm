import type { ContactEntry } from "./types.js";

type Reachable = { value: string };
/** The parts of a saved client or a client draft that Log contact shows beside its form. */
type ClientLike = {
	id: string;
	name: string;
	people: { name: string; phones: Reachable[]; emails: Reachable[] }[];
	preferredContactMethod: string | null;
	preferences: string;
	consentCall: boolean;
	consentText: boolean;
	consentEmail: boolean;
	consentMail: boolean;
};

export type ClientFacts = {
	id: string;
	name: string;
	/** The name sentences use. */
	called: string;
	phone?: string;
	email?: string;
	prefers?: string;
	preferences: string;
	consent: Record<"call" | "text" | "email" | "mail", boolean>;
	/** Last contacted and the latest attempt from the server, present for the client whose dialog is open; without them, Last contacted is left out rather than guessed. */
	contact?: { lastContacted?: ContactEntry; latestAttempt?: ContactEntry };
};

/** The first person's first name, or the client's name when it holds several people. */
export const calledName = (client: Pick<ClientLike, "name" | "people">) =>
	client.people.length === 1
		? client.people[0]!.name.trim().split(/\s+/)[0] || client.name
		: client.name;

const capitalized = (value: string | null) =>
	value ? value[0]!.toUpperCase() + value.slice(1) : undefined;

export function clientFacts(client: ClientLike, contact?: ClientFacts["contact"]): ClientFacts {
	return {
		id: client.id,
		name: client.name,
		called: calledName(client),
		phone: client.people.flatMap((person) => person.phones).find((row) => row.value.trim())?.value,
		email: client.people.flatMap((person) => person.emails).find((row) => row.value.trim())?.value,
		prefers: capitalized(client.preferredContactMethod),
		preferences: client.preferences,
		consent: {
			call: client.consentCall,
			text: client.consentText,
			email: client.consentEmail,
			mail: client.consentMail,
		},
		contact,
	};
}
