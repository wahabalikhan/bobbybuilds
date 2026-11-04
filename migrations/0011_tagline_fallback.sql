-- Taglines can show a project's public product numbers: {key} placeholders (e.g. {open_jobs}),
-- filled from each number's latest daily value. When any can't be filled (private, missing, or
-- over a week old), the fallback tagline is shown instead.
ALTER TABLE projects ADD COLUMN tagline_fallback TEXT NOT NULL DEFAULT '' CHECK (length(tagline_fallback) <= 120);

-- Tech Jobs: matched by its repo too (its slug is job-board in older local databases).
UPDATE projects
SET tagline = '{open_jobs} real tech jobs, straight from {active_companies} companies',
    tagline_fallback = 'Only real tech jobs, straight from the company'
WHERE slug IN ('tech-jobs', 'job-board') OR github_repo = 'wahabalikhan/job_board';
