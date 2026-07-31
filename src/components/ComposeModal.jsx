import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client.js';
import { AttachmentIcon, CloseIcon, SentIcon, TrashIcon } from './Icons.jsx';
import RichTextEditor from './RichTextEditor.jsx';
import { checkFiles, DEFAULT_LIMITS, readAsAttachment, totalBytes } from '../lib/attachments.js';
import { formatBytes } from '../lib/format.js';

function Field({ label, children }) {
  return (
    <label className="flex items-center gap-3 border-b border-slate-200 px-4 py-2">
      <span className="w-14 shrink-0 text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none';

/**
 * `initial` seeds the form — used for a blank compose, a reply/forward prefill,
 * or an existing draft (in which case it carries an `id`).
 */
export default function ComposeModal({ initial, mailboxAddress, onClose, onSent, onDraftsChanged }) {
  const [draftId, setDraftId] = useState(initial?.id ?? null);
  const [to, setTo] = useState((initial?.to || []).join(', '));
  const [cc, setCc] = useState((initial?.cc || []).join(', '));
  const [bcc, setBcc] = useState((initial?.bcc || []).join(', '));
  const [subject, setSubject] = useState(initial?.subject || '');
  const [html, setHtml] = useState(initial?.html || '');
  const [showCc, setShowCc] = useState(Boolean(initial?.cc?.length || initial?.bcc?.length));
  const [attachments, setAttachments] = useState([]);
  const [attachmentErrors, setAttachmentErrors] = useState([]);
  // Replaced by the server's own numbers as soon as they arrive; the defaults are
  // only what we validate against in the meantime.
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [busy, setBusy] = useState(null); // 'send' | 'draft' | 'discard'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const fileInput = useRef(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    // A failure here is not worth showing: the defaults still catch the obvious
    // cases and the server rejects anything they miss.
    api.limits()
      .then((result) => {
        if (!cancelled && result?.attachments) setLimits(result.attachments);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const attachedBytes = totalBytes(attachments);

  const handleFilesPicked = (event) => {
    const picked = [...event.target.files];
    // Reset first, or picking the same file again fires no change event.
    event.target.value = '';
    if (!picked.length) return;

    const { accepted, errors } = checkFiles(picked, attachments, limits);
    if (accepted.length) setAttachments((current) => [...current, ...accepted]);
    setAttachmentErrors(errors);
  };

  const removeAttachment = (id) => {
    setAttachments((current) => current.filter((attachment) => attachment.id !== id));
    setAttachmentErrors([]);
  };

  const payload = () => ({ to, cc, bcc, subject, html });

  const handleSend = async () => {
    setBusy('send');
    setError(null);
    try {
      // Encoding happens now rather than at pick time so a large file is held as
      // base64 for as short a time as possible.
      const encoded = await Promise.all(attachments.map(readAsAttachment));
      await api.send({ ...payload(), attachments: encoded });
      // The mail now lives in Sent, so the draft it came from is redundant.
      if (draftId) {
        await api.deleteDraft(draftId).catch(() => {});
        onDraftsChanged?.();
      }
      onSent?.();
    } catch (sendError) {
      setError(sendError.message);
      setBusy(null);
    }
  };

  const handleSaveDraft = async () => {
    setBusy('draft');
    setError(null);
    try {
      const result = draftId
        ? await api.updateDraft(draftId, payload())
        : await api.createDraft(payload());
      setDraftId(result.draft.id);
      onDraftsChanged?.();
      // Drafts are stored in MongoDB, where a document caps at 16 MB — the files
      // stay in this window only, so say so rather than losing them silently.
      setNotice(attachments.length ? 'Draft saved without attachments' : 'Draft saved');
      window.setTimeout(() => setNotice(null), 4000);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    if (draftId) {
      setBusy('discard');
      try {
        await api.deleteDraft(draftId);
        onDraftsChanged?.();
      } catch (deleteError) {
        setError(deleteError.message);
        setBusy(null);
        return;
      }
    }
    onClose();
  };

  return (
    // Full-bleed sheet on a phone; a centred card once there is room for one.
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/40 sm:items-center sm:p-4">
      <div className="flex h-full w-full flex-col overflow-hidden bg-white sm:max-h-[46rem] sm:max-w-3xl sm:rounded-xl sm:shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {draftId ? 'Edit draft' : 'New message'}
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

        <Field label="From">
          <span className="truncate text-sm text-slate-500">{mailboxAddress}</span>
        </Field>

        <Field label="To">
          <input
            className={inputClass}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            placeholder="someone@example.com, another@example.com"
            autoComplete="off"
          />
          {!showCc && (
            <button
              type="button"
              onClick={() => setShowCc(true)}
              className="shrink-0 text-xs font-medium text-slate-500 hover:text-slate-900"
            >
              Cc/Bcc
            </button>
          )}
        </Field>

        {showCc && (
          <>
            <Field label="Cc">
              <input
                className={inputClass}
                value={cc}
                onChange={(event) => setCc(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Bcc">
              <input
                className={inputClass}
                value={bcc}
                onChange={(event) => setBcc(event.target.value)}
                autoComplete="off"
              />
            </Field>
          </>
        )}

        <Field label="Subject">
          <input
            className={inputClass}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Subject"
          />
        </Field>

        <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
          <RichTextEditor value={html} onChange={setHtml} />
        </div>

        {attachments.length > 0 && (
          <div className="border-t border-slate-200 px-4 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
              </p>
              <p className="text-xs text-slate-400">
                {formatBytes(attachedBytes)} of {formatBytes(limits.maxTotalBytes)}
              </p>
            </div>
            <ul className="flex max-h-28 flex-wrap gap-2 overflow-y-auto">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-1 pl-3 text-sm text-slate-600"
                >
                  <AttachmentIcon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className="max-w-[12rem] truncate">{attachment.name}</span>
                  <span className="text-xs text-slate-400">{formatBytes(attachment.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    disabled={busy !== null}
                    aria-label={`Remove ${attachment.name}`}
                    className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-900 disabled:opacity-50"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {attachmentErrors.length > 0 && (
          <ul className="border-t border-amber-100 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            {attachmentErrors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        )}

        {error && (
          <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        {/* pb-safe keeps the buttons clear of the iPhone home indicator. */}
        <footer className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-3 py-3 pb-safe sm:px-4">
          <button
            type="button"
            onClick={handleSend}
            disabled={busy !== null}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            <SentIcon className="h-4 w-4" />
            {busy === 'send' ? 'Sending…' : 'Send'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={busy !== null}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50 sm:px-4"
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>

          <input
            ref={fileInput}
            type="file"
            multiple
            onChange={handleFilesPicked}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={busy !== null || attachments.length >= limits.maxCount}
            aria-label="Attach files"
            title={
              attachments.length >= limits.maxCount
                ? `${limits.maxCount} attachments is the limit`
                : 'Attach files'
            }
            className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            <AttachmentIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Attach</span>
          </button>

          {notice && <span className="hidden text-xs text-slate-500 sm:inline">{notice}</span>}

          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy !== null}
            aria-label={draftId ? 'Delete draft' : 'Discard'}
            title={draftId ? 'Delete draft' : 'Discard'}
            className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            <span className="hidden sm:inline">{draftId ? 'Delete draft' : 'Discard'}</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
