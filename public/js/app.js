'use strict';

// app.js — DOM wiring and state management for LinkVault.
//
// Every piece of dynamic content is written with textContent or
// createElement+appendChild.  innerHTML is NEVER used with any
// server-returned or user-supplied value (AGENTS.md hard rule).
//
// Import the API module — the browser resolves this relative to the
// current script URL because both files are type="module".
import { createLink, listLinks, deleteLink } from './api.js';

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

  tableWrapper.hidden = false;
  emptyState.hidden = true;
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
    showTableError(err.message);
    renderEmpty(); // show empty state so the table area isn't just a spinner
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
    clearTableError();
    showTableError(err.message);
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

    // Show the result card.
    showResult(link);

    // Prepend the new row to the table (or replace the empty state).
    if (!tableWrapper.hidden) {
      // Table is already visible — prepend the new row.
      linksBody.insertBefore(createRow(link), linksBody.firstChild);
    } else {
      // Table was hidden (empty state) — render the table with this row.
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

// ── Wire up event listeners ──────────────────────────────────
createForm.addEventListener('submit', handleCreate);
btnCopy.addEventListener('click', handleCopy);

// Clear the form error as soon as the user starts typing again.
inputUrl.addEventListener('input', clearFormError);
inputAlias.addEventListener('input', clearFormError);

// ── Kick off on page load ────────────────────────────────────
document.addEventListener('DOMContentLoaded', loadLinks);
