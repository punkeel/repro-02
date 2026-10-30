import { bindings, defineConfig, defineContainer, exports } from "cf/config";
import * as entrypoint from "./fixtures/same-script-container/src/index.ts" with { type: "cf-worker" };

const container = defineContainer({
	name: "sandbox-container",
	schedulingPolicy: "durable-object",
	images: {
		default: {
			dockerfile: "./fixtures/same-script-container/Dockerfile",
			buildContext: "./fixtures/same-script-container",
		},
	},
});

export default defineConfig({
	containers: [container],
	worker: {
		name: "sandbox-worker",
		compatibilityDate: "2026-07-01",
		entrypoint,
		env: {
			DURABLE_SANDBOX: bindings.durableObject({
				worker: "sandbox-worker",
				exportName: "DurableSandbox",
			}),
		},
		exports: {
			DurableSandbox: exports.durableObject({ storage: "sqlite", container }),
		},
	},
});
