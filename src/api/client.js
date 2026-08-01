// In dev this stays empty and Vite proxies /api to the backend. For a split
// deploy set VITE_API_BASE_URL to the backend origin.
//
// Note this is inlined at BUILD time. A same-origin /api rewrite existing on the
// host does not mean the app uses it — if this was set when the bundle was built,
// every request goes cross-origin regardless of any rewrite.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

export const API_BASE_URL = BASE_URL;

/**
 * True when requests leave the page's own origin, which makes the session a
 * third-party cookie. WebKit — every browser on iOS, including Chrome — blocks
 * those by default, so it is worth being able to state this plainly.
 */
export function isCrossOrigin() {
  if (!BASE_URL) return false;
  try {
    return new URL(BASE_URL, window.location.href).origin !== window.location.origin;
  } catch {
    return false;
  }
}

export class ApiError extends Error {
  constructor(status, message, code) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?', 'network_error');
  }

  if (response.status === 204) return null;

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.message || `Request failed (${response.status})`,
      payload?.error?.code,
    );
  }
  return payload;
}

function withQuery(path, params) {
  const query = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const api = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),

  listInbox: (params) => request(withQuery('/mail/inbox', params)),
  getInboxMessage: (id) => request(`/mail/inbox/${id}`),
  /**
   * A URL for the browser to navigate to, not something to fetch: the backend
   * answers with a redirect to Resend's signed download URL. It has to be
   * resolved per click, since those URLs expire — so this stays a link the
   * browser follows, never a URL captured ahead of time.
   */
  attachmentUrl: (folder, id, attachmentId) =>
    `${BASE_URL}/api/mail/${folder}/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachmentId)}`,
  setRead: (id, read) => request(`/mail/inbox/${id}/read`, { method: 'PATCH', body: { read } }),

  listSent: (params) => request(withQuery('/mail/sent', params)),
  getSentMessage: (id) => request(`/mail/sent/${id}`),

  send: (payload) => request('/mail/send', { method: 'POST', body: payload }),
  limits: () => request('/mail/limits'),

  listDrafts: () => request('/drafts'),
  createDraft: (payload) => request('/drafts', { method: 'POST', body: payload }),
  updateDraft: (id, payload) => request(`/drafts/${id}`, { method: 'PUT', body: payload }),
  deleteDraft: (id) => request(`/drafts/${id}`, { method: 'DELETE' }),
  sendDraft: (id) => request(`/drafts/${id}/send`, { method: 'POST' }),
};
