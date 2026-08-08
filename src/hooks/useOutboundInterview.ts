import { useCallback, useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { Id } from '../../convex/_generated/dataModel';
import { voiceEndpoint } from './voiceEndpoint';

type SafeErrorCode =
  | 'CALL_ACTIVE'
  | 'CALL_COOLDOWN'
  | 'DAILY_LIMIT'
  | 'CONSENT_REQUIRED'
  | 'CONTEXT_NOT_FOUND'
  | 'OUTBOUND_NOT_CONFIGURED'
  | 'provider_rejected'
  | 'provider_unavailable'
  | 'NETWORK_ERROR';

export function useOutboundInterview(residentKey: string, productId?: Id<'products'>) {
  const [configuration, setConfiguration] = useState<{
    loading: boolean;
    available: boolean;
    destinationMask?: string;
  }>({ loading: true, available: false });
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<{ code: SafeErrorCode; retryAfterSeconds?: number }>();
  const latest = useQuery(api.launchTown.outboundCallModel.latestForResident, {
    residentKey,
    ...(productId ? { productId } : {}),
  });

  useEffect(() => {
    const controller = new AbortController();
    setConfiguration({ loading: true, available: false });
    fetch(voiceEndpoint('/bolna/outbound'), { signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json().catch(() => null)) as {
          available?: unknown;
          destinationMask?: unknown;
        } | null;
        setConfiguration({
          loading: false,
          available: response.ok && body?.available === true,
          ...(typeof body?.destinationMask === 'string'
            ? { destinationMask: body.destinationMask }
            : {}),
        });
      })
      .catch((cause) => {
        if ((cause as { name?: string }).name !== 'AbortError') {
          setConfiguration({ loading: false, available: false });
        }
      });
    return () => controller.abort();
  }, [productId, residentKey]);

  const start = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    setError(undefined);
    try {
      const response = await fetch(voiceEndpoint('/bolna/outbound'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ residentKey, productId, consent: true }),
      });
      const body = (await response.json().catch(() => null)) as {
        code?: SafeErrorCode;
        retryAfterSeconds?: number;
      } | null;
      if (!response.ok) {
        setError({
          code: body?.code ?? 'provider_unavailable',
          ...(typeof body?.retryAfterSeconds === 'number'
            ? { retryAfterSeconds: body.retryAfterSeconds }
            : {}),
        });
      }
    } catch {
      setError({ code: 'NETWORK_ERROR' });
    } finally {
      setStarting(false);
    }
  }, [productId, residentKey, starting]);

  return { configuration, latest, starting, error, start };
}
