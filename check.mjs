// `bindings.durableObject({ worker, exportName })` cannot express a
// same-script Durable Object binding: `@cloudflare/config` always emits
// `script_name: worker` — even when `worker` is the Worker being deployed —
// and `cf deploy` rejects `durable_object`-policy containers whose class is
// bound via `script_name`:
//
//   "The container ... is referencing the durable object ..., which appears
//    to be defined on the sandbox-worker Worker instead (via the
//    'script_name' field). You cannot configure a container on a Durable
//    Object that is defined in another Worker."
//
// Usage: npm install && node check.mjs

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

console.log(convertToWranglerConfig(data).durable_objects.bindings[0]);
// → { name: 'DURABLE_SANDBOX', class_name: 'DurableSandbox',
//     script_name: 'sandbox-worker' }   ← BUG: must be omitted, this IS this Worker
