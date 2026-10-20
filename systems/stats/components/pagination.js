"use strict";

// The stats UI uses section menus rather than page-number navigation.
// This helper is exported for future paginated tables (for example, long leaderboards).
function clampPage(page, totalPages) {
  const total = Math.max(1, Number(totalPages) || 1);
  return Math.min(total - 1, Math.max(0, Number(page) || 0));
}
function paginate(items, page = 0, pageSize = 10) {
  const size = Math.max(1, Number(pageSize) || 10);
  const pages = Math.max(1, Math.ceil(items.length / size));
  const safePage = clampPage(page, pages);
  return { items: items.slice(safePage * size, (safePage + 1) * size), page: safePage, pages, total: items.length };
}
module.exports = { clampPage, paginate };
