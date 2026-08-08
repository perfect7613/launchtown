import type { BolnaResidentUserData } from './voiceContext';
import { isValidE164, parseExecutionId } from './outboundCallPolicy';

type Fetch = typeof fetch;

export class BolnaOutboundError extends Error {
  constructor(
    public readonly code: 'provider_rejected' | 'provider_unavailable' | 'invalid_response',
    public readonly status?: number,
  ) {
    super('Bolna outbound request failed.');
    this.name = 'BolnaOutboundError';
  }
}

export async function startBolnaOutboundCall(
  args: {
    apiKey: string;
    agentId: string;
    recipientPhone: string;
    userData: BolnaResidentUserData;
  },
  fetcher: Fetch = fetch,
): Promise<{ executionId: string }> {
  if (!isValidE164(args.recipientPhone)) {
    throw new BolnaOutboundError('invalid_response');
  }
  const response = await fetcher('https://api.bolna.ai/call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${args.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agent_id: args.agentId,
      recipient_phone_number: args.recipientPhone,
      user_data: args.userData,
    }),
  });
  if (!response.ok) {
    throw new BolnaOutboundError(
      response.status >= 500 ? 'provider_unavailable' : 'provider_rejected',
      response.status,
    );
  }
  const payload = await response.json().catch(() => null);
  const executionId = parseExecutionId(payload);
  if (!executionId) throw new BolnaOutboundError('invalid_response', response.status);
  return { executionId };
}

export async function getBolnaExecution(
  args: { apiKey: string; executionId: string },
  fetcher: Fetch = fetch,
): Promise<unknown> {
  const response = await fetcher(
    `https://api.bolna.ai/executions/${encodeURIComponent(args.executionId)}`,
    { headers: { Authorization: `Bearer ${args.apiKey}` } },
  );
  if (!response.ok) {
    throw new BolnaOutboundError(
      response.status >= 500 || response.status === 404
        ? 'provider_unavailable'
        : 'provider_rejected',
      response.status,
    );
  }
  return await response.json().catch(() => {
    throw new BolnaOutboundError('invalid_response', response.status);
  });
}
