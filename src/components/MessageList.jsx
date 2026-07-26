import { AttachmentIcon, RefreshIcon } from './Icons.jsx';
import { addressLabel, formatListDate, initials } from '../lib/format.js';

const TITLES = { inbox: 'Inbox', sent: 'Sent', drafts: 'Drafts' };

/** Inbox rows key off the sender; Sent and Drafts off the recipients. */
function counterparty(message, folder) {
  if (folder === 'inbox') return addressLabel(message.from);
  const recipients = message.to || [];
  if (!recipients.length) return '(no recipient)';
  const first = addressLabel(recipients[0]);
  return recipients.length > 1 ? `${first} +${recipients.length - 1}` : first;
}

function Avatar({ seed, muted }) {
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
        muted ? 'bg-slate-100 text-slate-500' : 'bg-slate-200 text-slate-700'
      }`}
    >
      {initials(seed)}
    </span>
  );
}

export default function MessageList({
  folder,
  messages,
  selectedId,
  onSelect,
  loading,
  error,
  hasMore,
  onLoadMore,
  loadingMore,
  onRefresh,
}) {
  return (
    <section className="flex w-[22rem] shrink-0 flex-col border-r border-slate-200 bg-white">
      <header className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h1 className="text-sm font-semibold text-slate-900">{TITLES[folder]}</h1>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
          title="Refresh"
          className="rounded p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {error && <p className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        {!error && loading && messages.length === 0 && (
          <p className="p-4 text-sm text-slate-500">Loading…</p>
        )}

        {!error && !loading && messages.length === 0 && (
          <div className="p-6 text-center text-sm text-slate-500">
            <p>Nothing in {TITLES[folder].toLowerCase()} yet.</p>
            {folder === 'inbox' && (
              <p className="mt-2 text-xs text-slate-400">
                Inbound mail only appears once your domain has Resend’s MX record configured.
              </p>
            )}
          </div>
        )}

        <ul>
          {messages.map((message) => {
            const selected = message.id === selectedId;
            const unread = folder === 'inbox' && message.read === false;
            return (
              <li key={message.id}>
                <button
                  type="button"
                  onClick={() => onSelect(message)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors ${
                    selected ? 'bg-slate-100' : 'hover:bg-slate-50'
                  }`}
                >
                  <Avatar seed={counterparty(message, folder)} muted={!unread} />

                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          unread ? 'font-semibold text-slate-900' : 'text-slate-700'
                        }`}
                      >
                        {counterparty(message, folder)}
                      </span>
                      <span className="shrink-0 text-[11px] text-slate-400">
                        {formatListDate(message.updatedAt || message.createdAt)}
                      </span>
                    </span>

                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          unread ? 'font-medium text-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {message.subject || '(no subject)'}
                      </span>
                      {message.attachmentCount > 0 && (
                        <AttachmentIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      )}
                      {unread && <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" />}
                    </span>

                    {folder === 'drafts' && message.text && (
                      <span className="mt-0.5 block truncate text-xs text-slate-400">
                        {message.text}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {hasMore && (
          <div className="p-3">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loadingMore}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
