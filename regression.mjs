import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

import { convertToWranglerConfig, resolveAndParseConfig } from "@cloudflare/config";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));

const { data } = await resolveAndParseConfig({
	worker: {
		name: "sandbox-worker",
		compatibilityDate: "2026-07-01",
		env: {
			DURABLE_SANDBOX: {
				type: "durable-object",
				worker: "sandbox-worker",
				exportName: "DurableSandbox",
			},
		},
	},
}, { isPreview: false, mode: undefined });

const binding = convertToWranglerConfig(data).durable_objects.bindings[0];
assert.deepEqual(binding, {
	name: "DURABLE_SANDBOX",
	class_name: "DurableSandbox",
	script_name: "sandbox-worker",
});

const cf = resolve(root, "node_modules/.bin/cf");
const result = spawnSync(cf, ["deploy", "--dry-run", "--mode", "production"], {
	cwd: root,
	encoding: "utf8",
});
const output = `${result.stdout}\n${result.stderr}`;
assert.equal(result.status, 0, output);

assert.match(output, /env\.DURABLE_SANDBOX \(DurableSandbox, defined in sandbox-worker\)/);
assert.match(output, /DurableSandbox \(durable_object\)/);
console.log("same-script Durable Object conversion and container dry-run passed");
