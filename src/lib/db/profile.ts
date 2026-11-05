/**
 * The profile row (migration 0012): the date building started and the "Show my activity" switch
 * (stored as show_shipping_rhythm). There's always exactly one row (id 1). (Its this_week column
 * is no longer used: that line moved to each project's Now in migration 0013.)
 */
export type Profile = {
	/** 'YYYY-MM-DD', or null when it isn't set. */
	buildingSince: string | null;
	/** The public Activity section (shipping rhythm and GitHub activity). */
	showActivity: boolean;
};

export async function getProfile(db: D1Database): Promise<Profile> {
	const row = await db
		.prepare("SELECT building_since, show_shipping_rhythm FROM profile WHERE id = 1")
		.first<{ building_since: string | null; show_shipping_rhythm: number }>();
	return { buildingSince: row?.building_since ?? null, showActivity: row?.show_shipping_rhythm === 1 };
}

export async function saveProfile(db: D1Database, profile: Profile): Promise<void> {
	await db
		.prepare(
			`INSERT INTO profile (id, building_since, show_shipping_rhythm, updated_at) VALUES (1, ?1, ?2, ?3)
			 ON CONFLICT (id) DO UPDATE SET building_since = ?1, show_shipping_rhythm = ?2, updated_at = ?3`,
		)
		.bind(profile.buildingSince, profile.showActivity ? 1 : 0, Date.now())
		.run();
}
