-- Postgres schema for company and company_document

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name_full text,
  name_short text,
  inn text NOT NULL,
  kpp text,
  ogrn text,
  okpo text,
  oktmo text,
  legal_address text,
  actual_address text,
  email text[],
  phone text[],
  ceo_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_inn_kpp_unique UNIQUE (inn, kpp)
);

CREATE UNIQUE INDEX IF NOT EXISTS company_inn_unique_when_no_kpp
  ON company (inn)
  WHERE kpp IS NULL;

CREATE TABLE IF NOT EXISTS company_document (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company(id) ON DELETE SET NULL,
  file_name text,
  file_sha256 text,
  storage_url text,
  raw_text text,
  extracted_json jsonb,
  confidence jsonb,
  model_version text,
  prompt_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_company_updated_at ON company;
CREATE TRIGGER trg_company_updated_at
BEFORE UPDATE ON company
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
