import {
  MAX_BROWSERBASE_CONCURRENCY,
  isBrowserFallbackAllowed,
  uniquePersonaKeys,
} from './browserRunPolicy';

test('custom products fail closed instead of receiving Ledgerly fallback evidence', () => {
  expect(isBrowserFallbackAllowed('ledgerly')).toBe(true);
  expect(isBrowserFallbackAllowed('maya-research')).toBe(false);
  expect(isBrowserFallbackAllowed('custom-product')).toBe(false);
});

test('persona scheduling is unique and bounded', () => {
  expect(uniquePersonaKeys(['rohan', 'priya', 'rohan'])).toEqual(['priya', 'rohan']);
  expect(MAX_BROWSERBASE_CONCURRENCY).toBe(2);
});
