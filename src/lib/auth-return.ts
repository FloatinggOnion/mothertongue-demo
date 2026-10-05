export function safeReturnPath(raw?: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/scenarios';
  try {
    const url = new URL(raw, 'https://mothertongue.local');
    if (url.origin !== 'https://mothertongue.local') return '/scenarios';
    return `${url.pathname}${url.search}`;
  } catch {
    return '/scenarios';
  }
}
