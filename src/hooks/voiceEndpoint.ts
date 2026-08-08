export function voiceEndpoint(path: string): string {
  const configured = import.meta.env.VITE_CONVEX_SITE_URL as string | undefined;
  if (configured) return `${configured.replace(/\/$/, '')}${path}`;
  const cloudUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
  if (!cloudUrl) throw new Error('Voice endpoint is not configured.');
  return `${cloudUrl.replace(/\.convex\.cloud\/?$/, '.convex.site')}${path}`;
}
