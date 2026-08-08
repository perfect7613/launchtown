export const MAX_BROWSERBASE_CONCURRENCY = 2;

export function isBrowserFallbackAllowed(productSlug: string): boolean {
  return productSlug === 'ledgerly';
}

export function uniquePersonaKeys(personaKeys: readonly string[]): string[] {
  return [...new Set(personaKeys)].sort((a, b) => a.localeCompare(b));
}
