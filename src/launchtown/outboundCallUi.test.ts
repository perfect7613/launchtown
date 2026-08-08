import { outboundCallPresentation } from './outboundCallUi';

test.each([
  ['initiated', 'Call requested', true],
  ['ringing', 'Your phone is ringing', true],
  ['in-progress', 'Interview in progress', true],
  ['completed', 'Interview complete', false],
] as const)('presents %s lifecycle state', (status, label, active) => {
  expect(outboundCallPresentation(status)).toMatchObject({ label, active });
});

test('presents a safe actionable failure without provider details', () => {
  expect(outboundCallPresentation('failed', 'no_answer')).toEqual({
    label: 'Interview failed',
    detail: 'The call was not answered. Try again after the cooldown.',
    active: false,
    tone: 'red',
  });
});
