// Week utilities: single source of truth for "last complete ISO week" in UTC
export type WeekBounds = { startISO: string; endISO: string; weekKey: string };

export function getLastCompleteWeekUTC(now = new Date()): WeekBounds {
  // ISO week: Monday 00:00 to next Monday 00:00 (UTC)
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  // Move to Monday of current week (0=Sun..6=Sat)
  const day = d.getUTCDay(); // 0..6
  const deltaToMon = (day === 0 ? -6 : 1 - day);
  d.setUTCDate(d.getUTCDate() + deltaToMon);
  d.setUTCHours(0, 0, 0, 0);               // Monday 00:00 this week
  
  // Go back one full week for last complete week
  const mondayPrevWeek = new Date(d);
  mondayPrevWeek.setUTCDate(mondayPrevWeek.getUTCDate() - 7);
  const start = mondayPrevWeek;                   // last Monday 00:00
  const end = new Date(d);                        // this Monday 00:00 (exclusive)

  // ISO week key YYYY-W##
  const tmp = new Date(start);
  const oneJan = Date.UTC(tmp.getUTCFullYear(), 0, 1);
  const week = Math.ceil((((+tmp - oneJan) / 86400000) + (new Date(oneJan).getUTCDay() || 7)) / 7);
  const weekKey = `${start.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;

  return { startISO: start.toISOString(), endISO: end.toISOString(), weekKey };
}
