# `bindings.durableObject` always emits `script_name`

`cf`'s authored config can't express a **same-script** Durable Object binding: `bindings.durableObject({ worker, exportName })` is unconditionally converted to `{ class_name, script_name: worker }`, even when `worker` is the Worker being deployed (where wrangler requires `script_name` to be **omitted**).

Harmless for ordinary DOs, but `cf deploy` rejects `durable_object`-policy containers whose class binding carries `script_name` — so the [official migration guide](https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-scheduling-policy/) fails with a false positive (verified with `cf@1.0.0-beta.23`, the latest as of 2026-10-26):

> The container sandbox-durable-object is referencing the durable object DurableSandbox, which appears to be defined on the sandbox-worker Worker instead (via the 'script_name' field). You cannot configure a container on a Durable Object that is defined in another Worker.

`sandbox-worker` *is* the Worker being deployed.

## Repro

```sh
npm install && node check.mjs
```

```js
// input  (authored):  { type: "durable-object", worker: "sandbox-worker", exportName: "DurableSandbox" }
// output (converted): { name: "DURABLE_SANDBOX", class_name: "DurableSandbox", script_name: "sandbox-worker" }
//                                                                  BUG: script_name must be omitted ^
```

Root cause (`@cloudflare/config@0.28.1`, unconditional): `script_name: binding.worker`.

## Workaround

```ts
DURABLE_SANDBOX: {
	type: "unsafe:durable_object_namespace",
	class_name: "DurableSandbox",
} satisfies UnsafeBinding,
```

## Fix

Omit `script_name` when `worker === config.worker.name` — or have `cf` treat `script_name === deployingScriptName` as same-script.
