// Server-side so the inlined dashboard HTML stays out of the client bundle. The list is resolved
// when the server module is built, so a new file shows up on the next `vp dev` reload or build.
//
// The import is relative because #lib/* does not resolve extensionless, and a .ts extension is
// rejected by rewriteRelativeImportExtensions outside a relative path.
import { dashboards } from "../../lib/dashboards.server";

export const load = () => ({ dashboards });
