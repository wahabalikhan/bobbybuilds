-- Tech Jobs sends one more product number: review_waiting (companies waiting for Wahab's review in
-- Tech Jobs' own admin). Admin only (is_public 0), so it can't fill a tagline or outcome or reach the
-- public snapshot. /v1/metrics refuses a whole batch with an unknown key, so this must be live before
-- Tech Jobs starts sending it.
-- The project is tech-jobs live and still job-board in older local databases.
INSERT INTO metrics (project_id, key, label, unit, source, is_public, sort_order)
SELECT p.id, 'review_waiting', 'Companies waiting for review', '', 'product', 0, (SELECT coalesce(max(sort_order), 0) FROM metrics WHERE project_id = p.id) + 1
FROM projects p
WHERE p.slug IN ('tech-jobs', 'job-board')
ON CONFLICT (project_id, key) DO NOTHING;
