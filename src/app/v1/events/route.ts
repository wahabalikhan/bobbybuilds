import { collectorDeps } from "@/lib/collector/deps";
import { handleEvent } from "@/lib/collector/events";

// Logic lives in src/lib/collector/events.ts so tests can call it directly.
export async function POST(request: Request) {
	return handleEvent(request, await collectorDeps("EVENTS_LIMITER"));
}
