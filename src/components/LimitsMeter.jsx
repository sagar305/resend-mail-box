import { formatResetTime } from '../lib/schedule.js';

/*
 * What a date's Resend allowance is committed to.
 *
 * Accounting is per delivery day, so this is a budget for a date rather than a
 * tally of what has been done today. Scheduling fifty for Monday moves Monday's
 * numbers, not this one — which is why the sidebar says "today" explicitly and
 * the composer asks about its own day separately.
 *
 * Two bars because the two numbers mean different things. The top one is how much
 * of the date can still be booked in advance; the bottom is the whole allowance,
 * including the slice held back so that inbound mail and anything sent by hand
 * still work on a fully booked day.
 *
 * Both windows are UTC — Resend's daily quota is a UTC calendar day — so the
 * reset is printed in the reader's own timezone, because an allowance that
 * refills at half past five in the morning looks like a bug until you know why.
 */

function Bar({ used, limit, tone }) {
  const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full transition-[width] ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

/** Amber once the day is mostly spent, red when there is nothing left. */
function scheduledTone(remaining, limit) {
  if (remaining === 0) return 'bg-red-500';
  if (remaining <= limit * 0.2) return 'bg-amber-500';
  return 'bg-slate-900';
}

export default function LimitsMeter({ limits, className = '' }) {
  const scheduling = limits?.scheduling;
  const quota = limits?.quota;
  if (!scheduling && !quota) return null;

  const resetsAt = formatResetTime(scheduling?.resetsAt || quota?.resetsAt);

  return (
    <div className={`flex flex-col gap-3 rounded-lg border border-slate-200 p-3 ${className}`}>
      {scheduling && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">Scheduled for today</span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {scheduling.used} / {scheduling.limit}
            </span>
          </div>
          <Bar
            used={scheduling.used}
            limit={scheduling.limit}
            tone={scheduledTone(scheduling.remaining, scheduling.limit)}
          />
          {scheduling.remaining === 0 && (
            <p className="text-[11px] text-red-600">
              Today is fully booked. Other dates have their own allowance.
            </p>
          )}
        </div>
      )}

      {quota && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">
              Today’s Resend allowance
              {!quota.exact && <span className="ml-1 font-normal text-slate-400">approx.</span>}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {quota.used} / {quota.limit}
            </span>
          </div>
          <Bar used={quota.used} limit={quota.limit} tone="bg-slate-400" />
          {quota.reserve > 0 && (
            <p className="text-[11px] text-slate-400">
              {/* Why a full scheduling bar does not mean a dead day. */}
              {quota.reserve} held back for incoming mail and anything you send by hand
            </p>
          )}
        </div>
      )}

      {resetsAt && (
        <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          Resets at {resetsAt}
        </p>
      )}
    </div>
  );
}
