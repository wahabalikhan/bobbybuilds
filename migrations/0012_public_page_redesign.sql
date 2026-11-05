-- Phase 10: the new public page's data.
--   profile         one row: the "This week" line, the date building started, the shipping rhythm switch
--   projects        emoji, hero screenshot (a file in public/screenshots/, alt text required), case
--                   study link, up to 3 outcomes ("{open_jobs} jobs made clear"), and "paused"
--   journey_entries a type and an optional link (the date shown is published_at)
--   money           monthly costs and revenue, per service and optionally per project, in pence

CREATE TABLE profile (
	id INTEGER PRIMARY KEY CHECK (id = 1),
	this_week TEXT NOT NULL DEFAULT '' CHECK (length(this_week) <= 140),
	-- 'YYYY-MM-DD': "days building" counts from here. NULL = not set (not shown).
	building_since TEXT CHECK (building_since IS NULL OR building_since IS date(building_since)),
	show_shipping_rhythm INTEGER NOT NULL DEFAULT 0 CHECK (show_shipping_rhythm IN (0, 1)),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
) STRICT;

INSERT INTO profile (id) VALUES (1);

-- "Paused" is its own column: SQLite can't change the status CHECK without rebuilding projects,
-- and a rebuild would cascade-delete every page view. The app shows one status (paused wins).
ALTER TABLE projects ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1));
ALTER TABLE projects ADD COLUMN emoji TEXT NOT NULL DEFAULT '' CHECK (length(emoji) <= 16);
ALTER TABLE projects ADD COLUMN screenshot_path TEXT CHECK (
	screenshot_path IS NULL OR (
		length(screenshot_path) <= 200
		AND screenshot_path GLOB '/screenshots/?*'
		AND screenshot_path NOT GLOB '*..*'
		AND screenshot_path NOT GLOB '*[^A-Za-z0-9._/-]*'
	)
);
-- A screenshot always has alt text.
ALTER TABLE projects ADD COLUMN screenshot_alt TEXT NOT NULL DEFAULT '' CHECK (
	length(screenshot_alt) <= 300 AND (screenshot_path IS NULL OR length(trim(screenshot_alt)) >= 1)
);
ALTER TABLE projects ADD COLUMN case_study_url TEXT CHECK (case_study_url IS NULL OR (length(case_study_url) <= 300 AND case_study_url GLOB 'https://?*'));
-- JSON array of up to 3 strings, each with {key} placeholders. Element shapes are validated by the app.
ALTER TABLE projects ADD COLUMN outcomes TEXT NOT NULL DEFAULT '[]' CHECK (
	json_valid(outcomes) AND json_type(outcomes) = 'array' AND json_array_length(outcomes) <= 3 AND length(outcomes) <= 1000
);

-- Tech Jobs starts with its two public numbers as outcomes (matched by its repo, as in 0009).
UPDATE projects
SET emoji = '💼',
    outcomes = '["{open_jobs} jobs made clear","{active_companies} companies hiring"]'
WHERE github_repo = 'wahabalikhan/job_board';

ALTER TABLE journey_entries ADD COLUMN type TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('shipped', 'decision', 'lesson', 'post', 'inspired', 'report'));
ALTER TABLE journey_entries ADD COLUMN link_url TEXT CHECK (link_url IS NULL OR (length(link_url) <= 300 AND link_url GLOB 'https://?*'));

CREATE TABLE money (
	id INTEGER PRIMARY KEY,
	-- 'YYYY-MM'
	month TEXT NOT NULL CHECK (length(month) = 7 AND (month || '-01') IS date(month || '-01')),
	kind TEXT NOT NULL CHECK (kind IN ('cost', 'revenue')),
	service TEXT NOT NULL CHECK (length(service) BETWEEN 1 AND 40 AND service = trim(service)),
	-- Optional: what it's for. Shared costs (like the domain) have none.
	project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
	-- Pounds in pence, so sums are exact. Up to £1,000,000.
	amount_pence INTEGER NOT NULL CHECK (amount_pence BETWEEN 0 AND 100000000),
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
) STRICT;

CREATE INDEX money_month ON money (month, kind);
