'use strict';

// app.js — DOM wiring and state management for LinkVault.
//
// Every piece of dynamic content is written with textContent or
// createElement+appendChild.  innerHTML is NEVER used with any
// server-returned or user-supplied value (AGENTS.md hard rule).
//
// Import the API module — the browser resolves this relative to the
// current script URL because both files are type="module".
import { createLink, listLinks, deleteLink, getLinkStats } from './api.js';

// ── Element references ───────────────────────────────────────
const createForm     = document.getElementById('create-form');
const inputUrl       = document.getElementById('input-url');
const inputAlias     = document.getElementById('input-alias');
const inputExpires   = document.getElementById('input-expires');
const btnCreate      = document.getElementById('btn-create');
const formError      = document.getElementById('form-error');

const resultCard     = document.getElementById('result-card');
const resultShortUrl = document.getElementById('result-short-url');
const resultClicks   = document.getElementById('result-clicks');
const resultExpiryMeta = document.getElementById('result-expiry-meta');
const btnCopy        = document.getElementById('btn-copy');

const loadingState   = document.getElementById('loading-state');
const emptyState     = document.getElementById('empty-state');
const tableWrapper   = document.getElementById('table-wrapper');
const linksBody      = document.getElementById('links-body');
const tableError     = document.getElementById('table-error');

// Stats Modal elements (Phase 5)
const statsDialog         = document.getElementById('stats-dialog');
const statsDialogTitle     = document.getElementById('stats-dialog-title');
const statsTotalClicks     = document.getElementById('stats-total-clicks');
const statsChartContainer = document.getElementById('stats-chart-container');
const statsDialogMsg       = document.getElementById('stats-dialog-msg');
const btnCloseStats        = document.getElementById('btn-close-stats');

// ── Utility: format expiry date for display ──────────────────
/**
 * Return a human-readable expiry string.
 * Returns 'Never' when expiresAt is null/undefined.
 * Returns a locale date string otherwise.
 */
function formatExpiry(expiresAt) {
  if (!expiresAt) return 'Never';
  return new Date(expiresAt).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

// ── Error display helpers ────────────────────────────────────
/**
 * Show an error message inside the form error element.
 * Uses textContent — never innerHTML — to prevent XSS.
 */
function showFormError(msg) {
  if (!msg) {
    clearFormError();
    return;
  }
  formError.textContent = msg;
  formError.hidden = false;
}

function clearFormError() {
  formError.textContent = '';
  formError.hidden = true;
}

/**
 * Show a banner error above the links table.
 */
function showTableError(msg) {
  if (!msg) {
    clearTableError();
    return;
  }
  tableError.textContent = msg;
  tableError.hidden = false;
}

function clearTableError() {
  tableError.textContent = '';
  tableError.hidden = true;
}

// ── Submit button state helpers ──────────────────────────────
/**
 * Replace button text with a spinner + label while the request is live.
 * Returns a function that restores the original state.
 */
function setSubmitting(isSubmitting) {
  if (isSubmitting) {
    // Build spinner element
    const spinner = document.createElement('span');
    spinner.className = 'spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.textContent = 'Shortening…';

    btnCreate.replaceChildren(spinner, label);
    btnCreate.disabled = true;
  } else {
    btnCreate.textContent = 'Shorten URL';
    btnCreate.disabled = false;
  }
}

// ── Result card ──────────────────────────────────────────────
/**
 * Populate and reveal the result card after a successful create.
 *
 * @param {object} link  - the link object returned by the server
 */
function showResult(link) {
  // href is set via setAttribute with the raw URL — safe because the
  // server has already validated it as http(s)://.
  resultShortUrl.setAttribute('href', link.shortUrl);
  resultShortUrl.textContent = link.shortUrl;  // textContent, not innerHTML

  resultClicks.textContent = String(link.clicks ?? 0);

  if (link.expiresAt) {
    resultExpiryMeta.textContent = `Expires: ${formatExpiry(link.expiresAt)}`;
  } else {
    resultExpiryMeta.textContent = 'No expiry';
  }

  resultCard.hidden = false;

  // Copy button: store the URL in a data attribute, not innerHTML.
  btnCopy.dataset.url = link.shortUrl;
  btnCopy.textContent = 'Copy';
  btnCopy.classList.remove('copied');
}

// ── Copy to clipboard ────────────────────────────────────────
async function handleCopy() {
  const url = btnCopy.dataset.url;
  if (!url) return;

  try {
    await navigator.clipboard.writeText(url);
    btnCopy.textContent = '✓ Copied';
    btnCopy.classList.add('copied');
    setTimeout(() => {
      btnCopy.textContent = 'Copy';
      btnCopy.classList.remove('copied');
    }, 2000);
  } catch {
    // Clipboard API may be blocked in non-secure contexts or by permissions.
    btnCopy.textContent = 'Failed';
    setTimeout(() => { btnCopy.textContent = 'Copy'; }, 2000);
  }
}

// ── Table rendering ──────────────────────────────────────────
/**
 * Show loading, hide table and empty state.
 */
function setTableLoading(loading) {
  loadingState.hidden = !loading;
  if (loading) {
    tableWrapper.hidden = true;
    emptyState.hidden = true;
  }
}

/**
 * Render the empty state (no links exist).
 */
function renderEmpty() {
  loadingState.hidden = true;
  emptyState.hidden = false;
  tableWrapper.hidden = true;
}

/**
 * Build a single <tr> for a link object.
 * All text is set via textContent; href and title use setAttribute.
 *
 * @param {object} link
 * @returns {HTMLTableRowElement}
 */
function createRow(link) {
  const tr = document.createElement('tr');

  // ── Short code cell ──
  const tdCode = document.createElement('td');
  tdCode.className = 'col-code';
  const anchor = document.createElement('a');
  // The short URL comes from the server and is always http(s):// — safe.
  anchor.setAttribute('href', link.shortUrl);
  anchor.setAttribute('target', '_blank');
  anchor.setAttribute('rel', 'noopener noreferrer');
  anchor.textContent = link.code;
  tdCode.appendChild(anchor);

  // ── Destination URL cell ──
  const tdLong = document.createElement('td');
  tdLong.className = 'col-long-url';
  // Truncate long URLs visually; show full URL in tooltip via title attribute.
  // setAttribute is safe here because title is not rendered as HTML.
  tdLong.setAttribute('title', link.longUrl);
  const displayUrl =
    link.longUrl.length > 55 ? link.longUrl.slice(0, 52) + '…' : link.longUrl;
  tdLong.textContent = displayUrl;

  // ── Expiry cell ──
  const tdExpiry = document.createElement('td');
  tdExpiry.className = 'col-expiry';
  tdExpiry.textContent = formatExpiry(link.expiresAt);

  // ── Clicks cell ──
  const tdClicks = document.createElement('td');
  tdClicks.className = 'col-clicks';
  tdClicks.textContent = String(link.clicks ?? 0);

  // ── Status badge cell ──
  const tdStatus = document.createElement('td');
  const badge = document.createElement('span');
  if (link.status === 'expired') {
    badge.className = 'badge badge-expired';
    badge.textContent = 'Expired';
  } else {
    badge.className = 'badge badge-active';
    badge.textContent = 'Active';
  }
  tdStatus.appendChild(badge);

  // ── Actions cell ──
  const tdActions = document.createElement('td');
  tdActions.className = 'col-actions';

  const btnStats = document.createElement('button');
  btnStats.type = 'button';
  btnStats.className = 'btn btn-stats';
  btnStats.textContent = 'Stats';
  btnStats.setAttribute('aria-label', `View analytics for short link ${link.code}`);
  btnStats.addEventListener('click', () => handleShowStats(link.code));
  tdActions.appendChild(btnStats);

  const btnDel = document.createElement('button');
  btnDel.type = 'button';
  btnDel.className = 'btn btn-danger';
  btnDel.textContent = 'Delete';
  // Store the code in dataset so the click handler can read it.
  btnDel.dataset.code = link.code;
  btnDel.setAttribute('aria-label', `Delete short link ${link.code}`);
  btnDel.addEventListener('click', () => handleDelete(link.code, tr));
  tdActions.appendChild(btnDel);

  tr.appendChild(tdCode);
  tr.appendChild(tdLong);
  tr.appendChild(tdExpiry);
  tr.appendChild(tdClicks);
  tr.appendChild(tdStatus);
  tr.appendChild(tdActions);

  return tr;
}

/**
 * Render (or re-render) the full links table.
 *
 * @param {object[]} links
 */
function renderTable(links) {
  // Clear existing rows.
  linksBody.replaceChildren();

  links.forEach(link => {
    linksBody.appendChild(createRow(link));
  });

  loadingState.hidden = true;
  emptyState.hidden = true;
  tableWrapper.hidden = false;
}

// ── Load links from the API ──────────────────────────────────
async function loadLinks() {
  clearTableError();
  setTableLoading(true);

  try {
    const data = await listLinks();
    const links = data?.links ?? [];

    if (links.length === 0) {
      renderEmpty();
    } else {
      renderTable(links);
    }
  } catch (err) {
    showTableError(err.message || 'Failed to load links.');
    // Keep loading, empty, and table states mutually exclusive
    emptyState.hidden = true;
    tableWrapper.hidden = true;
  } finally {
    setTableLoading(false);
  }
}

// ── Delete handler ───────────────────────────────────────────
/**
 * Ask for confirmation, then delete the link and animate the row out.
 *
 * @param {string} code   The short code
 * @param {HTMLTableRowElement} rowEl  The <tr> to remove on success
 */
async function handleDelete(code, rowEl) {
  // window.confirm is synchronous and sufficient for this project scope.
  // It avoids building a custom focus-trap modal.
  const confirmed = window.confirm(
    `Delete the short link "/${code}"?\n\nThis cannot be undone.`
  );
  if (!confirmed) return;

  clearTableError();
  // Animate row out first for a snappy feel.
  rowEl.classList.add('row-deleting');

  try {
    await deleteLink(code);

    // Wait for CSS animation (300 ms) then remove the row.
    setTimeout(() => {
      rowEl.remove();
      // If the table is now empty, switch to the empty state.
      if (linksBody.children.length === 0) {
        renderEmpty();
      }
    }, 320);
  } catch (err) {
    // Revert animation if delete failed.
    rowEl.classList.remove('row-deleting');
    showTableError(err.message || 'Failed to delete link.');
  }
}

// ── Form submit handler ──────────────────────────────────────
async function handleCreate(event) {
  event.preventDefault();
  clearFormError();

  const url      = inputUrl.value.trim();
  const alias    = inputAlias.value.trim();
  const expiresAt = inputExpires.value; // ISO-like string from datetime-local

  // Client-side presence check; server validates the actual content.
  if (!url) {
    showFormError('Please enter a destination URL.');
    inputUrl.focus();
    return;
  }

  setSubmitting(true);

  try {
    const link = await createLink({
      url,
      alias: alias || undefined,
      expiresAt: expiresAt || undefined,
    });

    // Clear any previous table-level error banner
    clearTableError();

    // Show the result card.
    showResult(link);

    // Prepend the new row to the table (or replace the empty/error state).
    if (!tableWrapper.hidden && linksBody.children.length > 0) {
      // Table is already visible and has rows — prepend the new row.
      linksBody.insertBefore(createRow(link), linksBody.firstChild);
    } else {
      // Table was hidden (empty or error state) — render the table with this row.
      renderTable([link]);
    }

    // Reset the form.
    createForm.reset();
    inputUrl.focus();
  } catch (err) {
    showFormError(err.message);
  } finally {
    setSubmitting(false);
  }
}

// ── Stats Dialog and SVG Chart Rendering ─────────────────────
const SVG_NS = 'http://www.w3.org/2000/svg';

function clearStatsDialog() {
  statsChartContainer.replaceChildren();
  statsDialogMsg.textContent = '';
  statsDialogMsg.hidden = true;
}

function renderStatsChart(last7Days) {
  statsChartContainer.replaceChildren();

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 320 140');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', '7-day click activity bar chart');

  const maxClicks = Math.max(...last7Days.map(d => d.clicks), 0);
  const chartHeight = 85;
  const baseY = 110;
  const barWidth = 26;
  const gap = 16;
  const startX = 18;

  // Baseline rule
  const baseline = document.createElementNS(SVG_NS, 'line');
  baseline.setAttribute('x1', '10');
  baseline.setAttribute('y1', String(baseY));
  baseline.setAttribute('x2', '310');
  baseline.setAttribute('y2', String(baseY));
  baseline.setAttribute('class', 'chart-baseline');
  svg.appendChild(baseline);

  last7Days.forEach((day, index) => {
    const x = startX + index * (barWidth + gap);
    const height = maxClicks > 0 && day.clicks > 0
      ? Math.max(Math.round((day.clicks / maxClicks) * chartHeight), 4)
      : 0;
    const y = baseY - height;

    // Bar rectangle
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(x));
    rect.setAttribute('y', String(y));
    rect.setAttribute('width', String(barWidth));
    rect.setAttribute('height', String(height));
    rect.setAttribute('rx', '3');
    rect.setAttribute('class', 'chart-bar');
    rect.setAttribute('tabindex', '0');
    rect.setAttribute('role', 'graphics-symbol');
    rect.setAttribute('aria-label', `${day.date}: ${day.clicks} clicks`);

    const title = document.createElementNS(SVG_NS, 'title');
    title.textContent = `${day.date}: ${day.clicks} clicks`;
    rect.appendChild(title);
    svg.appendChild(rect);

    // Click count label above bar
    if (day.clicks > 0) {
      const valText = document.createElementNS(SVG_NS, 'text');
      valText.setAttribute('x', String(x + barWidth / 2));
      valText.setAttribute('y', String(y - 4));
      valText.setAttribute('class', 'chart-value');
      valText.textContent = String(day.clicks);
      svg.appendChild(valText);
    }

    // Date label below baseline (MM/DD)
    const labelText = document.createElementNS(SVG_NS, 'text');
    labelText.setAttribute('x', String(x + barWidth / 2));
    labelText.setAttribute('y', String(baseY + 16));
    labelText.setAttribute('class', 'chart-label');
    const parts = day.date.split('-');
    labelText.textContent = parts.length === 3 ? `${parts[1]}/${parts[2]}` : day.date;
    svg.appendChild(labelText);
  });

  statsChartContainer.appendChild(svg);

  // If zero clicks across the entire 7 days, show a helpful message
  if (maxClicks === 0) {
    const emptyNote = document.createElement('p');
    emptyNote.className = 'stats-empty-notice';
    emptyNote.textContent = 'No clicks recorded in the last 7 days.';
    statsChartContainer.appendChild(emptyNote);
  }
}

async function handleShowStats(code) {
  clearStatsDialog();
  statsDialogTitle.textContent = `/${code}`;
  statsTotalClicks.textContent = '…';

  if (typeof statsDialog.showModal === 'function') {
    statsDialog.showModal();
  } else {
    statsDialog.setAttribute('open', '');
  }

  try {
    const stats = await getLinkStats(code);
    statsTotalClicks.textContent = String(stats.totalClicks ?? 0);
    renderStatsChart(stats.last7Days ?? []);
  } catch (err) {
    statsTotalClicks.textContent = '–';
    statsDialogMsg.textContent = err.message || 'Failed to load statistics.';
    statsDialogMsg.hidden = false;
  }
}

// ── Wire up event listeners ──────────────────────────────────
createForm.addEventListener('submit', handleCreate);
btnCopy.addEventListener('click', handleCopy);

// Stats dialog close events
if (btnCloseStats) {
  btnCloseStats.addEventListener('click', () => statsDialog.close());
}
if (statsDialog) {
  statsDialog.addEventListener('click', (event) => {
    // Close dialog if backdrop is clicked
    if (event.target === statsDialog) {
      statsDialog.close();
    }
  });
}

// Clear the form error as soon as the user starts typing again.
inputUrl.addEventListener('input', clearFormError);
inputAlias.addEventListener('input', clearFormError);

// ── Kick off on page load ────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadLinks);
