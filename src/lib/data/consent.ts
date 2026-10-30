export const consentChannels = ["call", "text", "email", "mail"] as const;

export type ConsentChannel = (typeof consentChannels)[number];

export type Consent = {
	consentCall: boolean;
	consentText: boolean;
	consentEmail: boolean;
	consentMail: boolean;
};

// Consent is one flag per channel. Turning every channel off is what marks a client as not to be contacted, so that state is derived from the flags and never stored on its own.
export function notToBeContacted(client: Consent) {
	return !client.consentCall && !client.consentText && !client.consentEmail && !client.consentMail;
}
