export function normalizePublicProductUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Product URL must be a valid HTTP or HTTPS URL');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new Error('Product URL must be a valid public HTTP or HTTPS URL');
  }
  url.hostname = url.hostname.toLowerCase();
  const pathname = url.pathname.replace(/\/+$/, '');
  return `${url.protocol}//${url.host}${pathname}`;
}

export function productIdentity(urlValue: string): { name: string; slug: string } {
  const url = new URL(urlValue);
  const hostname = url.hostname.replace(/^www\./, '');
  const label = hostname.split('.')[0].replace(/[-_]+/g, ' ');
  const name = label.replace(/\b\w/g, (letter) => letter.toUpperCase());
  const path = url.pathname === '/' ? '' : url.pathname;
  const slugPart = `${hostname}${path}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 72);
  return { name, slug: `custom-${slugPart}` };
}
