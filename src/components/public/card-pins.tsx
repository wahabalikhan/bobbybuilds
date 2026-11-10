/**
 * Comment pins scattered over a project card (the Portfolio card theme), like the collapsed comment
 * pins on wahabalikhan.com: purely decorative, hidden from screen readers, never clickable, and
 * always under the card's content (the card is its own stacking context and this layer is below it).
 *
 * The places are fixed, so they're the same on every visit, and every pin is whole (none is cut off
 * by the card's edge). They're chosen for the card's fixed 216px height (positions are from the
 * inside of its border), never over the name, tagline, status or the labels under the chart:
 * - three in the gap between the name and the status, spread across it at every width (from 150px,
 *   past the name and its ↗, to 84px from the right, before the status even when it's the wider
 *   "Down" or "Paused") at staggered heights;
 * - two just under the tagline's second line, over the chart's faint top line. The chart's line
 *   always stays at least 15% below that top line (chartCeiling's headroom), so it only reaches
 *   their lower edge when a record day falls right beneath one.
 * The 16px edges and the strip under the chart's labels are too thin for a whole pin. On the
 * narrowest phones (under 360px) the gap fits only one pin, so the other two (`wide`) are hidden.
 *
 * Colours are the portfolio's pin colours whose initials read best (dark initials, 4.71:1 or more);
 * its violet and indigo pins are left out, as their white initials are under 4.5:1.
 */
type Pin = { top: number; left?: string; right?: string; color: string; initial: string; side?: "left"; wide?: true };

/** f = 0…1 across the gap between the name and the status: from 150px to 84px from the right (less the pin's 26px). */
const gap = (f: number) => `calc(150px + (100% - 260px) * ${f})`;

const PINS: Pin[] = [
	// Between the name and the status.
	{ top: 6, left: gap(0), color: "#F97316", initial: "S" },
	{ top: 19, left: gap(0.5), color: "#3B82F6", initial: "J", wide: true },
	{ top: 4, left: gap(1), color: "#22C55E", initial: "M", wide: true },
	// Under the tagline, over the chart's top line: one on the left (pointing right, inwards), one on the right.
	{ top: 96, left: "12%", color: "#EAB308", initial: "A", side: "left" },
	{ top: 96, right: "8%", color: "#EF4444", initial: "R" },
];

export function CardPins() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl select-none">
			{PINS.map((pin) => (
				<span key={`${pin.top}-${pin.left ?? pin.right}`} className="card-pin" data-side={pin.side} data-wide={pin.wide} style={{ top: pin.top, left: pin.left, right: pin.right, backgroundColor: pin.color, color: "#111827" }}>
					{pin.initial}
				</span>
			))}
		</div>
	);
}
