-- Phase 2: the first two projects and their starting numbers.
-- No keys here: create them with `npm run keys:create <slug>`, which stores only the secret key's hash.

INSERT INTO projects (slug, name, tagline, status, site_url, allowed_origins, browser_events, sort_order)
VALUES
	(
		'portfolio',
		'Portfolio',
		'Product design case studies, from research to results.',
		'live',
		'https://wahabalikhan.com',
		'["https://wahabalikhan.com","https://www.wahabalikhan.com"]',
		'["case_study_read","contact_click"]',
		1
	),
	(
		'job-board',
		'Job Board',
		'Only real tech jobs, straight from the company.',
		'building',
		'https://jobboard.wahab-ali-khan.workers.dev',
		'["https://jobboard.wahab-ali-khan.workers.dev"]',
		'[]',
		2
	);

-- Visitors are public and shown in each card's pill to start with; everything else is private.
-- Change these in settings (Phase 5).
INSERT INTO metrics (project_id, key, label, source, is_public, is_headline, sort_order)
SELECT id, 'visitors', 'Visitors', 'collector', 1, 1, 1 FROM projects WHERE slug IN ('portfolio', 'job-board');

INSERT INTO metrics (project_id, key, label, source, sort_order)
SELECT id, 'pageviews', 'Page views', 'collector', 2 FROM projects WHERE slug IN ('portfolio', 'job-board');

INSERT INTO metrics (project_id, key, label, source, sort_order)
SELECT id, 'repeat_visitors', 'Came back the same day', 'collector', 3 FROM projects WHERE slug IN ('portfolio', 'job-board');

-- Returning users as the job board itself counts them, sent through /v1/metrics.
INSERT INTO metrics (project_id, key, label, source, sort_order)
SELECT id, 'returning_users', 'Returning users', 'product', 4 FROM projects WHERE slug = 'job-board';

INSERT INTO metrics (project_id, key, label, source, event_name, sort_order)
SELECT id, 'case_studies_read', 'Case studies read', 'event', 'case_study_read', 5 FROM projects WHERE slug = 'portfolio';
