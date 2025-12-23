import { DateTime } from 'luxon';

/**
 * Return ISO date string (yyyy-MM-dd) for the Monday of the week containing `dateISO`.
 * Defaults to Asia/Manila timezone for consistent behaviour with the backend.
 */
export function weekStartISO(dateISO, tz = 'Asia/Manila') {
  if (!dateISO) return null;
  try {
    const dt = DateTime.fromISO(dateISO, { zone: tz });
    return dt.set({ weekday: 1 }).toFormat('yyyy-MM-dd');
  } catch (e) {
    return null;
  }
}

export default weekStartISO;
