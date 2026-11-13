export const userNames: Readonly<Record<string, string>> = {
	"business-realtor": "Jayden Bontrager",
	"business-assistant": "Janae Spinney",
	"support-admin": "Josh Spinney",
};

export const userName = (id: string) => userNames[id] ?? id;

export const userFirstName = (id: string) => userNames[id]?.split(" ")[0] ?? id;
