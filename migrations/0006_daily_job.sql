-- Phase 4: what the daily job needs.

-- Core Web Vitals per day (75th percentile, the usual way to report them), so they survive the
-- 90-day clean-up. vitals_samples = page views that reported at least one vital.
ALTER TABLE daily_totals ADD COLUMN lcp_p75_ms INTEGER CHECK (lcp_p75_ms IS NULL OR lcp_p75_ms BETWEEN 0 AND 60000);
ALTER TABLE daily_totals ADD COLUMN cls_p75_milli INTEGER CHECK (cls_p75_milli IS NULL OR cls_p75_milli BETWEEN 0 AND 10000);
ALTER TABLE daily_totals ADD COLUMN inp_p75_ms INTEGER CHECK (inp_p75_ms IS NULL OR inp_p75_ms BETWEEN 0 AND 60000);
ALTER TABLE daily_totals ADD COLUMN vitals_samples INTEGER NOT NULL DEFAULT 0 CHECK (vitals_samples >= 0);

-- Uptime per day, kept after raw uptime_checks are deleted at 90 days.
CREATE TABLE daily_uptime (
	project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
	day TEXT NOT NULL CHECK (day IS date(day)),
	checks INTEGER NOT NULL CHECK (checks >= 0),
	up_checks INTEGER NOT NULL CHECK (up_checks >= 0 AND up_checks <= checks),
	avg_response_ms INTEGER CHECK (avg_response_ms IS NULL OR avg_response_ms BETWEEN 0 AND 60000),
	PRIMARY KEY (project_id, day)
) STRICT, WITHOUT ROWID;

-- One row per job run, for "last roll-up 4 minutes ago" and failures. Deleted after 90 days.
CREATE TABLE job_runs (
	id INTEGER PRIMARY KEY,
	task TEXT NOT NULL CHECK (task IN ('daily', 'frequent')),
	started_at INTEGER NOT NULL CHECK (started_at > 0),
	finished_at INTEGER CHECK (finished_at IS NULL OR finished_at >= started_at),
	ok INTEGER CHECK (ok IS NULL OR ok IN (0, 1)),
	summary TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(summary) AND json_type(summary) = 'object' AND length(summary) <= 8000)
) STRICT;

CREATE INDEX job_runs_task_started ON job_runs (task, started_at);
CREATE INDEX job_runs_started ON job_runs (started_at);
