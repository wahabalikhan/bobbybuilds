import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SettingsForm, TextField } from "@/components/admin/form";
import { Switch } from "@/components/admin/switch";
import { Breadcrumb } from "@/components/admin/ui";
import { requestTime } from "@/lib/admin/clock";
import { daysBetween } from "@/lib/admin/range";
import { utcDay } from "@/lib/days";
import { getProfile } from "@/lib/db/profile";
import { formatWhole } from "@/lib/format";
import { adminHref } from "@/lib/site";
import { profileAction } from "../actions";

export const metadata: Metadata = { title: "Profile" };

/** The profile bits of the public page: the days building and the Activity switch. ("This week" is now each project's Now, in its Settings.) */
export default async function ProfilePage() {
	const { env } = await getCloudflareContext({ async: true });
	const profile = await getProfile(env.DB);
	const today = utcDay(requestTime());
	const days = profile.buildingSince && profile.buildingSince <= today ? daysBetween(profile.buildingSince, today).length : null;
	return (
		<div className="max-w-2xl space-y-6">
			<div className="space-y-3">
				<Breadcrumb items={[{ label: "Home", href: adminHref() }, { label: "Profile" }]} />
				<h1 className="text-2xl font-bold tracking-tight">Profile</h1>
			</div>
			<SettingsForm action={profileAction}>
				<div className="sm:w-56">
					<TextField
						type="date"
						name="building_since"
						label="Building since"
						defaultValue={profile.buildingSince ?? ""}
						hint={days === null ? "Days building count from this date." : `That's day ${formatWhole(days)}.`}
					/>
				</div>
				<div className="rounded-2xl border border-line">
					<Switch
						id="show_activity"
						name="show_activity"
						label="Show my activity"
						hint="An Activity section on your public page: how many Shipped journey entries you've written each month, and your GitHub contributions over the last year."
						checked={profile.showActivity}
					/>
				</div>
			</SettingsForm>
		</div>
	);
}
