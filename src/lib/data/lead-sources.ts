// Where a client came from. Only a referral says who; retired sources stay on the clients that have them but can no longer be chosen.
export const referralSource = "Referral";

export const leadSources = [referralSource, "Zillow", "Website", "Open house", "Social media"];

export const retiredLeadSources = ["Sign", "Walk-in"];

// The first labels were phrases; the default seed renames any still stored.
export const legacyLeadSources: Record<string, string> = {
	"A referral": referralSource,
	"An open house": "Open house",
	"A sign": "Sign",
	"The website": "Website",
	"A walk-in": "Walk-in",
};
