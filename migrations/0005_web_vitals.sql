-- Phase 3: Core Web Vitals, sent with the leave beacon for the first view of each page load.
-- CLS is stored multiplied by 1000 so it fits an INTEGER (0.105 → 105).
ALTER TABLE page_views ADD COLUMN lcp_ms INTEGER CHECK (lcp_ms IS NULL OR lcp_ms BETWEEN 0 AND 60000);
ALTER TABLE page_views ADD COLUMN cls_milli INTEGER CHECK (cls_milli IS NULL OR cls_milli BETWEEN 0 AND 10000);
ALTER TABLE page_views ADD COLUMN inp_ms INTEGER CHECK (inp_ms IS NULL OR inp_ms BETWEEN 0 AND 60000);
