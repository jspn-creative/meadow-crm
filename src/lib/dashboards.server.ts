// Every dashboard is a standalone HTML file in static/dashboards/. Vite inlines the directory at
// build time, so dropping a file in and reloading is the whole workflow — no script to run and
// nothing to register. The display name comes from each file's own <title>, so it stays correct
// without anyone editing this module either.

export type Dashboard = {
	/** Filename, e.g. "02-docket.html". */
	file: string;
	/** Leading digits of the filename, e.g. "02". Empty when the file is unnumbered. */
	num: string;
	/** Display name, from the file's <title>. */
	name: string;
	/** Public URL of the file, served straight out of static/. */
	href: string;
};

const contents = import.meta.glob("/static/dashboards/*.html", {
	eager: true,
	import: "default",
	query: "?raw",
}) as Record<string, string>;

/** Titles read "The Docket · Meadow Lane CRM"; the gallery only wants the leading part. */
const nameOf = (html: string, file: string) => {
	const title = html.match(/<title>([^<]*)<\/title>/i)?.[1].trim() ?? file.replace(/\.html$/, "");
	return title.split("·")[0].trim() || title;
};

export const dashboards: Dashboard[] = Object.keys(contents)
	.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
	.map((path) => {
		const file = path.slice(path.lastIndexOf("/") + 1);
		return {
			file,
			num: file.match(/^\d+/)?.[0] ?? "",
			name: nameOf(contents[path], file),
			href: `/dashboards/${file}`,
		};
	});
