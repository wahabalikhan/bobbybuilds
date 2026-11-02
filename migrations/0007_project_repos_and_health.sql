-- Phase 4: GitHub repos (checked with the GitHub API) and health URLs for uptime pings.
UPDATE projects
SET github_repo = 'wahabalikhan/portfolio', health_url = 'https://wahabalikhan.com/', updated_at = unixepoch() * 1000
WHERE slug = 'portfolio';

UPDATE projects
SET github_repo = 'wahabalikhan/job_board', health_url = 'https://jobboard.wahab-ali-khan.workers.dev/', updated_at = unixepoch() * 1000
WHERE slug = 'job-board';
