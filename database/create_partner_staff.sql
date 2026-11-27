-- Partner team table (db_shopping): shop staff + local delivery boys belonging to a partner.
-- The API also creates this automatically on startup (src/lib/commerzaSchema.js); this file is for manual setup / reference.
-- Replaces the old generic dbo.commerza_portal_users table.

CREATE SCHEMA IF NOT EXISTS dbo;

CREATE TABLE IF NOT EXISTS dbo.commerza_partner_staff (
  id SERIAL PRIMARY KEY,
  pmid BIGINT NOT NULL,                                   -- partner (portal_master.pmid) this member belongs to
  user_type VARCHAR(20) NOT NULL DEFAULT 'staff',         -- 'staff' | 'delivery_boy'
  role VARCHAR(40) NOT NULL DEFAULT 'catalog_manager',    -- owner | catalog_manager | order_manager | viewer | delivery_boy
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  password VARCHAR(255) NOT NULL,                         -- scrypt hash ("scrypt$salt$hash"), never returned by the API
  vehicle_type VARCHAR(40) NOT NULL DEFAULT '',
  vehicle_number VARCHAR(40) NOT NULL DEFAULT '',
  license_number VARCHAR(60) NOT NULL DEFAULT '',
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  current_latitude DOUBLE PRECISION,
  current_longitude DOUBLE PRECISION,
  location_updated_at TIMESTAMP,
  last_login_at TIMESTAMP,
  password_changed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by_plid BIGINT,                                 -- partner login (portal_login.plid) that added the member
  created_by_name VARCHAR(150) NOT NULL DEFAULT '',
  updated_by_plid BIGINT,                                 -- partner login that last edited the member
  updated_by_name VARCHAR(150) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_commerza_partner_staff_type CHECK (user_type IN ('staff', 'delivery_boy'))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_commerza_partner_staff_email ON dbo.commerza_partner_staff (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS ux_commerza_partner_staff_phone ON dbo.commerza_partner_staff (phone);
CREATE INDEX IF NOT EXISTS ix_commerza_partner_staff_pmid ON dbo.commerza_partner_staff (pmid, user_type);
