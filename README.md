# resend-mail-box

React frontend for the Resend mailbox portal: a three-pane mail client for
reading received mail, browsing sent mail, and composing with a rich-text editor.

Backend lives in [`resend-mail-box-be`](https://github.com/sagar305/resend-mail-box-be).

## Stack

React 19 · Vite · Tailwind CSS v4 · TipTap 3 · plain JavaScript

## Setup

Start the backend first (defaults to `http://localhost:4000`), then:

```bash
npm install
npm run dev      # http://localhost:5173
```

Vite proxies `/api` to the backend, so the session cookie stays same-origin and
no CORS configuration is needed in development.

| Variable | Purpose |
| --- | --- |
| `VITE_API_PROXY_TARGET` | Dev-only. Backend origin the Vite proxy forwards `/api` to. Defaults to `http://localhost:4000`. |
| `VITE_API_BASE_URL` | Build-time. Set only for a split deploy where the frontend and API are on different origins; leave unset to use the proxy/same-origin. |

```bash
npm run build     # production bundle in dist/
npm run preview   # serve the build locally
npm run lint      # oxlint
```

## Layout

```
Header (mailbox address, sign out)
├── Sidebar        Compose button, Inbox / Sent / Drafts with unread + draft badges
├── MessageList    the active folder, newest first, with "Load more"
└── MessageView    the selected message, or draft actions
```

Compose opens as a modal over the whole layout.

## Behaviour worth knowing

- **Sign-in** is a single username/password held by the backend in env vars. The
  session is an httpOnly cookie, so the frontend never stores a token; on load it
  calls `/api/auth/me` to restore the session, and any `401` mid-session drops
  straight back to the login screen.
- **Message bodies render inside a sandboxed `<iframe>`**, not via
  `dangerouslySetInnerHTML`. Inbound mail is third-party HTML, so the frame omits
  `allow-scripts` — nothing in a message can execute. The frame is auto-sized
  from its own content height, and links open in a new tab.
- **The inbox polls every 60 seconds** while open, and new messages merge into the
  list rather than resetting it. Resend has no push channel to a browser.
- **Reply / Forward** prefill a compose window — recipient, `Re:`/`Fwd:` subject
  (never double-prefixed), and the original quoted in a blockquote. Messages are
  listed flat; there is no conversation threading.
- **Read/unread**: opening a message marks it read; "Mark unread" reverses it.
  This state lives in the backend's SQLite database, not in Resend.
- **Drafts** are saved explicitly with **Save draft** — there is no autosave.
  Sending a draft removes it, since the mail then appears under Sent.
- **Pagination** uses Resend's cursor scheme via "Load more"; there is no search.

## Not included

Desktop-oriented layout (no dedicated mobile breakpoints), light theme only, no
attachment picker on compose (received attachments are listed but not
downloadable), and no delete for sent or received mail — Resend has no delete API.
