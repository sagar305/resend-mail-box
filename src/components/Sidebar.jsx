import { CloseIcon, DraftIcon, InboxIcon, PencilIcon, SentIcon } from './Icons.jsx';

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', Icon: InboxIcon },
  { key: 'sent', label: 'Sent', Icon: SentIcon },
  { key: 'drafts', label: 'Drafts', Icon: DraftIcon },
];

/**
 * Rendered twice: as a static column from `lg` up, and inside the slide-in
 * drawer below that. `className` is how the caller switches between the two.
 */
export default function Sidebar({
  folder,
  onSelectFolder,
  onCompose,
  unreadCount,
  draftCount,
  className = '',
  onClose,
}) {
  const badgeFor = (key) => {
    if (key === 'inbox') return unreadCount > 0 ? unreadCount : null;
    if (key === 'drafts') return draftCount > 0 ? draftCount : null;
    return null;
  };

  return (
    <nav className={`flex flex-col gap-1 bg-white p-3 ${className}`}>
      {/* Only rendered in the drawer. Tapping the scrim also closes it, but most
          of the scrim sits behind the drawer, so an explicit control is clearer. */}
      {onClose && (
        <div className="mb-1 flex items-center justify-between pl-1">
          <span className="text-sm font-semibold text-slate-900">Folders</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close folders"
            className="-mr-1 rounded-lg p-2.5 text-slate-500 active:bg-slate-100"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onCompose}
        className="mb-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        <PencilIcon className="h-4 w-4" />
        Compose
      </button>

      {FOLDERS.map(({ key, label, Icon }) => {
        const active = folder === key;
        const badge = badgeFor(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelectFolder(key)}
            aria-current={active ? 'page' : undefined}
            // min-h-11 keeps every row at a comfortable touch target size.
            className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors ${
              active ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">{label}</span>
            {badge !== null && (
              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                {badge}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
