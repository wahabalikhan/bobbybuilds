
/**
 * "Not found" inside the admin layout. Admin pages render this instead of calling notFound(),
 * which would send a bare error page without the layout (and so without the LIVE DATA banner).
 * The way back is the wordmark in the top bar, like every other admin page.
 */
export function AdminNotFoundMessage({ what = "There’s nothing at this address." }: { what?: string }) {
	return (
		<div className="space-y-3">
			<h1 className="text-3xl font-bold tracking-tight">Not found</h1>
			<p className="text-ink-2">{what}</p>
		</div>
	);
}
