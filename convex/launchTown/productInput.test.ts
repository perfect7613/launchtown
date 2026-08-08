import { normalizePublicProductUrl, productIdentity } from './productInput';

test('normalizes a public product URL', () => {
  expect(
    normalizePublicProductUrl('https://WWW.MayaResearch.AI/?utm_source=demo#pricing'),
  ).toBe(
    'https://www.mayaresearch.ai',
  );
});

test('rejects non-HTTP URLs and embedded credentials', () => {
  expect(() => normalizePublicProductUrl('file:///tmp/product')).toThrow();
  expect(() => normalizePublicProductUrl('https://user:pass@example.com')).toThrow();
});

test('derives a stable custom product identity', () => {
  expect(productIdentity('https://www.mayaresearch.ai/')).toEqual({
    name: 'Mayaresearch',
    slug: 'custom-mayaresearch-ai',
  });
});
