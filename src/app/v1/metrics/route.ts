import { collectorDeps } from "@/lib/collector/deps";
import { handleMetrics } from "@/lib/collector/metrics";

// Logic lives in src/lib/collector/metrics.ts so tests can call it directly.
export async function POST(request: Request) {
	return handleMetrics(request, await collectorDeps("METRICS_LIMITER"));
}
