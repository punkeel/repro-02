import { DurableObject } from "cloudflare:workers";

interface Env {}

/** Minimal DO class owning a durable_object-policy container. */
export class DurableSandbox extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const container = this.ctx.container;
		if (!container) {
			return new Response("No container is configured for this Durable Object", { status: 500 });
		}
		if (!container.running) {
			container.start({
				image: container.images.base,
				enableInternet: false,
			});
		}
		return container.getTcpPort(8080).fetch(request);
	}
}
