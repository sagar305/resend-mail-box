import { DraftIcon, InboxIcon, PencilIcon, SentIcon } from './Icons.jsx';

const FOLDERS = [
  { key: 'inbox', label: 'Inbox', Icon: InboxIcon },
  { key: 'sent', label: 'Sent', Icon: SentIcon },
  { key: 'drafts', label: 'Drafts', Icon: DraftIcon },
];

export default function Sidebar({ folder, onSelectFolder, onCompose, unreadCount, draftCount }) {
  const badgeFor = (key) => {
    if (key === 'inbox') return unreadCount > 0 ? unreadCount : null;
    if (key === 'drafts') return draftCount > 0 ? draftCount : null;
    return null;
  };

  return (
    <nav className="flex w-56 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={onCompose}
        className="mb-3 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-700"
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
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
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
