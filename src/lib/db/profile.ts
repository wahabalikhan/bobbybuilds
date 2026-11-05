/**
 * The profile row (migration 0012): the "This week" line, the date building started and the
 * shipping rhythm switch. There's always exactly one row (id 1).
 */
export type Profile = {
	thisWeek: string;
	/** 'YYYY-MM-DD', or null when it isn't set. */
	buildingSince: string | null;
	showShippingRhythm: boolean;
};

export async function getProfile(db: D1Database): Promise<Profile> {
	const row = await db
		.prepare("SELECT this_week, building_since, show_shipping_rhythm FROM profile WHERE id = 1")
		.first<{ this_week: string; building_since: string | null; show_shipping_rhythm: number }>();
	return { thisWeek: row?.this_week ?? "", buildingSince: row?.building_since ?? null, showShippingRhythm: row?.show_shipping_rhythm === 1 };
}

export async function saveProfile(db: D1Database, profile: Profile): Promise<void> {
	await db
		.prepare(
			`INSERT INTO profile (id, this_week, building_since, show_shipping_rhythm, updated_at) VALUES (1, ?1, ?2, ?3, ?4)
			 ON CONFLICT (id) DO UPDATE SET this_week = ?1, building_since = ?2, show_shipping_rhythm = ?3, updated_at = ?4`,
		)
		.bind(profile.thisWeek, profile.buildingSince, profile.showShippingRhythm ? 1 : 0, Date.now())
		.run();
}
