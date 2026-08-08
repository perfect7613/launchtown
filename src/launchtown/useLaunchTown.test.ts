import { migrateStoredDemoProduct } from './demoProduct';

describe('migrateStoredDemoProduct', () => {
  test('repairs a returning demo user with the legacy default URL', () => {
    expect(
      migrateStoredDemoProduct(
        { url: 'https://ledgerly-demo.vercel.app', createdAt: 123 },
        true,
      ),
    ).toEqual({ url: 'https://ledgerly-demo-six.vercel.app', createdAt: 123 });
  });

  test('preserves an explicitly configured product URL', () => {
    const stored = { url: 'https://example.com/my-product', createdAt: 123 };

    expect(migrateStoredDemoProduct(stored, true)).toBe(stored);
    expect(
      migrateStoredDemoProduct(
        { url: 'https://ledgerly-demo.vercel.app', createdAt: 123 },
        false,
      ),
    ).toEqual({ url: 'https://ledgerly-demo.vercel.app', createdAt: 123 });
  });
});
