-- A "Building" journey type (🛠, work in progress). SQLite can't change a CHECK in place, so
-- journey_entries is rebuilt with 'building' allowed, keeping every row, id and index. Nothing
-- references journey_entries, so dropping the old table deletes nothing else.
CREATE TABLE journey_entries_new (
	id INTEGER PRIMARY KEY,
	slug TEXT NOT NULL UNIQUE CHECK (length(slug) BETWEEN 1 AND 80 AND slug NOT GLOB '*[^a-z0-9-]*'),
	title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 120),
	-- Markdown. Sanitised before display.
	body_md TEXT NOT NULL DEFAULT '' CHECK (length(body_md) <= 50000),
	-- Optional: an entry can be about one project or the journey overall.
	project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
	is_published INTEGER NOT NULL DEFAULT 0 CHECK (is_published IN (0, 1)),
	published_at INTEGER,
	created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
	type TEXT NOT NULL DEFAULT 'post' CHECK (type IN ('shipped', 'building', 'decision', 'lesson', 'post', 'inspired', 'report')),
	link_url TEXT CHECK (link_url IS NULL OR (length(link_url) <= 300 AND link_url GLOB 'https://?*')),
	CHECK (is_published = 0 OR published_at IS NOT NULL)
) STRICT;

INSERT INTO journey_entries_new (id, slug, title, body_md, project_id, is_published, published_at, created_at, updated_at, type, link_url)
SELECT id, slug, title, body_md, project_id, is_published, published_at, created_at, updated_at, type, link_url FROM journey_entries;

DROP TABLE journey_entries;
ALTER TABLE journey_entries_new RENAME TO journey_entries;

CREATE INDEX journey_entries_published ON journey_entries (is_published, published_at);
CREATE INDEX journey_entries_project ON journey_entries (project_id, published_at);
