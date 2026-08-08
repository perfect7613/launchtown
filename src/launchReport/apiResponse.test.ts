import { readReportApiResponse } from './apiResponse';

test('turns a plain-text serverless failure into a readable report error', async () => {
  const response = {
    ok: false,
    text: async () => 'A server error has occurred\nFUNCTION_INVOCATION_FAILED',
  };

  await expect(readReportApiResponse(response)).resolves.toEqual({
    error: 'A server error has occurred',
  });
});
