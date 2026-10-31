import type { D1Database, D1PreparedStatement, D1Result } from "@cloudflare/workers-types";
import { projectCloudflareAccountId, requireProjectCloudflareCredentials } from "./project-env.ts";

type QueryResult = {
	success: boolean;
	results?: Record<string, unknown>[];
	meta?: Record<string, unknown>;
};

type ApiResult = {
	success: boolean;
	result?: QueryResult[];
};

type BoundStatement = {
	sql: string;
	params: unknown[];
};

class RemoteStatement {
	readonly sql: string;
	readonly params: unknown[];
	readonly request: (body: { sql: string; params: unknown[] }) => Promise<QueryResult[]>;

	constructor(
		sql: string,
		params: unknown[] = [],
		request: (body: { sql: string; params: unknown[] }) => Promise<QueryResult[]>,
	) {
		this.sql = sql;
		this.params = params;
		this.request = request;
	}

	bind(...params: unknown[]) {
		return new RemoteStatement(this.sql, params, this.request);
	}

	async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
		const row = (await this.execute()).results?.[0];
		if (!row) return null;
		return (columnName ? row[columnName] : row) as T;
	}

	async all<T = Record<string, unknown>>() {
		return (await this.execute()) as unknown as D1Result<T>;
	}

	async run() {
		return (await this.execute()) as unknown as D1Result;
	}

	async raw<T = unknown[]>() {
		return ((await this.execute()).results ?? []) as unknown as T[];
	}

	private async execute() {
		return (await this.request({ sql: this.sql, params: this.params }))[0];
	}
}

export function remoteD1Database(): D1Database {
	requireProjectCloudflareCredentials(true);
	const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
	const databaseId = process.env.MEADOW_D1_DATABASE_ID;
	const token = process.env.CLOUDFLARE_API_TOKEN;
	if (!accountId || !/^[a-f0-9]{32}$/i.test(accountId))
		throw new Error("A valid CLOUDFLARE_ACCOUNT_ID is required for remote D1.");
	if (accountId !== projectCloudflareAccountId)
		throw new Error("Remote D1 is restricted to the JSPN account.");
	if (!databaseId || !/^[a-f0-9-]{36}$/i.test(databaseId))
		throw new Error("A valid MEADOW_D1_DATABASE_ID is required for remote D1.");
	if (!token) throw new Error("CLOUDFLARE_API_TOKEN is required for remote D1.");

	const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
	let verified: Promise<void> | undefined;
	const verifyTarget = async () => {
		const response = await fetch(endpoint.slice(0, -"/query".length), {
			headers: { authorization: `Bearer ${token}` },
		});
		const details = (await response.json()) as {
			success?: boolean;
			result?: { uuid?: string; name?: string };
		};
		if (
			!response.ok ||
			!details.success ||
			details.result?.uuid !== databaseId ||
			details.result?.name !== "meadow-db"
		)
			throw new Error("Refusing a remote database other than Meadow production.");
	};
	const request = async (
		body: { sql: string; params: unknown[] } | { batch: { sql: string; params: unknown[] }[] },
	) => {
		await (verified ??= verifyTarget());
		const response = await fetch(endpoint, {
			method: "POST",
			headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
			body: JSON.stringify(body),
		});
		let result: ApiResult;
		try {
			result = (await response.json()) as ApiResult;
		} catch {
			throw new Error(`Remote D1 request failed (HTTP ${response.status}).`);
		}
		if (!response.ok || !result.success || !result.result?.every((item) => item.success))
			throw new Error(`Remote D1 request failed (HTTP ${response.status}).`);
		return result.result ?? [];
	};
	return {
		prepare(sql: string) {
			return new RemoteStatement(sql, [], request) as unknown as D1PreparedStatement;
		},
		async batch(statements: D1PreparedStatement[]) {
			const batch = (statements as unknown as BoundStatement[]).map(({ sql, params }) => ({
				sql,
				params,
			}));
			return (await request({ batch })) as unknown as D1Result[];
		},
	} as unknown as D1Database;
}
