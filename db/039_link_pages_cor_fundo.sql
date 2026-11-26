-- Migration 039 — Cor de fundo customizável na página pública do QR Code/NFC

ALTER TABLE link_pages ADD COLUMN IF NOT EXISTS cor_fundo TEXT;
