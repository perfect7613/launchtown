import {
  MAYA_RESEARCH_VOICE,
  RESIDENT_INTERVIEWER_HANGUP_PROMPT,
  RESIDENT_INTERVIEWER_PROMPT,
  residentInterviewerAgentRequest,
} from './voiceAgentConfig';

test('prompts for an evidence-led, responsive multi-turn website diagnosis', () => {
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain(
    'Concrete opening assessment: {opening_assessment}',
  );
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain(
    'greeting already leads with the concrete opening assessment',
  );
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('first impression');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('relevance to your needs and pain points');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('trust signals and friction');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('likely objections');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('specific improvements');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('ask one natural follow-up question');
  expect(RESIDENT_INTERVIEWER_PROMPT).toContain('Do not close after answering one question');
});

test('uses the supported Claude route and documented Indian-English Maya voice', () => {
  const request = residentInterviewerAgentRequest();
  const llmConfig = request.agent_config.tasks[0].tools_config.llm_agent.llm_config;

  expect(request.agent_prompts.task_1.system_prompt).toBe(RESIDENT_INTERVIEWER_PROMPT);
  expect(request.agent_config.agent_welcome_message).toBe("Hi, I'm {name}. {opening_assessment}");
  expect(llmConfig).toEqual({
    provider: 'anthropic',
    family: 'anthropic',
    model: 'claude-sonnet-4',
    max_tokens: 150,
    temperature: 0.2,
  });
  expect(llmConfig).not.toHaveProperty('base_url');
  expect(JSON.stringify(llmConfig).toLowerCase()).not.toContain('openai');
  expect(request.agent_config.tasks[0].task_config).toEqual({
    call_terminate: 180,
    hangup_after_silence: 20,
    hangup_after_LLMCall: false,
    call_cancellation_prompt: RESIDENT_INTERVIEWER_HANGUP_PROMPT,
  });
  expect(request.agent_config.tasks[0].tools_config.synthesizer).toEqual({
    provider: 'maya',
    provider_config: {
      voice: 'Ananya',
      voice_id: 'Ananya',
      model: 'Maya 2 Native',
      language: 'en',
    },
    stream: true,
    buffer_size: 400,
    audio_format: 'wav',
  });
  expect(MAYA_RESEARCH_VOICE).toEqual(
    expect.objectContaining({
      provider: 'maya',
      voice: 'Ananya',
      language: 'en',
    }),
  );
});

test('only permits prompt-driven hangup after explicit or complete closure', () => {
  expect(RESIDENT_INTERVIEWER_HANGUP_PROMPT).toContain('explicitly asks to stop');
  expect(RESIDENT_INTERVIEWER_HANGUP_PROMPT).toContain('clearly confirms they are satisfied');
  expect(RESIDENT_INTERVIEWER_HANGUP_PROMPT).toContain('The full interview goal is complete');
  expect(RESIDENT_INTERVIEWER_HANGUP_PROMPT).toContain(
    'not complete merely because one question was answered',
  );
  expect(RESIDENT_INTERVIEWER_HANGUP_PROMPT).toContain('mid-conversation thanks');
});
