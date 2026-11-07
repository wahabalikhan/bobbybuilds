import type { Metadata } from "next";
import Link from "next/link";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { FieldError, Hidden, SelectField, SettingsForm, TextField } from "@/components/admin/form";
import { Breadcrumb, PageHeader, quietButtonClass } from "@/components/admin/ui";
import { ToastOnLoad } from "@/components/admin/toast";
import { requestTime } from "@/lib/admin/clock";
import { previousMonth } from "@/lib/admin/settings-core";
import { isMonth, MONEY_MAX_ROWS } from "@/lib/admin/validate";
import { utcDay } from "@/lib/days";
import { listMonth, listMonths, listServices } from "@/lib/db/money";
import { listRealProjects } from "@/lib/db/projects";
import { formatMonth, formatPence, penceInput } from "@/lib/format";
import { adminHref } from "@/lib/site";
import { copyCostsAction, moneyAction } from "../actions";

export const metadata: Metadata = { title: "Costs and revenue" };

/** Suggested services, plus any used before. */
const SUGGESTED = ["Cloudflare", "Supabase", "Anthropic", "Domains", "Resend", "GitHub", "Figma"];

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
	const cost = rows.filter((r) => r.kind === "cost").reduce((t, r) => t + r.amountPence, 0);
	const revenue = rows.filter((r) => r.kind === "revenue").reduce((t, r) => t + r.amountPence, 0);
	const blank = Math.min(MONEY_MAX_ROWS - rows.length, rows.length ? 3 : 5);
	const projectOptions = [{ value: "", label: "Shared" }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))];
	const hasCosts = rows.some((r) => r.kind === "cost");

	return (
		<div className="max-w-3xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Costs and revenue" }]} />
				<PageHeader title="Costs and revenue" subtitle="What it costs to run everything each month, and what it earns (even £0). The latest month with anything in it is shown on your public page, with its costs by service." />
			</div>

			<nav aria-label="Month" className="flex items-center justify-between gap-3">
				<Link href={adminHref(`/settings/money?month=${previousMonth(month)}`)} className={quietButtonClass}>
					← {formatMonth(previousMonth(month))}
				</Link>
				<h2 className="text-[15px] font-medium tracking-tight" aria-live="polite">
					{formatMonth(month)}
					{month === thisMonth && <span className="ml-2 text-sm font-normal text-muted">this month</span>}
				</h2>
				{month < thisMonth ? (
					<Link href={adminHref(`/settings/money?month=${nextMonth(month)}`)} className={quietButtonClass}>
						{formatMonth(nextMonth(month))} →
					</Link>
				) : (
					<span aria-hidden className="w-24" />
				)}
			</nav>

			<p className="text-sm text-ink-2">
				Costs <span className="font-semibold tabular text-ink">{formatPence(cost)}</span> · Revenue <span className="font-semibold tabular text-ink">{formatPence(revenue)}</span>
			</p>

			{params.copied && hasCosts && <ToastOnLoad tone="success" text={`Copied ${params.copied === "1" ? "1 cost" : `${Number(params.copied) || ""} costs`} from ${formatMonth(previousMonth(month))}. Check the amounts, then save.`} param="copied" />}

			{!hasCosts && (
				<SettingsForm action={copyCostsAction} submitLabel={`Copy costs from ${formatMonth(previousMonth(month))}`}>
					<Hidden name="month" value={month} />
					<p className="text-sm text-muted">Most bills repeat. Copy last month&rsquo;s costs, then change any that differ.</p>
				</SettingsForm>
			)}

			<section className="rounded-2xl border border-line bg-card p-4">
				<SettingsForm action={moneyAction} submitLabel="Save month">
					<Hidden name="month" value={month} />
					<datalist id="money-services">
						{services.map((s) => (
							<option key={s} value={s} />
						))}
					</datalist>
					<div className="hidden grid-cols-[7rem_1fr_9rem_7rem] gap-3 text-xs font-medium text-muted sm:grid" aria-hidden>
						<span>Type</span>
						<span>Service</span>
						<span>Project</span>
						<span>Amount (£)</span>
					</div>
					<div className="space-y-3">
						{Array.from({ length: rows.length + blank }, (_, i) => {
							const row = rows[i];
							return (
								<div key={i} className="grid gap-3 border-b border-line pb-3 last:border-0 sm:grid-cols-[7rem_1fr_9rem_7rem] sm:border-0 sm:pb-0 [&_input]:mt-0 [&_select]:mt-0">
									<SelectField
										name={`kind_${i}`}
										label={`Row ${i + 1} type`}
										srLabel
										defaultValue={row?.kind ?? "cost"}
										options={[
											{ value: "cost", label: "Cost" },
											{ value: "revenue", label: "Revenue" },
										]}
									/>
									<TextField name={`service_${i}`} label={`Row ${i + 1} service`} srLabel list="money-services" maxLength={40} defaultValue={row?.service ?? ""} placeholder={i === rows.length ? "Cloudflare" : ""} />
									<SelectField name={`project_${i}`} label={`Row ${i + 1} project`} srLabel defaultValue={row?.projectId ? String(row.projectId) : ""} options={projectOptions} />
									<TextField name={`amount_${i}`} label={`Row ${i + 1} amount in pounds`} srLabel inputMode="decimal" defaultValue={row ? penceInput(row.amountPence) : ""} placeholder="0.00" />
									<div className="sm:col-span-4 empty:hidden">
										<FieldError name={`row_${i}`} />
									</div>
								</div>
							);
						})}
					</div>
					<p className="text-xs text-muted">Clear a row to remove it. Need more rows? Save, and more appear. Amounts are in pounds, like 12.40.</p>
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
									<span className="font-medium">{formatMonth(m.month)}</span>
									<span className="tabular text-ink-2">
										Costs {formatPence(m.costPence)} · Revenue {formatPence(m.revenuePence)}
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
