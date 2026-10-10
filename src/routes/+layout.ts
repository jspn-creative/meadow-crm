// Every route in this prototype resolves at build time — the dashboards gallery is a build-time
// glob, and the rest is static HTML out of static/ — so the whole site prerenders. That is what
// makes a plain static Cloudflare Pages deploy possible without a server-side adapter.
export const prerender = true;
