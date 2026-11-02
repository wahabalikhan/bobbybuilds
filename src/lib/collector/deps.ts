import { getCloudflareContext } from "@opennextjs/cloudflare";
import type { CollectorDeps } from "./http";

type Limiter = "PV_LIMITER" | "EVENTS_LIMITER" | "METRICS_LIMITER";

/** Bindings for a collector route: the database, one rate limiter, and Cloudflare's country. */
export async function collectorDeps(limiter: Limiter): Promise<CollectorDeps> {
	const { env, cf } = await getCloudflareContext({ async: true });
	const country = typeof cf?.country === "string" ? cf.country : null;
	return { db: env.DB, limiter: env[limiter], country };
}
