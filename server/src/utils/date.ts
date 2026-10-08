/**
 * Asia/Dhaka Timezone Utility Module
 * 
 * Ensures all CRM timestamps, booking dates, target deadlines, and expense datetimes
 * adhere consistently to Asia/Dhaka (BST, UTC+6) format: YYYY-MM-DD HH:mm (or YYYY-MM-DD)
 */

/**
 * Returns the current date and time in Asia/Dhaka formatted as 'YYYY-MM-DD HH:mm'
 */
export function getDhakaNowDateTimeString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`;
}

/**
 * Returns the current date in Asia/Dhaka formatted as 'YYYY-MM-DD'
 */
export function getDhakaTodayDateString(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return `${m.year}-${m.month}-${m.day}`;
}

/**
 * Normalizes any incoming date string (from Google Sheets, webhooks, or ISO strings)
 * into canonical 'YYYY-MM-DD HH:mm' (or 'YYYY-MM-DD') in Asia/Dhaka.
 * 
 * Handles:
 * - US format: '10/8/2026 14:29:00' -> '2026-10-08 14:29'
 * - Unpadded format: '2026-10-07 5:15' -> '2026-10-07 05:15'
 * - ISO string with Z / offset: '2026-10-08T14:29:00.000Z' -> converts UTC to Dhaka local '2026-10-08 20:29'
 * - Date-only: '2026-10-25' -> '2026-10-25'
 * - Non-date placeholders: 'Open (No Deadline)' -> preserved as-is
 */
export function normalizeDhakaDateTime(raw: string | undefined | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (!trimmed || ['open (no deadline)', 'n/a', '—', '-'].includes(trimmed.toLowerCase())) {
    return trimmed;
  }

  // 1. ISO format with T and explicit timezone / UTC (e.g. 2026-10-08T14:29:00.000Z)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Dhaka',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).formatToParts(d);
      const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
      return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`;
    }
  }

  // 2. Format: M/D/YYYY [H:m[:s]] (Google Sheets US locale) e.g. '10/8/2026 14:29:00'
  const mMDY = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (mMDY) {
    const month = mMDY[1].padStart(2, '0');
    const day = mMDY[2].padStart(2, '0');
    const year = mMDY[3];
    if (mMDY[4] !== undefined && mMDY[5] !== undefined) {
      const hour = mMDY[4].padStart(2, '0');
      const minute = mMDY[5].padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 3. Format: YYYY-M-D [H:m[:s]] (ISO-like unpadded) e.g. '2026-10-07 5:15' or '2026-10-08 14:02' or '2026-10-25'
  const mYMD = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (mYMD) {
    const year = mYMD[1];
    const month = mYMD[2].padStart(2, '0');
    const day = mYMD[3].padStart(2, '0');
    if (mYMD[4] !== undefined && mYMD[5] !== undefined) {
      const hour = mYMD[4].padStart(2, '0');
      const minute = mYMD[5].padStart(2, '0');
      return `${year}-${month}-${day} ${hour}:${minute}`;
    }
    return `${year}-${month}-${day}`;
  }

  // 4. Fallback: Parse Date and format to Asia/Dhaka
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Dhaka',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const m = Object.fromEntries(parts.map(p => [p.type, p.value]));
    return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`;
  }

  return trimmed;
}
