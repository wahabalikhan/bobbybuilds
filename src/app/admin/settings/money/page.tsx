import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { FieldError, Hidden, SelectField, SettingsForm, TextField } from "@/components/admin/form";
import { PageHeader } from "@/components/admin/ui";
import { ToastOnLoad } from "@/components/admin/toast";
import { requestTime } from "@/lib/admin/clock";
import { previousMonth } from "@/lib/admin/settings-core";
import { isMonth, MONEY_MAX_ROWS } from "@/lib/admin/validate";
import { utcDay } from "@/lib/days";
import { listMonth, listMonths, listServices, monthTotals } from "@/lib/db/money";
import { listRealProjects } from "@/lib/db/projects";
import { formatLongMonth, formatPence, penceInput } from "@/lib/format";
import { adminHref } from "@/lib/site";
import { moneyAction } from "../actions";

export const metadata: Metadata = { title: "Costs and revenue" };

/** Suggested services, plus any used before. */
const SUGGESTED = ["Cloudflare", "Supabase", "Anthropic API (AI features)", "Claude subscription", "Domains", "Resend", "GitHub", "Figma"];

const nextMonth = (month: string) => {
	const [y, m] = month.split("-").map(Number);
	return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
};

/** One month's costs and revenue, per service and optionally per project, in pounds. */
export default async function MoneyPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
	const { env } = await getCloudflareContext({ async: true });
	const thisMonth = utcDay(requestTime()).slice(0, 7);
	const params = await searchParams;
	const month = params.month && isMonth(params.month) ? params.month : thisMonth;
	const [rows, months, used, projects] = await Promise.all([listMonth(env.DB, month), listMonths(env.DB), listServices(env.DB), listRealProjects(env.DB)]);
	const services = [...new Set([...SUGGESTED, ...used])];
	const totals = monthTotals(rows);
	const blank = Math.min(MONEY_MAX_ROWS - rows.length, rows.length ? 3 : 5);
	const projectOptions = [{ value: "", label: "Shared" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))];
	const hasCosts = rows.some((r) => r.kind === "cost");

	return (
		<div className="space-y-6">
			<div className="space-y-3">
				<PageHeader
					title="Costs and revenue"
					subtitle="What it costs each month, and what it earns (even £0). The latest month with anything in it is shown on your public page: running costs (what keeps the products live) as the headline figure, and tools you build with listed separately."
				/>
			</div>

			{/* Month navigation as text links, not buttons. */}
			<nav aria-label="Month" className="flex items-center justify-between gap-3 text-sm">
				<Link href={adminHref(`/settings/money?month=${previousMonth(month)}`)} className="link">
					<span aria-hidden>‹ </span>
					{formatLongMonth(previousMonth(month), false)}
				</Link>
				<h2 className="text-[15px] font-medium tracking-tight" aria-live="polite">
					{formatLongMonth(month)}
					{month === thisMonth && <span className="ml-2 text-sm font-normal text-muted">this month</span>}
				</h2>
				{month < thisMonth ? (
					<Link href={adminHref(`/settings/money?month=${nextMonth(month)}`)} className="link">
						{formatLongMonth(nextMonth(month), false)}
						<span aria-hidden> ›</span>
					</Link>
				) : (
					<span aria-hidden className="w-20" />
				)}
			</nav>

			<p className="text-sm text-ink-2">
				Running costs <span className="font-semibold tabular text-ink">{formatPence(totals.runningPence)}</span> · Tools I build with <span className="font-semibold tabular text-ink">{formatPence(totals.toolsPence)}</span> · Revenue{" "}
				<span className="font-semibold tabular text-ink">{formatPence(totals.revenuePence)}</span>
				<span className="text-muted"> (a month, with yearly bills ÷ 12)</span>
			</p>

			{params.copied && hasCosts && <ToastOnLoad tone="success" text={`Copied ${params.copied === "1" ? "1 cost" : `${Number(params.copied) || ""} costs`} from ${formatLongMonth(previousMonth(month))}. Check the amounts, then save.`} param="copied" />}

			<section className="rounded-2xl border border-line bg-card p-4">
				{/* One form: "Copy costs from <last month>" (secondary, only when this month has no costs) on the left, "Save month" on the far right. */}
				<SettingsForm
					action={moneyAction}
					buttons={[
						...(hasCosts ? [] : [{ label: `Copy costs from ${formatLongMonth(previousMonth(month), false)}`, name: "intent", value: "copy", quiet: true }]),
						{ label: "Save month", name: "intent", value: "save" },
					]}
				>
					<Hidden name="month" value={month} />
					<datalist id="money-services">
						{services.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
					<div className="hidden grid-cols-[10rem_1fr_9rem_7rem_7rem] gap-3 text-xs font-medium text-muted sm:grid" aria-hidden>
						<span>Type</span>
						<span>Service</span>
						<span>Project</span>
						<span>Amount (£)</span>
						<span>Billed</span>
					</div>
					<div className="space-y-3">
						{Array.from({ length: rows.length + blank }, (_, i) => {
							const row = rows[i];
							return (
								<div key={i} className="grid gap-3 border-b border-line pb-3 last:border-0 sm:grid-cols-[10rem_1fr_9rem_7rem_7rem] sm:border-0 sm:pb-0 [&_input]:mt-0 [&_select]:mt-0">
									<SelectField
										name={`kind_${i}`}
										label={`Row ${i + 1} type`}
										srLabel
										defaultValue={row?.kind === "revenue" ? "revenue" : row?.group === "tools" ? "tools" : "cost"}
										options={[
											{ value: "cost", label: "Running cost" },
											{ value: "tools", label: "Tool I build with" },
											{ value: "revenue", label: "Revenue" },
										]}
									/>
									<TextField name={`service_${i}`} label={`Row ${i + 1} service`} srLabel list="money-services" maxLength={40} defaultValue={row?.service ?? ""} placeholder={i === rows.length ? "Cloudflare" : ""} />
									<SelectField name={`project_${i}`} label={`Row ${i + 1} project`} srLabel defaultValue={row?.projectId ? String(row.projectId) : ""} options={projectOptions} />
									<TextField name={`amount_${i}`} label={`Row ${i + 1} amount in pounds`} srLabel inputMode="decimal" defaultValue={row ? penceInput(row.amountPence) : ""} placeholder="0.00" />
									<SelectField
										name={`billing_${i}`}
										label={`Row ${i + 1} billed`}
										srLabel
										defaultValue={row?.billing ?? "monthly"}
										options={[
											{ value: "monthly", label: "Monthly" },
											{ value: "yearly", label: "Yearly" },
										]}
									/>
									<div className="sm:col-span-5 empty:hidden">
										<FieldError name={`row_${i}`} />
									</div>
								</div>
							);
						})}
					</div>
					<div className="space-y-1 text-xs text-muted">
						<p>Running costs keep the products live (hosting, domains, AI the products use). Tools you build with, like your Claude subscription, are shown separately.</p>
						<p>For a yearly bill, enter the yearly price and choose Yearly: your public page shows a twelfth of it each month, like “Domains (£4.25 a year)”.</p>
						<p>For Anthropic API (AI features), enter what you actually spent this month (Anthropic Console → Cost), not your spend limit.</p>
						<p>Clear a row to remove it. Need more rows? Save, and more appear. Amounts are in pounds, like 12.40.</p>
					</div>
				</SettingsForm>
			</section>

			{months.length > 0 && (
				<section aria-labelledby="months-heading">
					<h2 id="months-heading" className="mb-4 text-[15px] font-medium tracking-tight">
						Every month
					</h2>
					<ul className="divide-y divide-line rounded-2xl border border-line bg-card text-sm">
						{months.map((m) => (
							<li key={m.month}>
								<Link href={adminHref(`/settings/money?month=${m.month}`)} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface">
									<span className="font-medium">{formatLongMonth(m.month)}</span>
									<span className="tabular text-ink-2">
										Running {formatPence(m.runningPence)} · Tools {formatPence(m.toolsPence)} · Revenue {formatPence(m.revenuePence)}
									</span>
								</Link>
							</li>
						))}
					</ul>
				</section>
			)}
		</div>
	);
}
