const LEGACY_AI_TOWN_ASSET_PREFIX = '/ai-town/assets/';

export function normalizeMapAssetUrl(url: string): string {
  if (!url.startsWith(LEGACY_AI_TOWN_ASSET_PREFIX)) return url;
  return `/assets/${url.slice(LEGACY_AI_TOWN_ASSET_PREFIX.length)}`;
}
