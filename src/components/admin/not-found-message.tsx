import Link from "next/link";
import { adminHref } from "@/lib/site";

/**
 * "Not found" inside the admin layout. Admin pages render this instead of calling notFound(),
 * which would send a bare error page without the layout (and so without the LIVE DATA banner).
 */
export function AdminNotFoundMessage({ what = "There’s nothing at this address." }: { what?: string }) {
	return (
		<div className="space-y-3">
			<h1 className="text-2xl font-bold tracking-tight">Not found</h1>
			<p className="text-ink-2">{what}</p>
			<Link href={adminHref()} className="inline-block rounded-full bg-ink px-4 py-2 text-sm font-medium text-page">
				Back to Home
			</Link>
		</div>
	);
}
