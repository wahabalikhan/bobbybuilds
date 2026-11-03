-- Tech Jobs' public card shows "N open jobs · N companies" from the latest daily values of its
-- public product numbers. So exactly these two are public, labelled to read that way, and its
-- other product numbers are private (they can be changed in Settings afterwards).
-- Matched by the repo, which is the same everywhere (the slug is tech-jobs live and job-board in
-- older local databases). Does nothing where the rows don't exist.
UPDATE metrics SET is_public = 1, label = 'Open jobs'
WHERE source = 'product' AND key = 'open_jobs'
  AND project_id IN (SELECT id FROM projects WHERE github_repo = 'wahabalikhan/job_board');

UPDATE metrics SET is_public = 1, label = 'Companies'
WHERE source = 'product' AND key = 'active_companies'
  AND project_id IN (SELECT id FROM projects WHERE github_repo = 'wahabalikhan/job_board');

UPDATE metrics SET is_public = 0
WHERE source = 'product' AND key NOT IN ('open_jobs', 'active_companies')
  AND project_id IN (SELECT id FROM projects WHERE github_repo = 'wahabalikhan/job_board');
