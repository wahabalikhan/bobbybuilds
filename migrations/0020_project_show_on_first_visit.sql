-- New projects stay off the public page until their first visit arrives, then the 5-minute job
-- shows them (show_public = 1) and clears this flag. Saving "Show on my public page" by hand
-- clears it too, so your own choice always wins.
ALTER TABLE projects ADD COLUMN show_on_first_visit INTEGER NOT NULL DEFAULT 0 CHECK (show_on_first_visit IN (0, 1));
