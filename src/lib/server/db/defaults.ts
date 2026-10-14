import type { opportunityTypes, stages } from "./schema.ts";

type Type = (typeof opportunityTypes)[number];
type Stage = (typeof stages)[number];
type Step = readonly [id: string, title: string];

// These IDs describe the original seed identities, not editable labels or live list positions. Never renumber them when editing defaults.
export const defaultChecklists: Record<Type, Record<Stage, readonly Step[]>> = {
	buyer: {
		"new-lead": [
			["01", "Log the initial contact attempt"],
			["02", "Send a follow-up message"],
			["03", "Record how the lead found the business"],
			["04", "Capture budget, area, and timeline"],
			["05", "Book the consultation"],
		],
		"active-lead": [
			["01", "Hold the buyer consultation"],
			["02", "Confirm financing status or proof of funds"],
			["03", "Document must-haves, areas, and dealbreakers"],
			["04", "Execute the buyer representation agreement"],
			["05", "Configure the property search"],
			["06", "Schedule first showings"],
			["07", "Record showing feedback"],
		],
		"under-contract": [
			["01", "Distribute the executed contract to lender and title/escrow"],
			["02", "Verify the earnest money deposit"],
			["03", "Complete the inspection before the contingency deadline"],
			["04", "Finalize the repair addendum or credit"],
			["05", "Confirm the appraisal"],
			["06", "Confirm clear to close"],
			["07", "Review the title commitment and clear liens"],
			["08", "Sign the closing disclosure"],
			["09", "Complete the final walkthrough"],
			["10", "Sign, fund, and confirm recording"],
		],
		closed: [
			["01", "Recover keys, lockbox, and staging inventory"],
			["02", "Submit the brokerage compliance file"],
			["03", "Confirm commission disbursement"],
			["04", "Deliver the settlement gift"],
			["05", "Request a client review"],
			["06", "Add to the sphere-of-influence nurture list"],
			["07", "Schedule the home anniversary and annual check-in"],
		],
	},
	seller: {
		"new-lead": [
			["01", "Log the initial contact attempt"],
			["02", "Send a follow-up message"],
			["03", "Record how the lead found the business"],
			["04", "Ask about timing, reason for selling, and expected price"],
			["05", "Book the listing presentation"],
		],
		"active-lead": [
			["01", "Hold the listing presentation"],
			["02", "Deliver the comparative market analysis"],
			["03", "Review the net sheet and pricing strategy"],
			["04", "Execute the listing agreement"],
			["05", "Prepare the required disclosure packages"],
			["06", "Arrange photography, floorplan, and video"],
			["07", "Finalize staging and repair punch list"],
			["08", "Publish the listing and syndication copy"],
			["09", "Track showing feedback"],
			["10", "Review incoming offers and issue counters"],
		],
		"under-contract": [
			["01", "Distribute the executed contract"],
			["02", "Verify the earnest money deposit"],
			["03", "Confirm the buyer's inspection and review the report"],
			["04", "Negotiate the repair addendum or credit"],
			["05", "Confirm the appraisal and value"],
			["06", "Review title and clear liens"],
			["07", "Deliver and obtain approval of required disclosures"],
			["08", "Complete the final walkthrough"],
			["09", "Sign, fund, and confirm recording"],
		],
		closed: [
			["01", "Recover lockbox, yard signs, and staging inventory"],
			["02", "Remove the listing and stop syndication"],
			["03", "Submit the brokerage compliance file"],
			["04", "Confirm commission disbursement"],
			["05", "Deliver the settlement gift"],
			["06", "Request a client review"],
			["07", "Add to the sphere-of-influence nurture list"],
			["08", "Schedule the home anniversary check-in"],
		],
	},
	"estate-sale": {
		"new-lead": [
			["01", "Log the initial contact attempt"],
			["02", "Send a follow-up message"],
			["03", "Record how the family found the business"],
			["04", "Confirm the family wants an estate sale rather than a listing"],
			["05", "Capture the property location and the approximate timing"],
			["06", "Ask whether the family is already working with the partner company"],
		],
		"active-lead": [
			["01", "Confirm the partner company is accepting the referral"],
			["02", "Make the introduction between the family and the partner company"],
			["03", "Share the property details and the family's timeline"],
			["04", "Log the partner company's contact and next step"],
			["05", "Note whether the family also needs a real estate service from the business"],
		],
		"under-contract": [
			["01", "Confirm the booked date and scope with the partner company"],
			["02", "Confirm the referral arrangement and who gets what"],
			["03", "Track anything the business itself owes the family, if anything"],
			["04", "Note any follow-up the family has asked for"],
		],
		closed: [
			["01", "Confirm the sale took place"],
			["02", "Log any feedback the family shared"],
			["03", "Add the family to the nurture list if they may need real estate later"],
			["04", "Note whether the partner company referred anyone back"],
			["05", "Archive the opportunity"],
		],
	},
	construction: {
		"new-lead": [
			["01", "Log the initial contact attempt"],
			["02", "Send a follow-up message"],
			["03", "Record how they found the business"],
			["04", "Capture what the job is and roughly when they want it done"],
			["05", "Ask for a budget range"],
		],
		"active-lead": [
			["01", "Visit or review the site and confirm the scope"],
			["02", "Write the estimate or proposal"],
			["03", "Review the estimate with the client and get it approved"],
			["04", "Confirm the deposit or first payment"],
			["05", "Pull any permits needed for the work"],
			["06", "Source materials and confirm lead times"],
			["07", "Schedule the work and any subcontractors"],
		],
		"under-contract": [
			["01", "Track the schedule against the promised dates"],
			["02", "Track change orders and get them approved in writing"],
			["03", "Coordinate subcontractors and deliveries"],
			["04", "Flag anything that threatens the schedule"],
			["05", "Complete the work"],
		],
		closed: [
			["01", "Complete the final walkthrough with the client"],
			["02", "Confirm final payment received"],
			["03", "Collect and file any permits, warranties, and receipts"],
			["04", "Request a review or referral"],
			["05", "Add the client to the nurture list"],
			["06", "Note any follow-up work they might want next"],
		],
	},
};

export const templateId = (type: Type, stage: Stage) => `default-${type}-${stage}`;
export const defaultItemId = (type: Type, stage: Stage, seedId: string) =>
	`${templateId(type, stage)}-${seedId}`;
