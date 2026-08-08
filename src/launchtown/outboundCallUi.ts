export type OutboundUiStatus = 'initiated' | 'ringing' | 'in-progress' | 'completed' | 'failed';

export interface OutboundCallPresentation {
  label: string;
  detail: string;
  active: boolean;
  tone: 'amber' | 'blue' | 'green' | 'red';
}

export function outboundCallPresentation(
  status: OutboundUiStatus,
  failureCode?: string,
): OutboundCallPresentation {
  if (status === 'initiated') {
    return {
      label: 'Call requested',
      detail: 'Bolna is connecting the shared outbound line.',
      active: true,
      tone: 'amber',
    };
  }
  if (status === 'ringing') {
    return {
      label: 'Your phone is ringing',
      detail: 'Answer to interview this resident.',
      active: true,
      tone: 'blue',
    };
  }
  if (status === 'in-progress') {
    return {
      label: 'Interview in progress',
      detail: 'The resident is speaking from current simulation context.',
      active: true,
      tone: 'blue',
    };
  }
  if (status === 'completed') {
    return {
      label: 'Interview complete',
      detail: 'Safe findings are saved below; audio and transcript are not stored here.',
      active: false,
      tone: 'green',
    };
  }
  const detailByCode: Record<string, string> = {
    no_answer: 'The call was not answered. Try again after the cooldown.',
    busy: 'The destination was busy. Try again after the cooldown.',
    balance_low: 'The calling account needs more credit.',
    canceled: 'The call was canceled before completion.',
    provider_rejected: 'Bolna rejected the call request.',
    provider_unavailable: 'The calling provider is temporarily unavailable.',
    poll_timeout: 'Call status could not be confirmed in time.',
  };
  return {
    label: 'Interview failed',
    detail: detailByCode[failureCode ?? ''] ?? 'The call did not complete.',
    active: false,
    tone: 'red',
  };
}
