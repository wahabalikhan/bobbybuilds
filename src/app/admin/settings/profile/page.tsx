import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SettingsForm, TextField } from "@/components/admin/form";
import { Switch } from "@/components/admin/switch";
import { Breadcrumb, PageHeader } from "@/components/admin/ui";
import { requestTime } from "@/lib/admin/clock";
import { daysBetween } from "@/lib/admin/range";
import { utcDay } from "@/lib/days";
import { getProfile } from "@/lib/db/profile";
import { formatWhole } from "@/lib/format";
import { adminHref } from "@/lib/site";
import { profileAction } from "../actions";

export const metadata: Metadata = { title: "Public page" };

/** Public page (stored as the profile): the days building and the Activity switch. ("This week" is now each project's Now, in its Settings.) */
export default async function ProfilePage() {
	const { env } = await getCloudflareContext({ async: true });
	const profile = await getProfile(env.DB);
	const today = utcDay(requestTime());
	const days = profile.buildingSince && profile.buildingSince <= today ? daysBetween(profile.buildingSince, today).length : null;
	return (
		<div className="max-w-2xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Public page" }]} />
				<PageHeader title="Public page" subtitle="What your public page says about you." />
			</div>
			<SettingsForm action={profileAction}>
				<div className="sm:w-96">
					<TextField
						type="date"
						name="building_since"
						label="Started building"
						defaultValue={profile.buildingSince ?? ""}
						hint={`Shown as “Day ${formatWhole(days ?? 1)}” on your public page.`}
					/>
				</div>
				<div className="rounded-2xl border border-line">
					<Switch
						id="show_activity"
						name="show_activity"
						label="Show the Activity section on your public page"
						hint="Journey entries each month and GitHub activity."
						checked={profile.showActivity}
					/>
				</div>
			</SettingsForm>
		</div>
	);
}
