-- Tech Jobs sends board_jobs_included from the browser when someone turns on "Include jobs from
-- other job boards" and applies it. Add it to Tech Jobs' browser events, keeping any already there.
-- The project is tech-jobs live and still job-board in older local databases.
UPDATE projects
SET browser_events = json_insert(browser_events, '$[#]', 'board_jobs_included'),
    updated_at = unixepoch() * 1000
WHERE slug IN ('tech-jobs', 'job-board')
  AND NOT EXISTS (SELECT 1 FROM json_each(projects.browser_events) WHERE value = 'board_jobs_included');
