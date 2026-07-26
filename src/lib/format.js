/** "Sagar <me@x.com>" -> "me@x.com"; a bare address passes through unchanged. */
export function extractEmail(address) {
  const match = /<([^>]+)>/.exec(String(address ?? ''));
  return (match ? match[1] : String(address ?? '')).trim();
}

/** "Sagar <me@x.com>" -> "Sagar"; falls back to the address' local part. */
export function displayName(address) {
  const value = String(address ?? '').trim();
  const match = /^([^<]+)<[^>]+>$/.exec(value);
  if (match) return match[1].trim().replace(/^["']|["']$/g, '');
  const email = extractEmail(value);
  return email.split('@')[0] || email;
}

/**
 * Label for a list row: the display name when the address carries one,
 * otherwise the full address (a bare local part would be misleading).
 */
export function addressLabel(address) {
  const value = String(address ?? '').trim();
  return /<[^>]+>/.test(value) ? displayName(value) : extractEmail(value);
}

export function initials(address) {
  const name = displayName(address);
  const parts = name.split(/[\s._-]+/).filter(Boolean);
  const letters = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Compact stamp for list rows: time today, "Mar 4" this year, else "Mar 4, 2025". */
export function formatListDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatFullDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PREFIX_PATTERN = {
  reply: /^\s*re\s*:/i,
  forward: /^\s*fwd?\s*:/i,
};

/** Add Re:/Fwd: without stacking a prefix that's already there. */
export function prefixSubject(subject, kind) {
  const clean = String(subject ?? '').replace(/^\((no subject)\)$/i, '').trim();
  const prefix = kind === 'reply' ? 'Re:' : 'Fwd:';
  if (PREFIX_PATTERN[kind].test(clean)) return clean;
  return `${prefix} ${clean}`.trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build the quoted-original block for a reply or forward. The original body is
 * already HTML from Resend, so it is embedded as-is inside the blockquote.
 */
export function quoteMessage(message) {
  const header = `On ${escapeHtml(formatFullDate(message.createdAt))}, ${escapeHtml(message.from)} wrote:`;
  const body = message.html || `<p>${escapeHtml(message.text || '')}</p>`;
  return `<p></p><p>${header}</p><blockquote>${body}</blockquote>`;
}
