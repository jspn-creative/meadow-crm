import { existsSync } from "node:fs";

export const projectCloudflareAccountId = "e1c1047c245641f3c40cb70ea0d8f7c6";

export function loadProjectEnv() {
	if (existsSync(".env")) process.loadEnvFile(".env");
}

export function requireProjectCloudflareCredentials(requireProductionApproval = false) {
	loadProjectEnv();
	if (process.env.CLOUDFLARE_ACCOUNT_ID !== projectCloudflareAccountId)
		throw new Error("CLOUDFLARE_ACCOUNT_ID must target JSPN.");
	if (!process.env.CLOUDFLARE_API_TOKEN) throw new Error("CLOUDFLARE_API_TOKEN is required.");
	if (requireProductionApproval && process.env.MEADOW_APPROVED_PRODUCTION !== "true")
		throw new Error("Production Cloudflare changes require explicit developer approval.");
}
