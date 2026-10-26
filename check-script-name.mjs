// Library-level repro: a same-script `bindings.durableObject()` reference is
// always converted to a raw binding carrying `script_name`, which the
// `durable_object`-policy Container validation rejects.
//
// No Docker, network, or Cloudflare account required — this only exercises
// `@cloudflare/config`'s authored-config -> wrangler-config conversion.
//
// Usage: node check-script-name.mjs

import { convertToWranglerConfig, resolveAndParseConfig } from "@cloudflare/config";

// Minimal authored config, straight from the official migration guide:
// https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-scheduling-policy/
const authored = {
	worker: {
		name: "sandbox-worker",
		compatibilityDate: "2026-07-01",
		entrypoint: "worker/index.ts",
		env: {
			// "worker" here names THIS config's own Worker, so this is a
			// same-script Durable Object binding.
			DURABLE_SANDBOX: {
				type: "durable-object",
				worker: "sandbox-worker",
				exportName: "DurableSandbox"
			}
		},
		exports: {
			DurableSandbox: { type: "durable-object", storage: "sqlite" }
		}
	},
	containers: [
		{
			name: "sandbox-durable-object",
			schedulingPolicy: "durable-object",
			images: {
				base: { dockerfile: "./container/Dockerfile" }
			}
		}
	]
};

const result = await resolveAndParseConfig(authored, {
	isPreview: false,
	mode: undefined
});
if (!result.success) {
	console.error("config failed to parse:", result.error.issues);
	process.exit(1);
}

const wrangler = convertToWranglerConfig(result.data);
const binding = wrangler.durable_objects.bindings[0];

console.log("authored binding (cloudflare.config.ts):");
console.log(
	" ",
	JSON.stringify({
		type: "durable-object",
		worker: "sandbox-worker",
		exportName: "DurableSandbox"
	})
);
console.log();
console.log("converted wrangler binding (what deploy validation sees):");
console.log(" ", JSON.stringify(binding, null, 2).replace(/\n/g, "\n "));

if (binding.script_name === "sandbox-worker") {
	console.log();
	console.log(
		"BUG: script_name is set to the config's own worker name. A same-script\n" +
		"binding must omit script_name; cf deploy rejects durable_object-policy\n" +
		"containers whose class binding carries script_name with:\n\n" +
		"  \"The container sandbox-durable-object is referencing the durable\n" +
		"   object DurableSandbox, which appears to be defined on the\n" +
		"   sandbox-worker Worker instead (via the 'script_name' field).\""
	);
	process.exitCode = 1;
} else if (binding.script_name === undefined) {
	console.log("\nOK: same-script binding omitted script_name (fixed).");
}
