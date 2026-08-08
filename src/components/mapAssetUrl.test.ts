import { normalizeMapAssetUrl } from './mapAssetUrl';

test('maps legacy AI Town asset paths to the app asset directory', () => {
  expect(normalizeMapAssetUrl('/ai-town/assets/gentle-obj.png')).toBe(
    '/assets/gentle-obj.png',
  );
});

test('leaves current and remote asset URLs unchanged', () => {
  expect(normalizeMapAssetUrl('/assets/gentle-obj.png')).toBe('/assets/gentle-obj.png');
  expect(normalizeMapAssetUrl('https://cdn.example.com/map.png')).toBe(
    'https://cdn.example.com/map.png',
  );
});
