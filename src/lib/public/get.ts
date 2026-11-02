import { getCloudflareContext } from "@opennextjs/cloudflare";
import { utcDay } from "@/lib/days";
import { readSnapshot, type PublicSnapshot } from "./snapshot";

/** The public snapshot for this request (one KV read). Public pages read nothing else. */
export async function getSnapshot(): Promise<PublicSnapshot> {
	const { env } = await getCloudflareContext({ async: true });
	return readSnapshot(env.PUBLIC_CACHE, env.DB, utcDay());
}
