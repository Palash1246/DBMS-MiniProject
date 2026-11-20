export function localInputToIst(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('INVALID_TIME');
  return `${value}:00+05:30`;
}
export function formatIst(value: string | Date) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Kolkata' }).format(new Date(value));
}
