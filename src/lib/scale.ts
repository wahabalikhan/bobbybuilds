/**
 * Chart scales. Every chart here counts things (visitors, things shipped), so scales and ticks
 * are whole numbers only: never fractions, and never two ticks with the same label.
 */

/** The 1, 2 or 5 × 10ⁿ step at or above `raw`, never below 1. */
function niceStep(raw: number): number {
	if (!(raw > 1)) return 1;
	const magnitude = 10 ** Math.floor(Math.log10(raw));
	return [1, 2, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? 10 * magnitude;
}

/** A tidy whole number at or above `value`: itself up to 10, then rounded up to a step of about a tenth of it (12, 14, 25, 90, 120). */
export function tidyCeiling(value: number): number {
	if (!Number.isFinite(value) || value <= 0) return 0;
	const step = niceStep(value / 10);
	return Math.ceil(value / step - 1e-9) * step;
}

/**
 * A line chart's top: the highest value plus about 15% headroom, rounded up to a tidy number, and
 * never below `min` (so a handful of visitors doesn't look dramatic). Grows with the numbers.
 */
export function chartCeiling(max: number, { min = 5, headroom = 0.15 } = {}): number {
	return Math.max(min, tidyCeiling((Number.isFinite(max) ? Math.max(0, max) : 0) * (1 + headroom)));
}

/**
 * Whole-number axis ticks from 0, steps of 1, 2 or 5 × 10ⁿ, the last at or above `max` (and at
 * least `min`). Up to 5 that's just 0 and the top.
 */
export function niceTicks(max: number, { count = 4, min = 1 }: { count?: number; min?: number } = {}): number[] {
	const top = Math.max(min, 1, Number.isFinite(max) ? Math.ceil(max - 1e-9) : 0);
	if (top <= 5) return [0, top];
	const step = niceStep(top / count);
	const ticks = [0];
	while (ticks[ticks.length - 1] < top) ticks.push(ticks[ticks.length - 1] + step);
	return ticks;
}
