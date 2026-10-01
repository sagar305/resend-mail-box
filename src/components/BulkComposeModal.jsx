import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api/client.js';
import {
  AttachmentIcon,
  ClockIcon,
  CloseIcon,
  EyeIcon,
  PeopleIcon,
  SentIcon,
} from './Icons.jsx';
import BulkJobProgress from './BulkJobProgress.jsx';
import RecipientTable from './RecipientTable.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import { checkFiles, DEFAULT_LIMITS, readAsAttachment, totalBytes } from '../lib/attachments.js';
import { formatBytes } from '../lib/format.js';
import { formatResetTime, scheduleBounds, toIsoInstant, utcDayOf } from '../lib/schedule.js';

/*
 * Bulk send: one separate, personalized mail per recipient.
 *
 * Deliberately not a mode inside the normal composer. The two write different
 * things — this one has a table of people and a template rather than a message —
 * and a bulk send is not something anyone should reach by accident.
 *
 * The counts are shown while the list is being built rather than checked at the
 * end, because the scheduling cap is per recipient: a sixty-one row list is
 * refused outright, and finding that out after writing the mail is the worst
 * possible moment.
 */

const TOKEN_PATTERN = /\{\{\s*([^{}]+?)\s*\}\}/g;
const normalize = (name) => String(name ?? '').trim().toLowerCase();

/** Every distinct token used in the subject or body. */
function tokensIn(...templates) {
  const found = new Set();
  for (const template of templates) {
    for (const match of String(template ?? '').matchAll(TOKEN_PATTERN)) found.add(normalize(match[1]));
  }
  return [...found];
}

function Tab({ active, onClick, children, count }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex min-h-10 items-center gap-2 border-b-2 px-3 text-sm transition-colors ${
        active
          ? 'border-slate-900 font-semibold text-slate-900'
          : 'border-transparent text-slate-500 hover:text-slate-900'
      }`}
    >
      {children}
      {count !== undefined && (
        <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

export default function BulkComposeModal({ mailboxAddress, onClose, onStarted }) {
  const [tab, setTab] = useState('message');
  const [subject, setSubject] = useState('');
  const [html, setHtml] = useState('');
  const [columns, setColumns] = useState(['name']);
  const [recipients, setRecipients] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [attachmentErrors, setAttachmentErrors] = useState([]);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [serverLimits, setServerLimits] = useState(null);
  const [scheduledAt, setScheduledAt] = useState('');
  const [showSchedule, setShowSchedule] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(null);
  const [job, setJob] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, busy]);

  // Slots are counted per delivery day, so the count has to be for the day being
  // scheduled into. With fifty rows on the table, quoting today's remainder for a
  // send going out next week is the difference between "this fits" and a refusal.
  const scheduleDay = showSchedule ? utcDayOf(scheduledAt) : null;

  useEffect(() => {
    let cancelled = false;
    api.limits(scheduleDay)
      .then((result) => {
        if (cancelled || !result) return;
        if (result.attachments) setLimits(result.attachments);
        setServerLimits(result);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [scheduleDay]);

  const tokens = useMemo(() => tokensIn(subject, html), [subject, html]);

  const scheduling = serverLimits?.scheduling;
  const quota = serverLimits?.quota;
  const bounds = scheduleBounds(scheduling?.maxHorizonDays ?? 30);
  const pendingSchedule = showSchedule && scheduledAt ? toIsoInstant(scheduledAt) : null;

  const validRecipients = recipients.filter((recipient) => recipient.email.trim() !== '');
  const count = validRecipients.length;

  const incomplete = validRecipients.filter((recipient) => tokens.some((token) => {
    const column = columns.find((name) => normalize(name) === normalize(token));
    return !column || String(recipient.vars[column] ?? '').trim() === '';
  }));

  /*
   * Why a send would be refused, worked out here rather than discovered by the
   * server.
   *
   * The two cases charge different allowances. Scheduling spends slots on the
   * delivery day, so a long list is measured against that date's budget — which
   * is what lets a week of mail be laid out in one sitting. An immediate send
   * spends what is left of today, reserve included.
   */
  const blocker = (() => {
    if (!subject.trim()) return 'Add a subject.';
    if (!count) return 'Add at least one recipient.';
    if (incomplete.length) {
      return `${incomplete.length} recipient${incomplete.length === 1 ? '' : 's'} ` +
        `${incomplete.length === 1 ? 'is' : 'are'} missing merge values.`;
    }
    if (pendingSchedule && scheduling && count > scheduling.remaining) {
      return `Scheduling ${count} needs ${count} slots on ${scheduling.day}, and ` +
        `${scheduling.remaining} of ${scheduling.limit} are left that day.`;
    }
    if (!pendingSchedule && quota && count > quota.remaining) {
      const committed = quota.scheduled > 0
        ? ` ${quota.scheduled} is already committed to mail scheduled for today.`
        : '';
      return `Sending ${count} now needs ${count} of today's Resend allowance, and ` +
        `${quota.remaining} of ${quota.limit} are left.${committed}`;
    }
    return null;
  })();

  const attachedBytes = totalBytes(attachments);

  const handleFilesPicked = (event) => {
    const picked = [...event.target.files];
    event.target.value = '';
    if (!picked.length) return;
    const { accepted, errors } = checkFiles(picked, attachments, limits);
    if (accepted.length) setAttachments((current) => [...current, ...accepted]);
    setAttachmentErrors(errors);
  };

  const handleTableChange = ({ columns: nextColumns, recipients: nextRecipients, error: tableError }) => {
    setColumns(nextColumns);
    setRecipients(nextRecipients);
    if (tableError !== undefined) setError(tableError);
  };

  const send = async () => {
    if (blocker) {
      setError(blocker);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const encoded = await Promise.all(attachments.map(readAsAttachment));
      const { job: started } = await api.sendBulk({
        subject,
        html,
        columns,
        recipients: validRecipients,
        attachments: encoded,
        scheduledAt: pendingSchedule,
      });
      setJob(started);
      onStarted?.();
    } catch (sendError) {
      setError(sendError.message);
    } finally {
      setBusy(false);
    }
  };

  /** One recipient's mail as they will receive it. */
  const preview = previewIndex !== null ? validRecipients[previewIndex] : null;
  const renderPreview = (template) => String(template ?? '').replace(TOKEN_PATTERN, (whole, key) => {
    const column = columns.find((name) => normalize(name) === normalize(key));
    const value = column ? preview.vars[column] : undefined;
    return value === undefined || String(value).trim() === '' ? whole : value;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:max-h-[48rem] sm:max-w-5xl sm:rounded-xl sm:shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-slate-900">
            <PeopleIcon className="h-4 w-4" />
            {job ? 'Bulk send' : 'New bulk send'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 rounded p-2.5 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        {job ? (
          <BulkJobProgress job={job} onClose={onClose} onChanged={onStarted} />
        ) : (
          <>
            <div className="flex gap-1 border-b border-slate-200 px-3">
              <Tab active={tab === 'message'} onClick={() => setTab('message')}>Message</Tab>
              <Tab active={tab === 'recipients'} onClick={() => setTab('recipients')} count={count}>
                Recipients
              </Tab>
            </div>

            {tab === 'message' ? (
              <div className="flex min-h-0 flex-1 flex-col">
                <label className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
                  <span className="w-14 shrink-0 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    From
                  </span>
                  <span className="truncate text-sm text-slate-500">{mailboxAddress}</span>
                </label>

                <label className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
                  <span className="w-14 shrink-0 text-xs font-medium tracking-wide text-slate-500 uppercase">
                    Subject
                  </span>
                  <input
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                    value={subject}
                    onChange={(event) => setSubject(event.target.value)}
                    placeholder="Hi {{name}}, a quick update"
                  />
                </label>

                <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                  <RichTextEditor value={html} onChange={setHtml} />
                </div>

                <p className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
                  Type <code className="rounded bg-slate-100 px-1">{'{{column}}'}</code> to drop a
                  recipient’s value in.
                  {tokens.length > 0 && (
                    <> Using: {tokens.map((token) => `{{${token}}}`).join(', ')}.</>
                  )}
                </p>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
                <RecipientTable
                  columns={columns}
                  recipients={recipients}
                  onChange={handleTableChange}
                  requiredTokens={tokens}
                  disabled={busy}
                />
              </div>
            )}

            {attachments.length > 0 && (
              <div className="border-t border-slate-200 px-4 py-2">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                    {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
                    <span className="ml-2 font-normal normal-case text-slate-400">
                      on every mail
                    </span>
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatBytes(attachedBytes)} of {formatBytes(limits.maxTotalBytes)}
                  </p>
                </div>
                <ul className="flex max-h-20 flex-wrap gap-2 overflow-y-auto">
                  {attachments.map((attachment) => (
                    <li
                      key={attachment.id}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1 pr-1 pl-2.5 text-sm text-slate-600"
                    >
                      <AttachmentIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="max-w-[10rem] truncate">{attachment.name}</span>
                      <button
                        type="button"
                        onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}
                        disabled={busy}
                        aria-label={`Remove ${attachment.name}`}
                        className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showSchedule && (
              <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 bg-slate-50 px-4 py-2.5">
                <label className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Send at
                </label>
                <input
                  type="datetime-local"
                  value={scheduledAt}
                  min={bounds.min}
                  max={bounds.max}
                  onChange={(event) => setScheduledAt(event.target.value)}
                  className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => { setShowSchedule(false); setScheduledAt(''); }}
                  className="text-xs font-medium text-slate-500 hover:text-slate-900"
                >
                  Send now instead
                </button>
                {scheduling && (
                  <span className="text-xs text-slate-500">
                    {scheduling.remaining} of {scheduling.limit} slots left for{' '}
                    {scheduleDay ? scheduling.day : 'today'}, resets at{' '}
                    {formatResetTime(scheduling.resetsAt)}
                  </span>
                )}
              </div>
            )}

            {/* The reason a send is refused, stated while there is still something
                to do about it. */}
            {blocker && !error && (
              <p className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                {blocker}
              </p>
            )}
            {attachmentErrors.length > 0 && (
              <ul className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">
                {attachmentErrors.map((message) => <li key={message}>{message}</li>)}
              </ul>
            )}
            {error && (
              <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
            )}

            <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 pb-safe sm:px-4">
              <button
                type="button"
                onClick={send}
                disabled={busy || Boolean(blocker)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {pendingSchedule ? <ClockIcon className="h-4 w-4" /> : <SentIcon className="h-4 w-4" />}
                {busy
                  ? 'Starting…'
                  : `${pendingSchedule ? 'Schedule' : 'Send'} ${count || ''} separate mail${count === 1 ? '' : 's'}`}
              </button>

              {!showSchedule && (
                <button
                  type="button"
                  onClick={() => setShowSchedule(true)}
                  disabled={busy}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                >
                  <ClockIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Schedule</span>
                </button>
              )}

              <input ref={fileInput} type="file" multiple onChange={handleFilesPicked} className="hidden" />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={busy || attachments.length >= limits.maxCount}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <AttachmentIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Attach</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewIndex(0)}
                disabled={busy || !count}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                <EyeIcon className="h-4 w-4" />
                <span className="hidden sm:inline">Preview</span>
              </button>
            </footer>
          </>
        )}
      </div>

      {preview && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">As {preview.email} sees it</p>
                <p className="text-xs text-slate-500 tabular-nums">
                  Recipient {previewIndex + 1} of {count}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                aria-label="Close preview"
                className="rounded p-2 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-3 text-base font-semibold text-slate-900">
                {renderPreview(subject)}
              </p>
              <div
                className="mail-body"
                dangerouslySetInnerHTML={{ __html: renderPreview(html) }}
              />
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}
                disabled={previewIndex === 0}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => setPreviewIndex((index) => Math.min(count - 1, index + 1))}
                disabled={previewIndex >= count - 1}
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}
