-- The public GitHub section: contributions per day for the last year (GitHub's own
-- contribution calendar), refreshed hourly by the frequent job. Public data. Days older than
-- the calendar's window are deleted on each refresh.
CREATE TABLE github_contributions (
	day TEXT PRIMARY KEY CHECK (day IS date(day)),
	count INTEGER NOT NULL CHECK (count BETWEEN 0 AND 100000),
	updated_at INTEGER NOT NULL CHECK (updated_at > 0)
) STRICT, WITHOUT ROWID;
