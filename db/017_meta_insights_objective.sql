-- Migration 017 — Adiciona objective em fb_meta_insights e fb_meta_insights_ads
-- O objective vem da Meta API (LINK_CLICKS, OUTCOME_SALES, OUTCOME_MESSAGES, etc)
-- e permite escolher o tipo de resultado correto pra mostrar como principal.

ALTER TABLE fb_meta_insights
  ADD COLUMN IF NOT EXISTS objective TEXT;

ALTER TABLE fb_meta_insights_ads
  ADD COLUMN IF NOT EXISTS objective TEXT;
