-- BobbyBuilds tracks itself, in the admin only.
--
-- show_public: whether a project appears on the public page at all (its card, the public chart,
-- the totals, the dropdown and the share images). Every project is shown unless switched off.
ALTER TABLE projects ADD COLUMN show_public INTEGER NOT NULL DEFAULT 1 CHECK (show_public IN (0, 1));

-- The BobbyBuilds project: the public pages of bobbybuilds.app (never /admin). Its public key is
-- the one in src/lib/site.ts (site.trackerKey), which the public pages' t.js snippet uses. Public
-- keys aren't secret: they're in every page's HTML. It has no secret key (it only sends from the
-- browser); one can be made later under Settings → Connection, which keeps this public key.
INSERT OR IGNORE INTO projects (slug, name, tagline, status, site_url, health_url, allowed_origins, public_key, keys_created_at, show_public, sort_order)
VALUES (
	'bobbybuilds',
	'BobbyBuilds',
	'This page, and the dashboard every project reports to.',
	'live',
	'https://bobbybuilds.app',
	'https://bobbybuilds.app',
	'["https://bobbybuilds.app"]',
	'pk_ocrQh00fwJXI1yFLCW7DaCN3',
	unixepoch() * 1000,
	0,
	1
);

-- Like every new project, it starts with visitors as its headline number (only ever shown publicly
-- if "Show on my public page" is switched on).
INSERT OR IGNORE INTO metrics (project_id, key, label, source, is_public, is_headline, sort_order)
SELECT id, 'visitors', 'Visitors', 'collector', 1, 1, 1 FROM projects WHERE slug = 'bobbybuilds';

-- The order everywhere (admin and public): BobbyBuilds, Portfolio, Tech Jobs.
-- Tech Jobs is matched by its repo too (its slug is job-board in older local databases).
UPDATE projects SET sort_order = 2 WHERE slug = 'portfolio';
UPDATE projects SET sort_order = 3 WHERE slug IN ('tech-jobs', 'job-board') OR github_repo = 'wahabalikhan/job_board';
