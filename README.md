# `cf`: `bindings.durableObject` always emits `script_name`, breaking `durable_object`-policy Containers

**Status: still reproduces at the latest published versions** (verified 2026-10-26):

| package | version |
| --- | --- |
| `cf` | `1.0.0-beta.23` (`dist-tags.latest`) |
| `@cloudflare/config` | `0.28.1` (`latest`) |
| `wrangler` | `4.153.0` |

## Summary

The Cloudflare `cf` CLI's authored config (`cloudflare.config.ts`) has no way to
express a **same-script** Durable Object binding. `bindings.durableObject({
worker, exportName })` is unconditionally converted to the raw wrangler binding
`{ name, class_name, script_name: worker }` — even when `worker` is the name of
the very Worker being deployed, where wrangler semantics require **omitting**
`script_name`.

That is harmless for ordinary DOs, but the `cf deploy` validation for
Container applications with the `durable_object` scheduling policy rejects any
Container class whose DO binding carries `script_name` — including a
self-reference — so the documented migration path from the Cloudflare guide
cannot be expressed with the typed helper at all:

```
Error
The container sandbox-durable-object is referencing the durable object
DurableSandbox, which appears to be defined on the sandbox-worker Worker
instead (via the 'script_name' field). You cannot configure a container on a
Durable Object that is defined in another Worker.
```

`sandbox-worker` *is* the Worker being deployed, so the error is a false
positive caused by the emitted `script_name`.

I hit this while migrating a production Worker from the `default` to the
`durable_object` scheduling policy following
https://developers.cloudflare.com/containers/guides/migrate-to-durable-object-scheduling-policy/
— the guide's own example config is exactly what this repo deploys, and it
cannot be written with the typed helper.

## Root cause

`@cloudflare/config` (conversion of authored bindings to wrangler format),
identical in `0.24.1` and `0.28.1`:

```js
// @cloudflare/config/dist/index.mjs
case "durable-object":
    durableObjectBindings.push({
        name,
        class_name: binding.exportName,
        script_name: binding.worker   // ← unconditional, even when
                                      //   binding.worker === the config's
                                      //   own worker name
    });
    break;
```

The deploy-side validator (`cf`, `validateDurableObjectContainerApplications`)
then rejects it without ever comparing `script_name` to the deploying Worker's
name:

```js
const binding = config.durable_objects.bindings.find(
    (b) => b.class_name === app.class_name
);
if (binding?.script_name !== undefined) {
    // throws — even when script_name === the script being deployed
}
```

Wrangler itself treats a DO binding without `script_name` as a same-script
reference; `cf` just cannot emit one.

## Files

- `check-script-name.mjs` — **library-level repro** (no Docker, no network, no
  Cloudflare account): feeds a minimal authored config through
  `resolveAndParseConfig` + `convertToWranglerConfig` and prints the emitted
  `durable_objects.bindings`, showing `script_name: "sandbox-worker"` even
  though the binding references the config's own Worker.
- `cloudflare.config.ts` — **end-to-end repro**: the minimal setup from the
  official migration guide: one SQLite-backed DO class, one
  `durable_object`-policy Container with a named image, and a
  `bindings.durableObject` self-reference. The line to swap for the workaround
  is marked with `// FIX:`.
- `worker/index.ts` — minimal `DurableObject` subclass.
- `container/Dockerfile` — trivial image (`debian:bookworm-slim`).

## Reproducing

### 1. Library level (fastest)

```sh
npm install
node check-script-name.mjs   # exits 1 while the bug reproduces
```

Expected output:

```
authored binding (cloudflare.config.ts):
  {"type":"durable-object","worker":"sandbox-worker","exportName":"DurableSandbox"}

converted wrangler binding (what deploy validation sees):
  {
   "name": "DURABLE_SANDBOX",
   "class_name": "DurableSandbox",
   "script_name": "sandbox-worker"
 }

BUG: script_name is set to the config's own worker name. A same-script
binding must omit script_name; cf deploy rejects durable_object-policy
containers whose class binding carries script_name with: ...
```

### 2. End to end (deploy dry-run)

Requires Docker (for `cf build`); the dry-run itself makes no changes.

```sh
npm install
npx cf build --mode production                       # succeeds
npx cf deploy --prebuilt --mode production --dry-run # exits 1 with the error
```

Verified output with the typed binding (cf@1.0.0-beta.23):

```
┌ Error
│ The container sandbox-durable-object is referencing the durable object
│ DurableSandbox, which appears to be defined on the sandbox-worker Worker
│ instead (via the 'script_name' field). You cannot configure a container on a
│ Durable Object that is defined in another Worker.
└
```

## Workaround

Author the binding as a raw "unsafe" binding (see the `// FIX:` block in
`cloudflare.config.ts`). The text after `unsafe:` is the raw upload binding
type, and `durable_object_namespace` without `script_name` means "class in
this same script" — exactly what the typed helper cannot express:

```ts
import type { UnsafeBinding } from "cf/config";

env: {
    DURABLE_SANDBOX: {
        type: "unsafe:durable_object_namespace",
        class_name: "DurableSandbox",
    } satisfies UnsafeBinding,
}
```

With this swap, `cf build` + `cf deploy --prebuilt --dry-run` succeeds and
lists `DurableSandbox (durable_object)` among the available containers
(verified with the versions above).

Caveat: `cf build` prints a cosmetic warning ("Consider migrating this unsafe
binding to a format for 'durable_object_namespace' bindings that is supported
by wrangler") — the supported format is precisely what is broken here.

## Suggested upstream fixes

Either (or both):

1. `@cloudflare/config`: when converting a `durable-object` binding whose
   `worker` equals the config's own `worker.name`, omit `script_name`
   (matching wrangler semantics for same-script bindings).
2. `cf` deploy validation: treat `binding.script_name === deployingScriptName`
   as a same-script reference rather than rejecting it outright.
