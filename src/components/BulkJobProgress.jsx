import { useEffect, useState } from 'react';
import { api } from '../api/client.js';

/*
 * A running bulk send, polled until it settles.
 *
 * The job outlives the request that started it — sixty recipients take about
 * thirty seconds at Resend's rate limit — so this is the only view of what is
 * actually happening, and it has to be honest about partial outcomes. A send
 * where forty-seven went and three did not is the normal case worth designing
 * for, not an error state.
 */

const POLL_MS = 2000;

const STATUS_LABEL = {
  running: 'Sending',
  completed: 'Sent',
  completed_with_failures: 'Finished with failures',
  halted: 'Stopped',
};

const STATUS_STYLE = {
  running: 'bg-blue-50 text-blue-700',
  completed: 'bg-emerald-50 text-emerald-700',
  completed_with_failures: 'bg-amber-50 text-amber-800',
  halted: 'bg-red-50 text-red-700',
};

export default function BulkJobProgress({ job: initialJob, onClose, onChanged }) {
  const [job, setJob] = useState(initialJob);
  const [retrying, setRetrying] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (job.status !== 'running') {
      // A finished job changed what is in Sent and what the day has left.
      onChanged?.();
      return undefined;
    }

    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const { job: fresh } = await api.getBulkJob(job.id);
        if (!cancelled) setJob(fresh);
      } catch (pollError) {
        if (!cancelled) setError(pollError.message);
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job.id, job.status, onChanged]);

  const { total, sent, failed } = job.totals;
  const done = sent + failed;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  const failures = (job.recipients || []).filter((recipient) => recipient.status === 'failed');

  const retry = async () => {
    setRetrying(true);
    setError(null);
    try {
      const { job: fresh } = await api.retryBulkJob(job.id);
      setJob(fresh);
    } catch (retryError) {
      setError(retryError.message);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{job.subject}</p>
          <p className="text-xs text-slate-500 tabular-nums">
            {sent} sent{failed > 0 && `, ${failed} failed`} of {total}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
            STATUS_STYLE[job.status] || 'bg-slate-100 text-slate-600'
          }`}
        >
          {STATUS_LABEL[job.status] || job.status}
        </span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full rounded-full transition-[width] ${
            failed > 0 ? 'bg-amber-500' : 'bg-slate-900'
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>

      {job.status === 'running' && (
        <p className="text-xs text-slate-500">
          Sending one mail per recipient, paced to stay inside Resend’s rate limit. You can close
          this — it keeps going.
        </p>
      )}

      {job.error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{job.error}</p>
      )}
      {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {failures.length > 0 && (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200">
          <table className="w-full border-collapse text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  Did not send
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-left text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {failures.map((recipient) => (
                <tr key={recipient.id}>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-700">
                    {recipient.email}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-500">
                    {recipient.error || 'Unknown error'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {job.status !== 'running' && (failed > 0 || job.status === 'halted') && (
          <button
            type="button"
            onClick={retry}
            disabled={retrying}
            className="inline-flex min-h-11 items-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
          >
            {/* Only the ones that did not go — retrying the whole job would mail
                everyone who already received it a second time. */}
            {retrying ? 'Retrying…' : 'Retry the ones that failed'}
          </button>
        )}
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-11 items-center rounded-lg border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
        >
          Close
        </button>
      </div>
    </div>
  );
}
