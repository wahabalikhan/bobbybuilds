-- Each project's card style on the public page (src/lib/card-themes.ts): '' is the standard card.
-- The CHECK only limits the shape of the id (lower-case letters, digits and hyphens, at most 32),
-- not the list of themes: SQLite can't change a CHECK without rebuilding projects (which would
-- cascade-delete every page view), so new themes need no migration. The app checks the list.
ALTER TABLE projects ADD COLUMN card_theme TEXT NOT NULL DEFAULT '' CHECK (length(card_theme) <= 32 AND card_theme NOT GLOB '*[^a-z0-9-]*');

-- The two products that have their own look.
UPDATE projects SET card_theme = 'realtechjobs-blue', updated_at = unixepoch() * 1000 WHERE slug = 'realtechjobs';
UPDATE projects SET card_theme = 'portfolio-pins', updated_at = unixepoch() * 1000 WHERE slug = 'portfolio';
