import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/authContext.js';
import ComposeModal from '../components/ComposeModal.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageView from '../components/MessageView.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { LogoutIcon } from '../components/Icons.jsx';
import { extractEmail, prefixSubject, quoteMessage } from '../lib/format.js';

const PAGE_SIZE = 20;
// Resend has no push channel to the browser, so the inbox is polled.
const POLL_INTERVAL_MS = 60_000;

const emptyFolder = {
  messages: [],
  hasMore: false,
  loading: false,
  loadingMore: false,
  error: null,
};

const initialStore = { inbox: emptyFolder, sent: emptyFolder, drafts: emptyFolder };

/** Merge a freshly fetched page into what we already hold, newest first. */
function mergeMessages(existing, incoming) {
  const byId = new Map(existing.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, { ...byId.get(message.id), ...message }));
  return [...byId.values()].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

function fetchFolder(folder, params) {
  if (folder === 'inbox') return api.listInbox(params);
  if (folder === 'sent') return api.listSent(params);
  return api.listDrafts().then(({ drafts }) => ({ messages: drafts, hasMore: false }));
}

export default function MailboxPage() {
  const { user, mailboxAddress, logout } = useAuth();

  const [folder, setFolder] = useState('inbox');
  const [store, setStore] = useState(initialStore);
  const [selectedId, setSelectedId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [compose, setCompose] = useState(null); // null | { …prefill }

  const visitedRef = useRef(new Set());

  const patch = useCallback((key, partial) => {
    setStore((current) => ({ ...current, [key]: { ...current[key], ...partial } }));
  }, []);

  // A dead session should drop straight back to the login screen.
  const handleFailure = useCallback(
    (error, apply) => {
      if (error.status === 401) {
        logout();
        return;
      }
      apply(error.message);
    },
    [logout],
  );

  const loadFolder = useCallback(
    async (key, { silent = false } = {}) => {
      if (!silent) patch(key, { loading: true, error: null });
      try {
        const result = await fetchFolder(key, { limit: PAGE_SIZE });
        setStore((current) => ({
          ...current,
          [key]: {
            ...current[key],
            // A silent poll merges; an explicit refresh replaces the list.
            messages: silent
              ? mergeMessages(current[key].messages, result.messages)
              : result.messages,
            hasMore: result.hasMore,
            loading: false,
            error: null,
          },
        }));
      } catch (error) {
        handleFailure(error, (message) => patch(key, { loading: false, error: message }));
      }
    },
    [patch, handleFailure],
  );

  const loadMore = useCallback(
    async (key) => {
      const current = store[key];
      const last = current.messages[current.messages.length - 1];
      if (!last) return;

      patch(key, { loadingMore: true });
      try {
        // Resend paginates by cursor: `after` the last id we hold.
        const result = await fetchFolder(key, { limit: PAGE_SIZE, after: last.id });
        setStore((prev) => ({
          ...prev,
          [key]: {
            ...prev[key],
            messages: mergeMessages(prev[key].messages, result.messages),
            hasMore: result.hasMore,
            loadingMore: false,
          },
        }));
      } catch (error) {
        handleFailure(error, (message) => patch(key, { loadingMore: false, error: message }));
      }
    },
    [store, patch, handleFailure],
  );

  // Inbox and drafts load up front so their sidebar badges are correct even
  // while another folder is on screen; sent loads on first visit.
  useEffect(() => {
    visitedRef.current.add('inbox').add('drafts');
    loadFolder('inbox');
    loadFolder('drafts');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only
  }, []);

  useEffect(() => {
    if (visitedRef.current.has(folder)) return;
    visitedRef.current.add(folder);
    loadFolder(folder);
  }, [folder, loadFolder]);

  useEffect(() => {
    const timer = window.setInterval(() => loadFolder('inbox', { silent: true }), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadFolder]);

  const openMessage = useCallback(
    async (message) => {
      setSelectedId(message.id);
      setDetailError(null);

      if (folder === 'drafts') {
        setSelected(message); // drafts arrive complete, no detail fetch needed
        return;
      }

      setDetailLoading(true);
      setSelected(null);
      try {
        const { message: full } =
          folder === 'inbox'
            ? await api.getInboxMessage(message.id)
            : await api.getSentMessage(message.id);
        setSelected(full);
        if (folder === 'inbox') {
          // Opening it marked it read server-side; mirror that in the list.
          setStore((current) => ({
            ...current,
            inbox: {
              ...current.inbox,
              messages: current.inbox.messages.map((item) =>
                item.id === full.id ? { ...item, read: true } : item,
              ),
            },
          }));
        }
      } catch (error) {
        handleFailure(error, setDetailError);
      } finally {
        setDetailLoading(false);
      }
    },
    [folder, handleFailure],
  );

  const changeFolder = (next) => {
    setFolder(next);
    setSelectedId(null);
    setSelected(null);
    setDetailError(null);
  };

  const handleMarkUnread = async (message) => {
    try {
      await api.setRead(message.id, false);
      setStore((current) => ({
        ...current,
        inbox: {
          ...current.inbox,
          messages: current.inbox.messages.map((item) =>
            item.id === message.id ? { ...item, read: false } : item,
          ),
        },
      }));
      setSelected(null);
      setSelectedId(null);
    } catch (error) {
      handleFailure(error, setDetailError);
    }
  };

  const handleDeleteDraft = async (draft) => {
    try {
      await api.deleteDraft(draft.id);
      setSelected(null);
      setSelectedId(null);
      loadFolder('drafts');
    } catch (error) {
      handleFailure(error, setDetailError);
    }
  };

  const handleReply = (message) => {
    setCompose({
      to: [extractEmail(message.replyTo?.[0] || message.from)],
      subject: prefixSubject(message.subject, 'reply'),
      html: quoteMessage(message),
    });
  };

  const handleForward = (message) => {
    setCompose({
      to: [],
      subject: prefixSubject(message.subject, 'forward'),
      html: quoteMessage(message),
    });
  };

  const handleSent = () => {
    setCompose(null);
    // Marked visited up front so the folder-change effect doesn't also fetch it.
    visitedRef.current.add('sent');
    changeFolder('sent');
    // Resend indexes a new send a moment after it is accepted.
    window.setTimeout(() => loadFolder('sent'), 1200);
  };

  const active = store[folder];
  const unreadCount = store.inbox.messages.filter((message) => message.read === false).length;

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="text-sm font-semibold text-slate-900">Mailbox</span>
          <span className="text-xs text-slate-400">{mailboxAddress}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">{user?.username}</span>
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <Sidebar
          folder={folder}
          onSelectFolder={changeFolder}
          onCompose={() => setCompose({})}
          unreadCount={unreadCount}
          draftCount={store.drafts.messages.length}
        />

        <MessageList
          folder={folder}
          messages={active.messages}
          selectedId={selectedId}
          onSelect={openMessage}
          loading={active.loading}
          error={active.error}
          hasMore={active.hasMore}
          onLoadMore={() => loadMore(folder)}
          loadingMore={active.loadingMore}
          onRefresh={() => loadFolder(folder)}
        />

        <MessageView
          folder={folder}
          message={selected}
          loading={detailLoading}
          error={detailError}
          onReply={handleReply}
          onForward={handleForward}
          onMarkUnread={handleMarkUnread}
          onEditDraft={(draft) => setCompose(draft)}
          onDeleteDraft={handleDeleteDraft}
        />
      </div>

      {compose && (
        <ComposeModal
          key={compose.id || 'new'}
          initial={compose}
          mailboxAddress={mailboxAddress}
          onClose={() => setCompose(null)}
          onSent={handleSent}
          onDraftsChanged={() => loadFolder('drafts')}
        />
      )}
    </div>
  );
}
