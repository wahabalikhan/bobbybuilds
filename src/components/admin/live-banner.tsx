/**
 * Shown on every admin page whenever the dashboard is connected to the LIVE database
 * (npm run admin:live). Inline styles only, so it shows even if the stylesheet fails to load,
 * and it stays pinned to the top of the screen. There's no way to dismiss it.
 * scripts/admin-live.mts refuses to keep running if an admin page comes back without it.
 */
export const LIVE_BANNER_MARKER = 'data-live-data-banner="on"';

export function LiveDataBanner() {
	return (
		<div
			role="alert"
			data-live-data-banner="on"
			style={{
				position: "sticky",
				top: 0,
				zIndex: 2147483647,
				display: "block",
				visibility: "visible",
				opacity: 1,
				background: "#b42318",
				color: "#ffffff",
				padding: "10px 16px",
				textAlign: "center",
				font: "600 14px/1.4 system-ui, -apple-system, 'Segoe UI', sans-serif",
				borderBottom: "2px solid #7a1610",
			}}
		>
			LIVE DATA. You&rsquo;re connected to the live database: anything you change here changes the live site.
		</div>
	);
}
