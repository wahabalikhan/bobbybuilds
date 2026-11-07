-- The portfolio sends one product number: comments_waiting (comments waiting for Wahab's approval,
-- counted by its Pages Function functions/api/comments-waiting.js). Admin only (is_public 0), so it
-- can't fill a tagline or outcome or reach the public snapshot. /v1/metrics refuses a batch with an
-- unknown key, so this must be live before the portfolio sends it.
INSERT INTO metrics (project_id, key, label, unit, source, is_public, sort_order)
SELECT p.id, 'comments_waiting', 'Comments waiting for approval', '', 'product', 0, (SELECT coalesce(max(sort_order), 0) FROM metrics WHERE project_id = p.id) + 1
FROM projects p
WHERE p.slug = 'portfolio'
ON CONFLICT (project_id, key) DO NOTHING;
