// Only the adapter's env export is needed; avoid replacing DOM globals with Workers ambient types.
declare module "cloudflare:workers" {
	export const env: Cloudflare.Env;
}
