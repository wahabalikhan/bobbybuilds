import { collectorDeps } from "@/lib/collector/deps";
import { handlePageView } from "@/lib/collector/pv";

// Logic lives in src/lib/collector/pv.ts so tests can call it directly.
export async function POST(request: Request) {
	return handlePageView(request, await collectorDeps("PV_LIMITER"));
}
