const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_TIME = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export const formatDate = (iso: string | undefined): string => (iso ? DATE.format(new Date(iso)) : '—');
export const formatDateTime = (iso: string | undefined): string => (iso ? DATE_TIME.format(new Date(iso)) : '—');
