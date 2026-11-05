-- Each project's current icon, fetched from its live site (icon.svg, then apple-touch-icon, then the
-- largest web manifest icon, then its favicon) and stored here, so cards never depend on the other
-- site being up. Re-checked daily; replaced only when its content changes (hash). A row with no data
-- records a check that found nothing (last_error says why).
CREATE TABLE project_icons (
	project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
	content_type TEXT CHECK (content_type IS NULL OR content_type IN ('image/svg+xml', 'image/png', 'image/x-icon', 'image/jpeg', 'image/webp')),
	data BLOB CHECK (data IS NULL OR length(data) BETWEEN 1 AND 262144),
	-- SHA-256 of the data, hex: part of the icon's URL, so a new icon gets a new URL.
	hash TEXT CHECK (hash IS NULL OR (length(hash) = 64 AND hash NOT GLOB '*[^0-9a-f]*')),
	kind TEXT CHECK (kind IS NULL OR kind IN ('svg', 'apple-touch-icon', 'manifest', 'favicon')),
	source_url TEXT CHECK (source_url IS NULL OR (length(source_url) <= 500 AND source_url GLOB 'https://?*')),
	changed_at INTEGER,
	checked_at INTEGER NOT NULL,
	last_error TEXT CHECK (last_error IS NULL OR length(last_error) <= 200),
	CHECK ((data IS NULL) = (hash IS NULL) AND (data IS NULL) = (content_type IS NULL) AND (data IS NULL) = (kind IS NULL) AND (data IS NULL) = (source_url IS NULL))
) STRICT;
