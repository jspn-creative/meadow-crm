export interface BusinessIdentity {
	actorUserId: string;
	effectiveUserId: string;
	role: "realtor" | "assistant";
}

export function resolveLocalIdentity(
	development: boolean,
	url: URL,
	configuredUser: unknown,
): BusinessIdentity | null {
	if (!development || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return null;
	if (configuredUser !== "realtor" && configuredUser !== "assistant") return null;
	const id = `business-${configuredUser}`;
	return { actorUserId: id, effectiveUserId: id, role: configuredUser };
}
