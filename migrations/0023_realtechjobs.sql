-- Tech Jobs is now RealTechJobs, at https://realtechjobs.co.uk (techjobs.bobbybuilds.app redirects
-- there). Same project row, so every visit, roll-up, number and journey entry stays with it.
--
--   name, slug       RealTechJobs, realtechjobs (the admin address and the public icon's file name)
--   site_url         the new home, so uptime, the icon and "Visit site" use it
--   allowed_origins  the new origin, keeping the old one (it only redirects now). Replaces the
--                    mistyped "https://realtechjobs.co.uk." (a trailing dot never matches a browser's
--                    Origin, so visits from the new domain weren't being counted).
--
-- Matched as in 0011: the slug is tech-jobs live and job-board in older local databases.
UPDATE projects
SET slug = 'realtechjobs',
    name = 'RealTechJobs',
    site_url = 'https://realtechjobs.co.uk/',
    health_url = 'https://realtechjobs.co.uk/',
    allowed_origins = '["https://realtechjobs.co.uk","https://techjobs.bobbybuilds.app"]',
    updated_at = unixepoch() * 1000
WHERE slug IN ('tech-jobs', 'job-board') OR github_repo = 'wahabalikhan/job_board';
