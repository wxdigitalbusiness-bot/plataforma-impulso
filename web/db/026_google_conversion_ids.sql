-- Criado automaticamente por setup-google-conversions.mjs em 23/06/2026
-- Conversões "CRM - Lead Qualificado" e "CRM - Lead Convertido" criadas via API Google Ads

-- C.R.O LICITAÇÕES (Google Ads Customer ID: 2473233407)
UPDATE clientes SET
  google_ads_customer_id                  = '2473233407',
  google_conversion_action_id_qualificado = '7659713037',
  google_conversion_action_id             = '7659713160'
WHERE lower(nome) LIKE '%cro%' OR lower(nome) LIKE '%licita%';

-- Caldeiras Santesso (Google Ads Customer ID: 9498712703)
UPDATE clientes SET
  google_ads_customer_id                  = '9498712703',
  google_conversion_action_id_qualificado = '7659609268',
  google_conversion_action_id             = '7659609781'
WHERE lower(nome) LIKE '%santesso%' OR lower(nome) LIKE '%caldeira%';

-- Dra. Blenda Otorrino (Google Ads Customer ID: 7562236009)
UPDATE clientes SET
  google_ads_customer_id                  = '7562236009',
  google_conversion_action_id_qualificado = '7659326576',
  google_conversion_action_id             = '7659326579'
WHERE lower(nome) LIKE '%blenda%' OR lower(nome) LIKE '%otorrino%';

-- Elyon Tendas (Google Ads Customer ID: 8503537103)
UPDATE clientes SET
  google_ads_customer_id                  = '8503537103',
  google_conversion_action_id_qualificado = '7659609802',
  google_conversion_action_id             = '7659609805'
WHERE lower(nome) LIKE '%elyon%' OR lower(nome) LIKE '%tenda%';
