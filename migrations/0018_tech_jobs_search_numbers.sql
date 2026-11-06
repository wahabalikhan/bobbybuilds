-- Tech Jobs sends two more product numbers with open_jobs and active_companies: searches_failed
-- (searches that failed that day) and median_search_ms (the median time of the ones that worked,
-- in milliseconds). Admin only, so not public. /v1/metrics refuses a whole batch with an unknown
-- key, so until these exist none of Tech Jobs' numbers are saved.
-- The project is tech-jobs live and still job-board in older local databases.
INSERT INTO metrics (project_id, key, label, unit, source, is_public, sort_order)
SELECT p.id, n.key, n.label, n.unit, 'product', 0, (SELECT coalesce(max(sort_order), 0) FROM metrics WHERE project_id = p.id) + n.pos
FROM projects p
JOIN (
	SELECT 'searches_failed' AS key, 'Failed searches' AS label, '' AS unit, 1 AS pos
	UNION ALL SELECT 'median_search_ms', 'Median search time', 'ms', 2
) n
WHERE p.slug IN ('tech-jobs', 'job-board')
ON CONFLICT (project_id, key) DO NOTHING;
