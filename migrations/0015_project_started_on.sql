-- "Started on" per project: its charts start here, or when its tracking began if that's later.
-- Tech Jobs and BobbyBuilds started on 31 October 2026; Portfolio on the day its tracking began
-- (its first day with page views in the roll-ups, if it has one yet).
ALTER TABLE projects ADD COLUMN started_on TEXT CHECK (started_on IS NULL OR started_on IS date(started_on));

UPDATE projects SET started_on = '2026-10-31'
WHERE slug IN ('tech-jobs', 'job-board', 'bobbybuilds') OR github_repo = 'wahabalikhan/job_board';

UPDATE projects
SET started_on = (SELECT min(day) FROM daily_totals WHERE daily_totals.project_id = projects.id AND pageviews > 0)
WHERE slug = 'portfolio';
