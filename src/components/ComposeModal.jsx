import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { CloseIcon, SentIcon, TrashIcon } from './Icons.jsx';
import RichTextEditor from './RichTextEditor.jsx';

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
  const [busy, setBusy] = useState(null); // 'send' | 'draft' | 'discard'
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const payload = () => ({ to, cc, bcc, subject, html });

  const handleSend = async () => {
    setBusy('send');
    setError(null);
    try {
      await api.send(payload());
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
      setNotice('Draft saved');
      window.setTimeout(() => setNotice(null), 2000);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="flex h-full max-h-[46rem] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">
            {draftId ? 'Edit draft' : 'New message'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-slate-500 hover:bg-slate-200 hover:text-slate-900"
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

        <div className="flex min-h-0 flex-1 flex-col p-4">
          <RichTextEditor value={html} onChange={setHtml} />
        </div>

        {error && (
          <p className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
        )}

        <footer className="flex items-center gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={handleSend}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            <SentIcon className="h-4 w-4" />
            {busy === 'send' ? 'Sending…' : 'Send'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={busy !== null}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
          >
            {busy === 'draft' ? 'Saving…' : 'Save draft'}
          </button>

          {notice && <span className="text-xs text-slate-500">{notice}</span>}

          <button
            type="button"
            onClick={handleDiscard}
            disabled={busy !== null}
            title={draftId ? 'Delete draft' : 'Discard'}
            className="ml-auto inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
          >
            <TrashIcon className="h-4 w-4" />
            {draftId ? 'Delete draft' : 'Discard'}
          </button>
        </footer>
      </div>
    </div>
  );
}
