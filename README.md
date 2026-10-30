# Durable Object self-reference regression

This repository is a minimal reproduction for Durable Object bindings that
explicitly name the Worker that defines them. The authored binding is:

```ts
bindings.durableObject({
  worker: "sandbox-worker",
  exportName: "DurableSandbox",
})
```

The configuration converter intentionally preserves the explicit target:

```js
{ name: "DURABLE_SANDBOX", class_name: "DurableSandbox", script_name: "sandbox-worker" }
```

Before workers-sdk PR [#16013](https://github.com/cloudflare/workers-sdk/pull/16013),
`cf@1.0.0-beta.23 deploy --dry-run` rejected a Durable Object-managed Container
because it treated that `script_name` as an external Worker. The fix shipped in
`cf@1.0.0-beta.26` and recognizes self-references using the effective Worker
name while preserving explicit external targets.

## Verify

```sh
npm install
npm test
```

The regression script checks both conversion and a synthetic same-script
Durable Object-managed Container using `cf@1.0.0-beta.26 deploy --dry-run`.
The command builds the fixture image locally and performs Cloudflare's config
validation without uploading or deploying anything.

To reproduce the historical failure, run the same dry run with
`npx cf@1.0.0-beta.23 deploy --dry-run`; it reports that `DurableSandbox`
appears to be defined on `sandbox-worker` via `script_name` and rejects the
Container. The fixed command exits successfully and lists the binding as
`DurableSandbox, defined in sandbox-worker`.
