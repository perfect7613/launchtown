import { jest } from '@jest/globals';
import {
  BolnaOutboundError,
  getBolnaExecution,
  startBolnaOutboundCall,
} from './bolnaOutboundClient';

const USER_DATA = {
  name: 'Rohan',
  product: 'Ledgerly (https://ledgerly.example)',
  personality: 'security-conscious engineer',
  beliefs: 'Strong documentation',
  experiences: 'Reviewed the security page',
  hearsay: 'Priya mentioned bank access concerns',
  stage: 'evaluating',
};

test('posts the documented centralized-number payload with dynamic user_data', async () => {
  const fetcher = jest.fn<typeof fetch>(
    async () =>
      new Response(
        JSON.stringify({
          message: 'done',
          status: 'queued',
          execution_id: 'a98bdbf2-ae37-4a87-b483-f36ff3102b80',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
  );

  await expect(
    startBolnaOutboundCall(
      {
        apiKey: 'server-secret',
        agentId: 'agent-id',
        recipientPhone: '+919876543210',
        userData: USER_DATA,
      },
      fetcher as typeof fetch,
    ),
  ).resolves.toEqual({ executionId: 'a98bdbf2-ae37-4a87-b483-f36ff3102b80' });

  const [, init] = fetcher.mock.calls[0];
  expect(init?.headers).toEqual(expect.objectContaining({ Authorization: 'Bearer server-secret' }));
  expect(JSON.parse(String(init?.body))).toEqual({
    agent_id: 'agent-id',
    recipient_phone_number: '+919876543210',
    user_data: USER_DATA,
  });
  expect(JSON.parse(String(init?.body))).not.toHaveProperty('from_phone_number');
});

test('turns provider failures into safe errors without response details', async () => {
  const fetcher = jest.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ message: 'sensitive provider detail with +919876543210' }), {
        status: 429,
      }),
  );

  const error = await startBolnaOutboundCall(
    {
      apiKey: 'server-secret',
      agentId: 'agent-id',
      recipientPhone: '+919876543210',
      userData: USER_DATA,
    },
    fetcher as typeof fetch,
  ).catch((cause) => cause);
  expect(error).toBeInstanceOf(BolnaOutboundError);
  expect(error).toMatchObject({ code: 'provider_rejected', status: 429 });
  expect(String(error)).not.toContain('+919876543210');
});

test('polls execution details by execution ID and rejects malformed JSON', async () => {
  const fetcher = jest.fn<typeof fetch>(
    async () =>
      new Response(JSON.stringify({ id: 'execution-id', status: 'completed' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  );
  await expect(
    getBolnaExecution(
      { apiKey: 'server-secret', executionId: 'execution-id' },
      fetcher as typeof fetch,
    ),
  ).resolves.toMatchObject({ status: 'completed' });
  expect(fetcher).toHaveBeenCalledWith(
    'https://api.bolna.ai/executions/execution-id',
    expect.objectContaining({ headers: { Authorization: 'Bearer server-secret' } }),
  );
});
