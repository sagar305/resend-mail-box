import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/authContext.js';
import ComposeModal from '../components/ComposeModal.jsx';
import MessageList from '../components/MessageList.jsx';
import MessageView from '../components/MessageView.jsx';
import Sidebar from '../components/Sidebar.jsx';
import { LogoutIcon, MenuIcon, PencilIcon } from '../components/Icons.jsx';
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

const initialStore = {
  inbox: emptyFolder,
  sent: emptyFolder,
  scheduled: emptyFolder,
  drafts: emptyFolder,
};

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
  // Scheduled mail is held locally rather than paged from Resend, so it arrives
  // whole and its list ordering is by send time, not by id.
  if (folder === 'scheduled') return api.listScheduled();
  return api.listDrafts().then(({ drafts }) => ({ messages: drafts, hasMore: false }));
}

/**
 * Whether a folder arrives as a complete list rather than a page of one.
 *
 * Merging is right for a paged folder, where an older page must not wipe out a
 * newer one. It is wrong for these: the server's answer is the whole truth, so a
 * cancelled schedule or a deleted draft has to disappear rather than linger
 * because it is still in the copy held here.
 */
function isWholeList(folder) {
  return folder === 'scheduled' || folder === 'drafts';
}

/** Scheduled rows sort by when they go out; everything else by when it arrived. */
function sortForFolder(folder, messages) {
  if (folder !== 'scheduled') return messages;
  return [...messages].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  );
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
  const [bulkOpen, setBulkOpen] = useState(false);
  const [limits, setLimits] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

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
            // A silent poll merges a fresh page in; an explicit refresh, or any
            // folder that arrives complete, replaces what is held.
            messages: sortForFolder(
              key,
              silent && !isWholeList(key)
                ? mergeMessages(current[key].messages, result.messages)
                : result.messages,
            ),
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

  /** The day's remaining allowances, for the sidebar meter. */
  const loadLimits = useCallback(async () => {
    try {
      setLimits(await api.limits());
    } catch {
      // The meter is informative, not load-bearing — the server enforces both
      // caps regardless of whether this number made it to the screen.
    }
  }, []);

  // Inbox, drafts and scheduled load up front so their sidebar badges are
  // correct even while another folder is on screen; sent loads on first visit.
  useEffect(() => {
    visitedRef.current.add('inbox').add('drafts').add('scheduled');
    loadFolder('inbox');
    loadFolder('drafts');
    loadFolder('scheduled');
    loadLimits();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first load only
  }, []);

  useEffect(() => {
    if (visitedRef.current.has(folder)) return;
    visitedRef.current.add(folder);
    loadFolder(folder);
  }, [folder, loadFolder]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadFolder('inbox', { silent: true });
      // Scheduled mail leaves the folder on its own once its time passes, and the
      // day's allowances refill without anyone pressing anything, so both are
      // refreshed on the same beat as the inbox.
      loadFolder('scheduled', { silent: true });
      loadLimits();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [loadFolder, loadLimits]);

  // A draft deleted from inside the composer, or a scheduled mail that has since
  // gone out, must not stay open in the reading pane with dead action buttons.
  useEffect(() => {
    if (!isWholeList(folder) || !selectedId) return;
    const held = store[folder];
    if (held.loading) return;
    if (!held.messages.some((message) => message.id === selectedId)) {
      setSelectedId(null);
      setSelected(null);
    }
  }, [folder, selectedId, store]);

  const openMessage = useCallback(
    async (message) => {
      setSelectedId(message.id);
      setDetailError(null);

      // Drafts and scheduled mail are stored here rather than at Resend, so the
      // list already carries the whole message — there is nothing to fetch.
      if (folder === 'drafts' || folder === 'scheduled') {
        setSelected(message);
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

  /** Also what the phone's back button calls to return to the list. */
  const clearSelection = () => {
    setSelectedId(null);
    setSelected(null);
    setDetailError(null);
  };

  const changeFolder = (next) => {
    setFolder(next);
    clearSelection();
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

  const handleCancelScheduled = async (message) => {
    try {
      await api.cancelScheduled(message.id);
      setSelected(null);
      setSelectedId(null);
      // The slot goes back to the day, so the meter is stale until it reloads.
      loadFolder('scheduled');
      loadLimits();
    } catch (error) {
      handleFailure(error, setDetailError);
    }
  };

  /**
   * Rescheduling can move the mail to a different day, which moves its slot
   * between two days' counts — so the meter is reloaded even though nothing was
   * sent or cancelled. Errors are rethrown for the panel to show inline, since
   * the reason is usually the target day being full.
   */
  const handleReschedule = async (message, scheduledAt) => {
    try {
      const { message: updated } = await api.reschedule(message.id, scheduledAt);
      setSelected(updated);
      loadFolder('scheduled');
      loadLimits();
    } catch (error) {
      if (error.status === 401) logout();
      throw error;
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

  /** `scheduled` when the compose window scheduled the mail instead of sending it. */
  const handleSent = (result) => {
    setCompose(null);
    loadLimits();

    if (result?.scheduledAt) {
      // It has not been sent, so landing in Sent would show an empty folder and
      // leave someone wondering where the mail went.
      loadFolder('scheduled');
      changeFolder('scheduled');
      return;
    }

    // Marked visited up front so the folder-change effect doesn't also fetch it.
    visitedRef.current.add('sent');
    changeFolder('sent');
    // Resend indexes a new send a moment after it is accepted.
    window.setTimeout(() => loadFolder('sent'), 1200);
  };

  const active = store[folder];
  const unreadCount = store.inbox.messages.filter((message) => message.read === false).length;

  // Below md there is only room for one pane, so opening a message replaces the
  // list and the reading pane gets a back button. From md up both are visible.
  const readingOnPhone = Boolean(selectedId || detailLoading || detailError);

  const sidebarProps = {
    folder,
    onCompose: () => {
      setCompose({});
      setDrawerOpen(false);
    },
    onBulkCompose: () => {
      setBulkOpen(true);
      setDrawerOpen(false);
    },
    unreadCount,
    draftCount: store.drafts.messages.length,
    scheduledCount: store.scheduled.messages.length,
    limits,
  };

  return (
    <div className="flex h-full flex-col">
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-2 py-2 sm:px-4 sm:py-2.5">
        <div className="flex min-w-0 items-center gap-1 sm:gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open folders"
            className="rounded-lg p-2.5 text-slate-600 active:bg-slate-100 lg:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold text-slate-900">Mailbox</span>
          <span className="hidden min-w-0 truncate text-xs text-slate-400 sm:block">
            {mailboxAddress}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-3">
          <span className="hidden text-xs text-slate-500 sm:block">{user?.username}</span>
          <button
            type="button"
            onClick={logout}
            aria-label="Sign out"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <LogoutIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Static column on desktop. */}
        <Sidebar
          {...sidebarProps}
          onSelectFolder={changeFolder}
          className="hidden w-56 shrink-0 border-r border-slate-200 lg:flex"
        />

        {/* Slide-in drawer below lg — an iPad in portrait gets this too, which
            leaves the full width for the list and the message. */}
        {drawerOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              aria-label="Close folders"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-slate-900/40"
            />
            <Sidebar
              {...sidebarProps}
              onSelectFolder={(next) => {
                changeFolder(next);
                setDrawerOpen(false);
              }}
              onClose={() => setDrawerOpen(false)}
              className="absolute top-0 left-0 h-full w-64 max-w-[80%] shadow-xl"
            />
          </div>
        )}

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
          className={`${readingOnPhone ? 'hidden md:flex' : 'flex w-full'}`}
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
          onCancelScheduled={handleCancelScheduled}
          onReschedule={handleReschedule}
          onBack={clearSelection}
          className={`${readingOnPhone ? 'flex' : 'hidden md:flex'}`}
        />
      </div>

      {/* Below lg the folder rail is a drawer, so Compose would be hidden behind
          it. Compose is the primary action, so it gets a floating button. */}
      {!compose && !drawerOpen && (
        <button
          type="button"
          onClick={() => setCompose({})}
          aria-label="Compose"
          className="fixed right-4 bottom-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition-transform active:scale-95 lg:hidden"
          style={{ bottom: 'max(1rem, env(safe-area-inset-bottom))' }}
        >
          <PencilIcon className="h-5 w-5" />
        </button>
      )}

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
