import { SectionHeading } from "@/components/admin/ui";
import { formatWhole } from "@/lib/format";
import { CARD_HEIGHT } from "@/lib/layout";
import type { PublicActivity } from "@/lib/public/snapshot";
import { ContributionGrid, MonthBars } from "./mono-charts";

/**
 * Activity (only when "Show my activity" is on): two cards side by side (stacked on phones),
 * styled like the project cards (same border, radius, padding, gap and equal heights). Left, "Shipping rhythm": Shipped journey entries per month for the last 12 months, with
 * what shipped in the hover card. Right, "GitHub activity": the contribution grid in greys, with
 * the year's total and longest streak.
 */
/** The same box as a project card (project-card.tsx). */
const CARD = `flex h-full min-w-0 flex-col rounded-2xl border border-line bg-card p-4 ${CARD_HEIGHT}`;

export function Activity({ activity }: { activity: PublicActivity }) {
	const shipped = activity.shipped.reduce((t, m) => t + m.titles.length, 0);
	const github = activity.github;
	return (
		<section id="activity" aria-labelledby="activity-heading" className="scroll-mt-20">
			<SectionHeading id="activity-heading" relaxed>
				Activity
			</SectionHeading>
			<div className="grid gap-3 md:grid-cols-2">
				<div data-activity-card className={CARD}>
					<h3 className="font-semibold">Shipping rhythm</h3>
					<p className="mt-1 text-sm text-ink-2">
						<strong className="font-semibold tabular text-ink">{formatWhole(shipped)}</strong> thing{shipped === 1 ? "" : "s"} shipped in the last 12 months
					</p>
					<div className="mt-auto pt-3">
						<MonthBars
							months={activity.shipped.map((m) => ({ month: m.month, value: m.titles.length, items: m.titles }))}
							title="Shipped entries per month for the last 12 months"
							unit={["thing shipped", "things shipped"]}
							height={124}
						/>
					</div>
				</div>
				<div data-activity-card className={CARD}>
					<h3 className="font-semibold">GitHub activity</h3>
					{github ? (
						<>
							<p className="mt-1 text-sm leading-snug text-ink-2">
								<strong className="font-semibold tabular text-ink">{formatWhole(github.total)}</strong> contributions in the last year
								<span aria-hidden className="mx-1.5 text-muted">
									·
								</span>
								longest streak <strong className="font-semibold tabular text-ink">{formatWhole(github.longestStreak)}</strong> day{github.longestStreak === 1 ? "" : "s"}
							</p>
							{/* At the bottom; at least 2px under the summary, which wraps to two lines on narrower cards. */}
							<div className="mt-auto pt-0.5">
								<ContributionGrid firstDay={github.firstDay} counts={github.counts} />
							</div>
						</>
					) : (
						<p className="mt-1 text-sm text-muted">No GitHub activity to show yet.</p>
					)}
				</div>
			</div>
		</section>
	);
}
