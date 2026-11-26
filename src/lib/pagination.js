'use strict';

/** Parses page & limit query params with safe bounds. */
function parsePagination(query = {}, defaultLimit = 25, maxLimit = 200) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
}

/** Builds standard pagination metadata envelope. */
function buildPagination(page, limit, total) {
  const totalCount = Number(total || 0);
  return {
    page,
    limit,
    total: totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / limit)),
  };
}

module.exports = { parsePagination, buildPagination };
