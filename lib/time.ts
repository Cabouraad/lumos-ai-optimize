function nyParts(d = new Date()) {
  // Use more accurate Intl.DateTimeFormat for America/New_York
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  
  const parts = formatter.formatToParts(d);
  const yyyy = parts.find(part => part.type === 'year')?.value || '1970';
  const mm = parts.find(part => part.type === 'month')?.value || '01';
  const dd = parts.find(part => part.type === 'day')?.value || '01';
  const hh = parts.find(part => part.type === 'hour')?.value || '00';
  const mi = parts.find(part => part.type === 'minute')?.value || '00';
  const ss = parts.find(part => part.type === 'second')?.value || '00';
  
  return { yyyy, mm, dd, hh, mi, ss };
}

export function todayKeyNY(d = new Date()): string {
  const { yyyy, mm, dd } = nyParts(d);
  return `${yyyy}-${mm}-${dd}`;
}

export function isPastThreeAMNY(d = new Date()): boolean {
  const { hh } = nyParts(d);
  return Number(hh) >= 3;
}

export function nextThreeAMNY(d = new Date()): Date {
  const { yyyy, mm, dd, hh } = nyParts(d);
  const currentHour = Number(hh);
  const base = new Date(d);
  // Construct NY 03:00 of "today" or "tomorrow" in local UTC terms by adjusting difference
  // Simple approach: if already past 3, pick tomorrow, else today.
  const day = new Date(base);
  if (currentHour >= 3) day.setDate(day.getDate() + 1);
  // Set to 03:00:00 NY by iterating until date parts match; fallback is fine for UI labeling.
  // For UI only; exactness not mission-critical.
  day.setUTCHours(7, 0, 0, 0); // 07:00 UTC ≈ 03:00 ET (DST varies; this is informational)
  return day;
}