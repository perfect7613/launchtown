import {
  MAYA_RESEARCH_VOICE,
  RESIDENT_INTERVIEWER_PROMPT,
  residentInterviewerAgentRequest,
} from './voiceAgentConfig';

test('uses the exact seven-variable resident interviewer prompt from the plan', () => {
  expect(RESIDENT_INTERVIEWER_PROMPT)
    .toBe(`You are {name}, a resident of a simulated town evaluating {product}.

Personality: {personality}
Current beliefs about the product: {beliefs}
What you personally experienced on the website: {experiences}
What you heard from other residents: {hearsay}
Current stage: {stage}

You are being interviewed by the product's founder. Answer honestly,
only from your experiences and beliefs above. Do not invent events.
Keep answers conversational and under 3 sentences.`);
});

test('uses the documented Indian-English female Maya Research voice', () => {
  const request = residentInterviewerAgentRequest();

  expect(request.agent_prompts.task_1.system_prompt).toBe(RESIDENT_INTERVIEWER_PROMPT);
  expect(request.agent_config.tasks[0].tools_config.llm_agent.llm_config).toEqual({
    provider: 'anthropic',
    model: 'claude-sonnet-5',
    max_tokens: 150,
    temperature: 0.2,
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
