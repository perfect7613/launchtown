import { mapFitScale, scaleAfterResize } from './viewportCamera';

test('fits the map width with a small overscan instead of zooming to half the world', () => {
  expect(mapFitScale(1_000, 2_000)).toBeCloseTo(0.52);
});

test('refits an untouched camera when the game column resizes', () => {
  expect(scaleAfterResize(0.52, 0.52, 0.4)).toBe(0.4);
});

test('preserves deliberate user zoom while respecting the new minimum', () => {
  expect(scaleAfterResize(1.2, 0.52, 0.4)).toBe(1.2);
  expect(scaleAfterResize(0.6, 0.4, 0.8)).toBe(0.8);
});
