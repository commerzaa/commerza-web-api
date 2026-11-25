# commerza-web-api

The Express API listens on port **3001** by default (`PORT` in `.env`). The frontend development server listens on port **3000** and proxies API and health requests to this service.

This service uses the existing PostgreSQL databases configured as `PG_AFFILIATE_*` and `PG_SHOPPING_*`; it does not create, migrate, or own the database tables. Product catalog procedures and tables are described in the frontend README. Verify both connections at `GET /health`, which returns per-database ping results.

The configured local shopping database currently responds to health checks, but its catalog is not ready: `ims_usp_product_searching` is missing and `ims_masterproduct`, `ims_subproduct`, and `tbl_category` contain no rows. Restore the migrated schema and product data before expecting live catalog results.