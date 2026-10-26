import { bindings, defineConfig, defineContainer, exports } from "cf/config";
// import type { UnsafeBinding } from "cf/config"; // FIX: uncomment for the workaround

/**
 * Minimal reproduction of the script_name gotcha, using the exact setup from
 * https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-scheduling-policy/
 *
 * `cf build --mode production` succeeds, but `cf deploy --prebuilt --mode
 * production --dry-run` fails because the typed binding below is converted to
 * `{ class_name: "DurableSandbox", script_name: "sandbox-worker" }`, and the
 * deploy validation rejects a durable_object-policy container whose class is
 * bound via script_name — even though "sandbox-worker" is this same Worker.
 */

const container = defineContainer({
	name: "sandbox-durable-object",
	schedulingPolicy: "durable-object",
	images: {
		base: {
			dockerfile: "./container/Dockerfile",
		},
	},
});

export default defineConfig({
	worker: {
		name: "sandbox-worker",
		compatibilityDate: "2026-07-01",
		entrypoint: "worker/index.ts",
		env: {
			// FAILS: converted to { class_name: "DurableSandbox",
			// script_name: "sandbox-worker" }, which the deploy validation
			// rejects for durable_object-policy containers.
			DURABLE_SANDBOX: bindings.durableObject({
				worker: "sandbox-worker", // self-reference: this IS this config's Worker
				exportName: "DurableSandbox",
			}),
			// FIX: replace the typed binding above with the raw same-script
			// binding below (and uncomment the UnsafeBinding import):
			//
			// DURABLE_SANDBOX: {
			// 	type: "unsafe:durable_object_namespace",
			// 	class_name: "DurableSandbox",
			// } satisfies UnsafeBinding,
		},
		exports: {
			DurableSandbox: exports.durableObject({
				storage: "sqlite",
				container,
			}),
		},
	},
	containers: [container],
});
