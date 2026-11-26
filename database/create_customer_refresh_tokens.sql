-- Refresh tokens for shopping-site customer logins (db_shopping).
-- One row per login session: clhid = dbo.tbl_customerloginhistory.clhid (the access token's `lsid`),
-- clid = dbo.tbl_customerlogin.clid. Only a SHA-256 hex hash of the refresh token is stored; the hash is
-- replaced on every POST /api/CustomerRefreshToken (rotation) and the row is deleted on logout.
-- The API (src/modules/customer-auth.js) also creates this table if it is missing.
-- Safe to run more than once.
--
--   psql -h 127.0.0.1 -U postgres -d db_shopping -f database/create_customer_refresh_tokens.sql

create schema if not exists dbo;

create table if not exists dbo.commerza_customer_refresh_tokens (
  clhid bigint primary key,
  clid bigint not null,
  token_hash char(64) not null,
  expires_at timestamp not null,
  created_at timestamp not null default localtimestamp,
  rotated_at timestamp
);

create index if not exists ix_commerza_customer_refresh_tokens_clid
  on dbo.commerza_customer_refresh_tokens (clid);
