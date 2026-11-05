import { ImageResponse } from "next/og";
import { owner, site } from "@/lib/site";

export const shareImageSize = { width: 1200, height: 630 };

/** A share card in the site's style: white, a thin border, a big title, and one number in a pill. */
export function shareImage({ eyebrow, title, subtitle, pill }: { eyebrow: string; title: string; subtitle?: string; pill?: string }) {
	return new ImageResponse(
		(
			<div style={{ width: "100%", height: "100%", display: "flex", background: "#ffffff", padding: 48 }}>
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						border: "2px solid #e9e9eb",
						borderRadius: 32,
						padding: 56,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
						<div style={{ fontSize: 30, color: "#71717a" }}>{eyebrow}</div>
						{pill ? <div style={{ fontSize: 30, fontWeight: 700, background: "#f4f4f5", borderRadius: 999, padding: "10px 24px", color: "#0a0a0a" }}>{pill}</div> : null}
					</div>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: 72, fontWeight: 700, color: "#0a0a0a", lineHeight: 1.1, letterSpacing: -1.5 }}>{title}</div>
						{subtitle ? <div style={{ fontSize: 34, color: "#52525b", marginTop: 20, lineHeight: 1.35 }}>{subtitle}</div> : null}
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
						<div style={{ width: 52, height: 52, borderRadius: 999, background: "#0a0a0a", color: "#ffffff", fontSize: 26, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
							{owner.firstName.slice(0, 1)}
						</div>
						<div style={{ fontSize: 28, color: "#0a0a0a", fontWeight: 600 }}>{owner.name}</div>
						<div style={{ fontSize: 28, color: "#71717a" }}>{`· ${site.name}`}</div>
						<div style={{ marginLeft: "auto", width: 120, height: 8, borderRadius: 999, background: "#0a0a0a" }} />
					</div>
				</div>
			</div>
		),
		shareImageSize,
	);
}
