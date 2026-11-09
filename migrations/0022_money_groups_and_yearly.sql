-- Costs in two groups, and yearly bills.
--
--   money.cost_group  'running' (keeps the products live: hosting, domains, AI the products use)
--                     or 'tools' (what I build with, like the Claude subscription). Only costs use
--                     it; revenue rows keep the default.
--   money.billing     'monthly', or 'yearly': amount_pence is then the yearly price, and the public
--                     page shows a twelfth of it as the monthly share.

ALTER TABLE money ADD COLUMN cost_group TEXT NOT NULL DEFAULT 'running' CHECK (cost_group IN ('running', 'tools'));
ALTER TABLE money ADD COLUMN billing TEXT NOT NULL DEFAULT 'monthly' CHECK (billing IN ('monthly', 'yearly'));

-- The rows entered so far (they only exist in the live database).
UPDATE money SET cost_group = 'tools', service = 'Claude subscription' WHERE kind = 'cost' AND service = 'Anthropic' AND project_id IS NULL;
UPDATE money SET service = 'Anthropic API (AI features)' WHERE kind = 'cost' AND service = 'Anthropic monthly limits for API calls';
UPDATE money SET billing = 'yearly' WHERE kind = 'cost' AND service = 'Domains';
