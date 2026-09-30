/*
 * Turning what the schedule picker shows into what the API wants.
 *
 * `<input type="datetime-local">` deals in wall-clock time with no timezone —
 * "2026-08-12T09:00" means nine in the morning wherever the person is sitting.
 * JavaScript parses that form as local time, so converting to an absolute instant
 * is just `new Date(value)`, and the API is handed the ISO 8601 string it asks
 * for. The reverse trip has to subtract the offset by hand, since toISOString
 * always renders UTC and would show a time nobody entered.
 */

const MS_PER_MINUTE = 60 * 1000;

/** A Date as the `YYYY-MM-DDTHH:mm` a datetime-local input expects, in local time. */
export function toInputValue(date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE);
  return local.toISOString().slice(0, 16);
}

/** What the picker holds, as the absolute instant the API stores. */
export function toIsoInstant(inputValue) {
  if (!inputValue) return null;
  const date = new Date(inputValue);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** An absolute instant back into the picker's local wall-clock form. */
export function fromIsoInstant(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : toInputValue(date);
}

/** The UTC day a picked local time falls in, for asking about that day's slots. */
export function utcDayOf(inputValue) {
  const iso = toIsoInstant(inputValue);
  return iso ? iso.slice(0, 10) : null;
}

/**
 * The window the picker allows. The floor is a minute out rather than now, since
 * a time chosen and submitted in the same minute would already be in the past by
 * the time the server checked it.
 */
export function scheduleBounds(maxHorizonDays = 30, now = new Date()) {
  return {
    min: toInputValue(new Date(now.getTime() + MS_PER_MINUTE)),
    max: toInputValue(new Date(now.getTime() + maxHorizonDays * 24 * 60 * MS_PER_MINUTE)),
  };
}

/** "Tomorrow at 09:00" style label for a scheduled time, in the reader's timezone. */
export function formatScheduledAt(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const today = new Date();
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

  if (date.toDateString() === today.toDateString()) return `Today at ${time}`;
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow at ${time}`;

  const day = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(date.getFullYear() === today.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${day} at ${time}`;
}

/**
 * When the daily allowances roll over, said in the reader's own timezone.
 *
 * The window is UTC, which for most of the world is not midnight — saying "resets
 * at midnight UTC" and leaving someone to do the arithmetic is how a counter that
 * refills at 5:30am looks like a bug.
 */
export function formatResetTime(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
