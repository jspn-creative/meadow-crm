import { spawnSync } from "node:child_process";
import { appendFileSync } from "node:fs";
import { projectCloudflareAccountId, requireProjectCloudflareCredentials } from "./project-env.ts";

type Snapshot = { uuid: string; name: string; syncedAt?: number };
type ApiResponse<T> = { success: boolean; result: T };

const mode = process.argv.slice(2).find((arg: string) => arg !== "--");
if (!["reuse", "if-stale", "monthly", "lookup"].includes(mode ?? ""))
	throw new Error("Usage: vp run preview:data -- reuse|if-stale|monthly|lookup");
if (process.env.GITHUB_ACTIONS !== "true" || !process.env.GITHUB_OUTPUT)
	throw new Error("Run preview:data in GitHub Actions.");
requireProjectCloudflareCredentials();
const endpoint = `https://api.cloudflare.com/client/v4/accounts/${projectCloudflareAccountId}/d1/database`;
const prefix = "meadow-preview-data-snapshot-";
const day = 86_400_000;

async function request<T>(path: string, body?: object): Promise<T> {
	const response = await fetch(`${endpoint}${path}`, {
		method: body ? "POST" : "GET",
		headers: {
			authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`,
			"content-type": "application/json",
		},
		...(body ? { body: JSON.stringify(body) } : {}),
	});
	if (!response.ok)
		throw new Error(`Preview snapshot metadata request failed (${response.status}).`);
	const data = (await response.json()) as ApiResponse<T>;
	if (!data.success) throw new Error("Preview snapshot metadata request failed.");
	if (
		body &&
		Array.isArray(data.result) &&
		data.result.some((item: { success?: boolean }) => item.success === false)
	)
		throw new Error("Preview snapshot metadata query failed.");
	return data.result;
}

async function listSnapshots() {
	const snapshots: Snapshot[] = [];
	for (let page = 1; ; page++) {
		const databases = await request<Snapshot[]>(`?per_page=100&page=${page}`);
		for (const database of databases) {
			if (!/^meadow-preview-data-snapshot-\d{13}$/.test(database.name)) continue;
			if (!/^[a-f\d-]{36}$/i.test(database.uuid)) throw new Error("Invalid snapshot database ID.");
			snapshots.push(database);
		}
		if (databases.length < 100) break;
	}
	return snapshots.sort((a, b) => b.name.localeCompare(a.name));
}

async function readSnapshot(database: Snapshot) {
	// Failed or still-running clones have no readiness marker; never log the API body or any records.
	const result = await request<{ results?: { name: string }[] }[]>(`/${database.uuid}/query`, {
		sql: "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__meadow_preview_snapshot'",
	});
	if (!result[0]?.results?.length) return undefined;
	const rows = await request<{ results?: { synced_at: string }[] }[]>(`/${database.uuid}/query`, {
		sql: "SELECT synced_at FROM __meadow_preview_snapshot WHERE id = 1",
	});
	const syncedAt = Date.parse(rows[0]?.results?.[0]?.synced_at ?? "");
	return Number.isFinite(syncedAt) ? { ...database, syncedAt } : undefined;
}

function alchemy(action: "deploy" | "destroy", stage: string) {
	if (!/^snapshot-\d{13}$/.test(stage)) throw new Error("Refusing a non-snapshot stage.");
	const result = spawnSync(
		"vp",
		[
			"exec",
			"--",
			"alchemy",
			action,
			"--config",
			"stacks/preview-data.ts",
			"--stage",
			stage,
			"--yes",
			"--no-input",
		],
		{ stdio: "inherit" },
	);
	if (result.error || result.status !== 0) throw new Error(`Preview snapshot ${action} failed.`);
}

const snapshots = await listSnapshots();
let snapshot: Snapshot | undefined;
for (const database of snapshots) {
	snapshot = await readSnapshot(database);
	if (snapshot) break;
}
const now = Date.now();
const syncedAt = snapshot?.syncedAt ?? 0;
const currentMonth = new Date(now).toISOString().slice(0, 7);
const expired = now - syncedAt > 7 * day;
if (!snapshot && mode === "lookup") throw new Error("No ready preview snapshot exists.");
const refresh =
	mode !== "lookup" &&
	(!snapshot ||
		(mode === "if-stale" && expired) ||
		(mode === "monthly" && new Date(syncedAt).toISOString().slice(0, 7) !== currentMonth));
if (refresh) {
	const stage = `snapshot-${now}`;
	alchemy("deploy", stage);
	const database = (await listSnapshots()).find(
		(item) => item.name === `meadow-preview-data-${stage}`,
	);
	snapshot = database ? await readSnapshot(database) : undefined;
	if (!snapshot) throw new Error("Snapshot deployment did not produce a ready database.");
	console.log("Created a sanitized production snapshot.");
} else {
	console.log("Reusing the existing production snapshot; production was not exported.");
}
if (!snapshot) throw new Error("A ready preview snapshot is required.");
console.log(`Snapshot last synced: ${new Date(snapshot.syncedAt!).toISOString()}`);
appendFileSync(process.env.GITHUB_OUTPUT, `database_id=${snapshot.uuid}\n`);

// Keep the latest two generations and at least 60 days of snapshots, well beyond a runner's lifetime.
if (mode === "monthly") {
	const protectedNames = new Set([snapshot.name]);
	for (const database of snapshots) {
		if (protectedNames.size >= 2) break;
		if (await readSnapshot(database)) protectedNames.add(database.name);
	}
	for (const database of snapshots) {
		const createdAt = Number(database.name.slice(prefix.length));
		if (!protectedNames.has(database.name) && now - createdAt > 60 * day)
			alchemy("destroy", database.name.slice("meadow-preview-data-".length));
	}
}
