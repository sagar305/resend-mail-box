import { formatResetTime } from '../lib/schedule.js';

/*
 * What is left of today's two allowances.
 *
 * The scheduled figure is ours and exact: it comes from a ledger this app owns.
 * The Resend figure is the plan's daily quota, reconciled against Resend's own
 * sent log — so it is a real number rather than a guess, but it is theirs and the
 * bar stays visually quieter to say so.
 *
 * The scheduled bar counts mail DUE TO GO OUT today, not mail scheduled today —
 * slots belong to the delivery day. Scheduling fifty for next week moves that
 * day's count, not this one, so the label says "going out" rather than
 * "scheduled" and the picker asks about its own day separately.
 *
 * Both windows are UTC, which is almost nobody's midnight. The reset time is
 * printed in the reader's own timezone, because an allowance that refills at
 * half past five in the morning looks like a bug until you know why.
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
            <span className="text-xs font-medium text-slate-700">Going out today</span>
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
              Today is full. Other days may still have room.
            </p>
          )}
        </div>
      )}

      {quota && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-medium text-slate-700">
              Resend quota
              {/* Set from your plan rather than read from Resend, who publish no
                  endpoint for it — worth saying rather than implying. */}
              {!quota.exact && <span className="ml-1 font-normal text-slate-400">approx.</span>}
            </span>
            <span className="text-[11px] text-slate-500 tabular-nums">
              {quota.used} / {quota.limit}
            </span>
          </div>
          <Bar used={quota.used} limit={quota.limit} tone="bg-slate-400" />
        </div>
      )}

      {resetsAt && (
        <p className="border-t border-slate-100 pt-2 text-[11px] text-slate-400">
          Both reset at {resetsAt}
        </p>
      )}
    </div>
  );
}
