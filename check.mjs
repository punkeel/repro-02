// Regression check for the fixed self-reference behavior. The converted
// binding intentionally keeps its explicit script_name; cf/wrangler now
// recognizes that it matches the effective Worker name during validation.

import { convertToWranglerConfig, resolveAndParseConfig } from "@cloudflare/config";

const { data } = await resolveAndParseConfig({
	worker: {
		name: "sandbox-worker",
		compatibilityDate: "2026-07-01",
		env: {
			// "worker" names this config's own Worker — a same-script binding.
			DURABLE_SANDBOX: { type: "durable-object", worker: "sandbox-worker", exportName: "DurableSandbox" },
		},
	},
}, { isPreview: false, mode: undefined });

const binding = convertToWranglerConfig(data).durable_objects.bindings[0];
if (binding.script_name !== "sandbox-worker") {
	throw new Error(`Expected explicit self-reference to be preserved: ${JSON.stringify(binding)}`);
}
console.log(binding);
