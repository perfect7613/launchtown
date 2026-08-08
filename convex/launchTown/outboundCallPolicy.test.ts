import {
  OUTBOUND_CALL_ACTIVE_LEASE_MS,
  OUTBOUND_CALL_COOLDOWN_MS,
  OUTBOUND_CALL_MAX_PER_WINDOW,
  OUTBOUND_CALL_WINDOW_MS,
  evaluateCallGate,
  isAllowedVoiceOrigin,
  isValidE164,
  mapExecutionStatus,
  maskE164,
  parseBolnaExecutionSnapshot,
  parseOutboundCallRequest,
  parseExecutionId,
  sanitizeExtractedFindings,
} from './outboundCallPolicy';

const NOW = 2_000_000_000_000;

test('accepts only exact configured origins', () => {
  const configured = 'https://launchtown-seven.vercel.app,http://localhost:5173';
  expect(isAllowedVoiceOrigin('https://launchtown-seven.vercel.app', configured)).toBe(true);
  expect(isAllowedVoiceOrigin('https://launchtown-seven.vercel.app.evil.test', configured)).toBe(
    false,
  );
  expect(isAllowedVoiceOrigin(null, configured)).toBe(false);
});

test('validates and masks an E.164 recipient without exposing it', () => {
  expect(isValidE164('+919876543210')).toBe(true);
  expect(isValidE164('9876543210')).toBe(false);
  const mask = maskE164('+919876543210');
  expect(mask).toBe('+•• •••••• 3210');
  expect(mask).not.toContain('987654');
});

test('accepts only a consented request and rejects client-controlled destinations', () => {
  expect(
    parseOutboundCallRequest({ residentKey: 'rohan', productId: 'product-id', consent: true }),
  ).toEqual({ ok: true, residentKey: 'rohan', productId: 'product-id' });
  expect(parseOutboundCallRequest({ residentKey: 'rohan', consent: false })).toEqual({
    ok: false,
    code: 'CONSENT_REQUIRED',
  });
  expect(
    parseOutboundCallRequest({
      residentKey: 'rohan',
      consent: true,
      recipientPhone: '+919876543210',
    }),
  ).toEqual({ ok: false, code: 'INVALID_REQUEST' });
  expect(parseOutboundCallRequest({ residentKey: '../admin', consent: true })).toEqual({
    ok: false,
    code: 'INVALID_REQUEST',
  });
});

test('blocks one active call, cooldown, and the rolling daily cap', () => {
  expect(
    evaluateCallGate({
      now: NOW,
      activeRequestedAt: NOW - OUTBOUND_CALL_ACTIVE_LEASE_MS + 1,
      recentRequestedAts: [],
    }),
  ).toMatchObject({ ok: false, code: 'CALL_ACTIVE' });
  expect(
    evaluateCallGate({
      now: NOW,
      recentRequestedAts: [NOW - OUTBOUND_CALL_COOLDOWN_MS + 1],
    }),
  ).toMatchObject({ ok: false, code: 'CALL_COOLDOWN' });
  expect(
    evaluateCallGate({
      now: NOW,
      recentRequestedAts: Array.from(
        { length: OUTBOUND_CALL_MAX_PER_WINDOW },
        (_, index) => NOW - OUTBOUND_CALL_COOLDOWN_MS - 1 - index * 1_000,
      ),
    }),
  ).toMatchObject({ ok: false, code: 'DAILY_LIMIT' });
  expect(
    evaluateCallGate({
      now: NOW,
      recentRequestedAts: [NOW - OUTBOUND_CALL_WINDOW_MS - 1],
    }),
  ).toEqual({ ok: true });
});

test('normalizes execution lifecycle and rejects malformed execution IDs', () => {
  expect(mapExecutionStatus('queued')).toBe('initiated');
  expect(mapExecutionStatus('ringing')).toBe('ringing');
  expect(mapExecutionStatus('call-disconnected')).toBe('in-progress');
  expect(mapExecutionStatus('completed')).toBe('completed');
  expect(mapExecutionStatus('no-answer')).toBe('failed');
  expect(parseExecutionId({ execution_id: 'a98bdbf2-ae37-4a87-b483-f36ff3102b80' })).toBe(
    'a98bdbf2-ae37-4a87-b483-f36ff3102b80',
  );
  expect(parseExecutionId({ execution_id: 'not-an-id' })).toBeNull();
});

test('persists only bounded privacy-scrubbed extraction findings', () => {
  const findings = sanitizeExtractedFindings({
    Product: {
      Trust: { objective: 'Wants clearer bank-access disclosure', confidence: 0.82 },
      Share: true,
    },
    recipient_phone_number: '+919876543210',
    transcript: 'never persist this',
    Followup: 'Email me at founder@example.com or visit https://example.com/private',
  });

  expect(findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        label: 'Product · Trust',
        summary: 'Wants clearer bank-access disclosure',
        confidence: 0.82,
      }),
      expect.objectContaining({ label: 'Product · Share', summary: 'true' }),
    ]),
  );
  expect(JSON.stringify(findings)).not.toContain('+919876543210');
  expect(JSON.stringify(findings)).not.toContain('founder@example.com');
  expect(JSON.stringify(findings)).not.toContain('never persist this');
  expect(findings).toHaveLength(3);
});

test('builds a safe persistence snapshot without transcript, recordings, or numbers', () => {
  const snapshot = parseBolnaExecutionSnapshot({
    id: 'a98bdbf2-ae37-4a87-b483-f36ff3102b80',
    status: 'completed',
    conversation_duration: 42.5,
    transcript: 'private conversation',
    recording_url: 'https://recordings.example/private',
    telephony_data: {
      provider: 'vobiz',
      to_number: '+919876543210',
      from_number: '+919123456789',
    },
    extracted_data: { Friction: 'Bank access needs a clearer explanation' },
  });

  expect(snapshot).toEqual({
    status: 'completed',
    providerStatus: 'completed',
    provider: 'vobiz',
    durationSeconds: 42.5,
    findings: [{ label: 'Friction', summary: 'Bank access needs a clearer explanation' }],
  });
  expect(JSON.stringify(snapshot)).not.toContain('private conversation');
  expect(JSON.stringify(snapshot)).not.toContain('recordings.example');
  expect(JSON.stringify(snapshot)).not.toContain('+919');
});
