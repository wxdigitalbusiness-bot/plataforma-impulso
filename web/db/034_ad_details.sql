-- Migration 034 — Detalhes do anúncio Meta Ads armazenados no lead
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS ad_body         TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS ad_title        TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS ad_media_url    TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS ad_name         TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS adset_name      TEXT;
ALTER TABLE fb_leads ADD COLUMN IF NOT EXISTS campaign_name   TEXT;
