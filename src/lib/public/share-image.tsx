import { ImageResponse } from "next/og";
import { owner, site } from "@/lib/site";

export const shareImageSize = { width: 1200, height: 630 };

/**
 * A share card in the public pages' style: a card on the light grey page (or, with `blue`, the blue of
 * a journey post's header), a big title, and one number in a pill. Colours are the public tokens
 * (globals.css, .public-theme): the image can't read CSS variables.
 */
export function shareImage({ eyebrow, title, subtitle, pill, blue = false }: { eyebrow: string; title: string; subtitle?: string; pill?: string; blue?: boolean }) {
	const ink = blue ? "#ffffff" : "#15171c";
	const soft = blue ? "#dde4f9" : "#4a4f5c";
	const muted = blue ? "#dde4f9" : "#5b6170";
	return new ImageResponse(
		(
			<div style={{ width: "100%", height: "100%", display: "flex", background: "#f4f5f7", padding: 40 }}>
				<div
					style={{
						flex: 1,
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						background: blue ? "#1d4ed8" : "#ffffff",
						border: blue ? "none" : "2px solid #e6e8ee",
						borderRadius: 44,
						padding: 56,
					}}
				>
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
						<div style={{ fontSize: 28, color: muted, letterSpacing: 2, textTransform: "uppercase" }}>{eyebrow}</div>
						{pill ? <div style={{ fontSize: 28, fontWeight: 700, background: blue ? "rgba(255,255,255,0.16)" : "#f0f1f4", borderRadius: 999, padding: "10px 24px", color: ink }}>{pill}</div> : null}
					</div>
					<div style={{ display: "flex", flexDirection: "column" }}>
						<div style={{ fontSize: title.length > 48 ? 60 : 72, fontWeight: 700, color: ink, lineHeight: 1.08, letterSpacing: -2 }}>{title}</div>
						{subtitle ? <div style={{ fontSize: 30, color: soft, marginTop: 20, lineHeight: 1.35 }}>{subtitle}</div> : null}
					</div>
					<div style={{ display: "flex", alignItems: "center", gap: 18 }}>
						<div style={{ width: 52, height: 52, borderRadius: 14, background: blue ? "#ffffff" : "#15171c", color: blue ? "#1d4ed8" : "#ffffff", fontSize: 28, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
							B
						</div>
						<div style={{ fontSize: 28, color: ink, fontWeight: 700 }}>{site.name}</div>
						<div style={{ fontSize: 28, color: muted }}>{`· ${owner.name}`}</div>
					</div>
				</div>
			</div>
		),
		shareImageSize,
	);
}
