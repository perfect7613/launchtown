import { useCallback, useEffect, useRef, useState } from 'react';
import { BolnaWebCall, CallError, CallState } from '@bolna/web-call';
import type { Id } from '../../convex/_generated/dataModel';
import { voiceEndpoint } from './voiceEndpoint';

export type InterviewCallState = 'idle' | 'connecting' | 'active';

const toInterviewState = (state: CallState): InterviewCallState => {
  if (state === 'active') return 'active';
  if (state === 'connecting' || state === 'ringing') return 'connecting';
  return 'idle';
};

export function useBolnaCall(residentKey: string, productId?: Id<'products'>) {
  const callRef = useRef<BolnaWebCall>();
  const [state, setState] = useState<InterviewCallState>('idle');
  const [error, setError] = useState<CallError>();
  const [volume, setVolume] = useState(0);

  const stop = useCallback(async () => {
    const call = callRef.current;
    callRef.current = undefined;
    if (call) await call.stop();
    setVolume(0);
    setState('idle');
  }, []);

  const start = useCallback(async () => {
    if (callRef.current && state !== 'idle') return;
    setError(undefined);
    setState('connecting');
    try {
      const call = new BolnaWebCall({
        sessionUrl: voiceEndpoint('/bolna/session'),
        userData: { residentKey, productId },
      });
      call.on('state-change', (next) => setState(toInterviewState(next)));
      call.on('volume-level', setVolume);
      call.on('call-end', () => {
        callRef.current = undefined;
        setVolume(0);
        setState('idle');
      });
      call.on('error', (nextError) => {
        callRef.current = undefined;
        setError(nextError);
        setVolume(0);
        setState('idle');
      });
      callRef.current = call;
      await call.start();
    } catch (cause) {
      callRef.current = undefined;
      setState('idle');
      setError(
        cause && typeof cause === 'object' && 'code' in cause && 'message' in cause
          ? (cause as CallError)
          : { code: 'connect_failed', message: 'Could not connect the resident interview.' },
      );
    }
  }, [productId, residentKey, state]);

  useEffect(
    () => () => {
      void callRef.current?.stop();
      callRef.current = undefined;
    },
    [residentKey],
  );

  return { state, error, volume, start, stop };
}
