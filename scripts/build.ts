import { NodeServices } from "@effect/platform-node";
import { Framework } from "@alchemy.run/frontend-frameworks/core";
import { layer } from "@alchemy.run/frontend-frameworks/sveltekit";
import * as Effect from "effect/Effect";

// The same adapter and workerd finishing pass used by Website.SvelteKit, without provisioning resources.
await Effect.runPromise(
	Effect.gen(function* () {
		const framework = yield* Framework;
		const output = yield* framework.build();
		console.log(
			`Alchemy Website build complete: ${output.serverModules?.length ?? 0} server modules.`,
		);
	}).pipe(Effect.provide(layer()), Effect.provide(NodeServices.layer)),
);
