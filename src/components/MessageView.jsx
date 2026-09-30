import { useState } from 'react';
import {
  AttachmentIcon,
  BackIcon,
  ClockIcon,
  ForwardIcon,
  MailOpenIcon,
  PencilIcon,
  ReplyIcon,
  TrashIcon,
} from './Icons.jsx';

const TITLES = { inbox: 'Inbox', sent: 'Sent', scheduled: 'Scheduled', drafts: 'Drafts' };
import { api } from '../api/client.js';
import MailBodyFrame from './MailBodyFrame.jsx';
import { formatBytes, formatFullDate, initials } from '../lib/format.js';
import {
  formatScheduledAt,
  fromIsoInstant,
  scheduleBounds,
  toIsoInstant,
} from '../lib/schedule.js';

const STATUS_STYLES = {
  delivered: 'bg-emerald-50 text-emerald-700',
  sent: 'bg-slate-100 text-slate-600',
  queued: 'bg-amber-50 text-amber-700',
  scheduled: 'bg-amber-50 text-amber-700',
  opened: 'bg-blue-50 text-blue-700',
  clicked: 'bg-blue-50 text-blue-700',
  bounced: 'bg-red-50 text-red-700',
  failed: 'bg-red-50 text-red-700',
  complained: 'bg-red-50 text-red-700',
  suppressed: 'bg-red-50 text-red-700',
  canceled: 'bg-slate-100 text-slate-500',
  delivery_delayed: 'bg-amber-50 text-amber-700',
};

function ActionButton({ onClick, children, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
        danger
          ? 'border-slate-300 text-slate-600 hover:bg-red-50 hover:text-red-700'
          : 'border-slate-300 text-slate-700 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

/** A file on a message. Rendered as a download link when `href` is given. */
function AttachmentChip({ attachment, href }) {
  const label = attachment.filename || 'attachment';
  const className =
    'inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600';
  const contents = (
    <>
      <AttachmentIcon className="h-4 w-4 shrink-0 text-slate-400" />
      <span className="max-w-[16rem] truncate">{label}</span>
      {attachment.size ? (
        <span className="text-xs text-slate-400">{formatBytes(attachment.size)}</span>
      ) : null}
    </>
  );

  if (!href) return <span className={className}>{contents}</span>;

  return (
    <a
      href={href}
      // The backend answers with a redirect to Resend's host, where the browser
      // ignores `download` — the file still arrives as one because that URL is
      // served with an attachment disposition.
      download={label}
      target="_blank"
      rel="noopener noreferrer"
      title={`Download ${label}`}
      className={`${className} transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900`}
    >
      {contents}
    </a>
  );
}

/**
 * The reschedule control, folded away until asked for.
 *
 * Moving a scheduled mail is an update, never a cancel followed by a new send:
 * Resend cannot revive a cancelled email, so a failure between the two halves of
 * that pair would destroy the message instead of moving it.
 */
function ReschedulePanel({ message, onReschedule, onDone }) {
  const [value, setValue] = useState(fromIsoInstant(message.scheduledAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const bounds = scheduleBounds();

  const submit = async () => {
    const iso = toIsoInstant(value);
    if (!iso) {
      setError('Pick a date and time first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onReschedule(message, iso);
      onDone();
    } catch (rescheduleError) {
      setError(rescheduleError.message);
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={value}
          min={bounds.min}
          max={bounds.max}
          onChange={(event) => setValue(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="inline-flex min-h-10 items-center rounded-lg bg-slate-900 px-3 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          {busy ? 'Moving…' : 'Move'}
        </button>
        <button
          type="button"
          onClick={onDone}
          disabled={busy}
          className="text-xs font-medium text-slate-500 hover:text-slate-900"
        >
          Cancel
        </button>
      </div>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}

function AddressLine({ label, addresses }) {
  if (!addresses?.length) return null;
  return (
    <p className="text-xs text-slate-500">
      <span className="font-medium text-slate-400">{label}: </span>
      {addresses.join(', ')}
    </p>
  );
}

export default function MessageView({
  folder,
  message,
  loading,
  error,
  onReply,
  onForward,
  onMarkUnread,
  onEditDraft,
  onDeleteDraft,
  onCancelScheduled,
  onReschedule,
  onBack,
  className = '',
}) {
  // Held as the message it belongs to rather than a flag, so selecting a
  // different message closes it instead of leaving it open over the wrong mail.
  const [rescheduleFor, setRescheduleFor] = useState(null);

  if (loading) {
    return <Placeholder className={className}>Loading message…</Placeholder>;
  }
  if (error) {
    return (
      <section className={`min-w-0 flex-1 items-center justify-center bg-white p-8 ${className}`}>
        <p className="max-w-md rounded-lg bg-red-50 p-4 text-sm text-red-700">{error}</p>
      </section>
    );
  }
  if (!message) {
    return <Placeholder className={className}>Select a message to read it.</Placeholder>;
  }

  const isDraft = folder === 'drafts';
  const isInbox = folder === 'inbox';
  const isScheduled = folder === 'scheduled';
  const headline = isInbox ? message.from : (message.to || []).join(', ') || '(no recipient)';

  return (
    <section className={`min-w-0 flex-1 flex-col bg-white ${className}`}>
      <header className="border-b border-slate-200 px-4 py-4 sm:px-6">
        {/* On a phone the reading pane replaces the list, so it needs a way back. */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to list"
          className="-ml-2 mb-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-600 active:bg-slate-100 md:hidden"
        >
          <BackIcon className="h-4 w-4" />
          {TITLES[folder]}
        </button>

        <div className="flex items-start justify-between gap-4">
          <h2 className="text-base font-semibold text-slate-900 sm:text-lg">
            {message.subject || '(no subject)'}
          </h2>
          {message.lastEvent && (
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                STATUS_STYLES[message.lastEvent] || 'bg-slate-100 text-slate-600'
              }`}
            >
              {message.lastEvent.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-700">
            {initials(headline)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {isInbox ? message.from : `To: ${headline}`}
            </p>
            {isInbox && <AddressLine label="To" addresses={message.to} />}
            <AddressLine label="Cc" addresses={message.cc} />
            <AddressLine label="Bcc" addresses={message.bcc} />
            <p className="mt-0.5 text-xs text-slate-400">
              {formatFullDate(message.updatedAt || message.createdAt)}
            </p>
            {isScheduled && (
              <p className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                <ClockIcon className="h-3.5 w-3.5" />
                Sends {formatScheduledAt(message.scheduledAt)}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {isDraft ? (
            <>
              <ActionButton onClick={() => onEditDraft(message)}>
                <PencilIcon className="h-4 w-4" />
                Edit draft
              </ActionButton>
              <ActionButton danger onClick={() => onDeleteDraft(message)}>
                <TrashIcon className="h-4 w-4" />
                Delete
              </ActionButton>
            </>
          ) : isScheduled ? (
            <>
              <ActionButton onClick={() => setRescheduleFor(message.id)}>
                <ClockIcon className="h-4 w-4" />
                Reschedule
              </ActionButton>
              {/* Cancelling is final — Resend cannot bring a cancelled mail back —
                  so the label says cancel the send, not delete the message. */}
              <ActionButton danger onClick={() => onCancelScheduled(message)}>
                <TrashIcon className="h-4 w-4" />
                Cancel send
              </ActionButton>
            </>
          ) : (
            <>
              {isInbox && (
                <ActionButton onClick={() => onReply(message)}>
                  <ReplyIcon className="h-4 w-4" />
                  Reply
                </ActionButton>
              )}
              <ActionButton onClick={() => onForward(message)}>
                <ForwardIcon className="h-4 w-4" />
                Forward
              </ActionButton>
              {isInbox && (
                <ActionButton onClick={() => onMarkUnread(message)}>
                  <MailOpenIcon className="h-4 w-4" />
                  Mark unread
                </ActionButton>
              )}
            </>
          )}
        </div>

        {rescheduleFor === message.id && (
          <ReschedulePanel
            message={message}
            onReschedule={onReschedule}
            onDone={() => setRescheduleFor(null)}
          />
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
        {isDraft || isScheduled ? (
          <div className="mail-body" dangerouslySetInnerHTML={{ __html: message.html || '' }} />
        ) : (
          <MailBodyFrame html={message.html} text={message.text} />
        )}

        {message.attachments?.length > 0 && (
          <div className="mt-6 border-t border-slate-200 pt-4">
            <p className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase">
              {message.attachments.length} attachment
              {message.attachments.length === 1 ? '' : 's'}
            </p>
            <ul className="flex flex-wrap gap-2">
              {message.attachments.map((attachment) => (
                <li key={attachment.id || attachment.filename}>
                  <AttachmentChip
                    attachment={attachment}
                    // Drafts hold no files, and without an id there is nothing to
                    // fetch by — either way the chip stays informational.
                    href={
                      !isDraft && attachment.id
                        ? api.attachmentUrl(folder, message.id, attachment.id)
                        : null
                    }
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function Placeholder({ children, className = '' }) {
  return (
    <section className={`min-w-0 flex-1 items-center justify-center bg-white ${className}`}>
      <p className="text-sm text-slate-400">{children}</p>
    </section>
  );
}
