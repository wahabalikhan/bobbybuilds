-- Phase 10b: an optional "Now:" line per project (shown small in its public card). The profile's
-- "This week" line moves into Tech Jobs' Now (matched as in 0011) and is then cleared; its column
-- stays, unused.
ALTER TABLE projects ADD COLUMN now_text TEXT NOT NULL DEFAULT '' CHECK (length(now_text) <= 140 AND now_text NOT GLOB '*' || char(10) || '*');

UPDATE projects
SET now_text = (SELECT this_week FROM profile WHERE id = 1)
WHERE (slug IN ('tech-jobs', 'job-board') OR github_repo = 'wahabalikhan/job_board')
  AND (SELECT this_week FROM profile WHERE id = 1) <> '';

UPDATE profile SET this_week = '' WHERE id = 1;
