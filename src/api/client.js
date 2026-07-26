// In dev this stays empty and Vite proxies /api to the backend. For a split
// deploy set VITE_API_BASE_URL to the backend origin.
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

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
  setRead: (id, read) => request(`/mail/inbox/${id}/read`, { method: 'PATCH', body: { read } }),

  listSent: (params) => request(withQuery('/mail/sent', params)),
  getSentMessage: (id) => request(`/mail/sent/${id}`),

  send: (payload) => request('/mail/send', { method: 'POST', body: payload }),

  listDrafts: () => request('/drafts'),
  createDraft: (payload) => request('/drafts', { method: 'POST', body: payload }),
  updateDraft: (id, payload) => request(`/drafts/${id}`, { method: 'PUT', body: payload }),
  deleteDraft: (id) => request(`/drafts/${id}`, { method: 'DELETE' }),
  sendDraft: (id) => request(`/drafts/${id}/send`, { method: 'POST' }),
};
