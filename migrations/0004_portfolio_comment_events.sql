-- The portfolio saves comments straight from the browser to Supabase, so comment events come
-- from t.js rather than a server. Allow them as browser events.
UPDATE projects
SET browser_events = '["case_study_read","contact_click","comments_opened","comment_posted"]',
    updated_at = unixepoch() * 1000
WHERE slug = 'portfolio';
