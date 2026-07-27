# resend-mail-box

React frontend for the Resend mailbox portal: a mail client for reading received
mail, browsing sent mail, and composing with a rich-text editor. Three panes on a
desktop, two on a tablet, and a single drill-down pane on a phone.

Backend lives in [`resend-mail-box-be`](https://github.com/sagar305/resend-mail-box-be).

> **📖 New here? Read [SETUP.md](./SETUP.md).** It is the complete stepwise guide
> for both repositories — Resend, MongoDB, Railway and Vercel setup, every
> environment variable, and links to every library used. This README covers the
> frontend's structure and behaviour specifically.

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

## Deploying to Vercel

`vercel.json` pins the Vite build and, importantly, rewrites `/api/*` to the
backend — the production equivalent of the dev proxy.

1. **Check the host in `vercel.json`.** It already points at this project's
   Railway service; change it only if you deploy your own backend:

   ```json
   { "source": "/api/:path*", "destination": "https://your-backend.up.railway.app/api/:path*" }
   ```

2. **Import the repo** on Vercel. Framework, build command and output directory
   all come from `vercel.json`, so there is nothing to configure in the UI.
3. Deploy. **No environment variables are needed** — and in particular, do not set
   `VITE_API_BASE_URL`; it is inlined at build time and silently overrides this
   rewrite, sending every request cross-origin.

That is the whole setup. Because the browser only ever talks to the Vercel
domain, the session cookie stays **first-party** and no CORS is involved — which
also means preview deployments work without registering each URL.

### The alternative, and why it isn't the default

You can skip the rewrite and have the browser call Railway directly by setting
`VITE_API_BASE_URL=https://your-backend.up.railway.app` in Vercel's environment
variables. The backend then needs `COOKIE_SAMESITE=none` and a matching
`CORS_ORIGIN`.

The catch is that this makes the session cookie a third-party cookie. Safari
blocks those by default and Chrome and Firefox can be configured to, so affected
users simply cannot stay signed in. Use the rewrite unless you have a reason not
to.

## Layout

```
Header (mailbox address, sign out)
├── Sidebar        Compose button, Inbox / Sent / Drafts with unread + draft badges
├── MessageList    the active folder, newest first, with "Load more"
└── MessageView    the selected message, or draft actions
```

Compose opens over the whole layout — a centred card from `sm` up, a full-screen
sheet on a phone.

### Responsive behaviour

| Width | Layout |
| --- | --- |
| `< md` (phones) | One pane at a time. The list fills the screen; opening a message replaces it and the reading pane gets a back button. Folders live in a slide-in drawer behind the hamburger, and Compose is a floating button. |
| `md … lg` (tablets, iPad portrait) | Two panes — list beside the reading pane. Folders stay in the drawer so the content gets the full width. |
| `≥ lg` (desktop, iPad landscape) | Three panes: folder rail, list, reading pane. |

Touch targets are at least 44px, form controls are 16px below `sm` so iOS does not
zoom on focus, the layout uses `dvh` so Safari's collapsing URL bar cannot cut it
off, and the composer footer respects the home-indicator safe area.

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
  This state lives in the backend's MongoDB, not in Resend.
- **Drafts** are saved explicitly with **Save draft** — there is no autosave.
  Sending a draft removes it, since the mail then appears under Sent.
- **Pagination** uses Resend's cursor scheme via "Load more"; there is no search.

## Not included

Light theme only (no dark mode), no attachment picker on compose (received
attachments are listed but not downloadable), and no delete for sent or received
mail — Resend has no delete API.
