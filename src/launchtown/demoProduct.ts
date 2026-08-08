import type { ProductEntry } from './types';

const LEGACY_LEDGERLY_DEMO_URL = 'https://ledgerly-demo.vercel.app';
export const LEDGERLY_DEMO_URL = 'https://ledgerly-demo-six.vercel.app';

export function migrateStoredDemoProduct(
  stored: ProductEntry | undefined,
  usesDefaultProduct: boolean,
): ProductEntry | undefined {
  if (!usesDefaultProduct || stored?.url !== LEGACY_LEDGERLY_DEMO_URL) return stored;
  return { ...stored, url: LEDGERLY_DEMO_URL };
}
