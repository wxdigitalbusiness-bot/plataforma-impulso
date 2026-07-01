-- Limpa strings literais "null" que o n8n legado inseria nos campos de atribuição.
-- JavaScript serializa null como "null" em template literals; esses registros existem
-- com lead_id UUID (criados pelo n8n) e nunca tiveram atribuição real.
UPDATE fb_leads SET ad_id         = NULL WHERE ad_id         = 'null';
UPDATE fb_leads SET utm_source    = NULL WHERE utm_source    = 'null';
UPDATE fb_leads SET ad_name       = NULL WHERE ad_name       = 'null';
UPDATE fb_leads SET ad_title      = NULL WHERE ad_title      = 'null';
UPDATE fb_leads SET ad_body       = NULL WHERE ad_body       = 'null';
UPDATE fb_leads SET source_app    = NULL WHERE source_app    = 'null';
UPDATE fb_leads SET campaign_name = NULL WHERE campaign_name = 'null';
UPDATE fb_leads SET ctwa_clid     = NULL WHERE ctwa_clid     = 'null';
UPDATE fb_leads SET gclid         = NULL WHERE gclid         = 'null';
