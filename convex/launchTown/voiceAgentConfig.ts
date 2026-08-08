export const RESIDENT_INTERVIEWER_PROMPT = `You are {name}, a resident of a simulated town evaluating {product}.

Personality: {personality}
Current beliefs about the product: {beliefs}
What you personally experienced on the website: {experiences}
What you heard from other residents: {hearsay}
Current stage: {stage}
Concrete opening assessment: {opening_assessment}

You are speaking with the product's founder to give a candid website diagnosis.

Conversation behavior:
- The greeting already leads with the concrete opening assessment. On your first response, briefly deepen that assessment and respond to what the founder said.
- Across the interview, cover: first impression; relevance to your needs and pain points; trust signals and friction; likely objections; and specific improvements.
- Do not dump a checklist. Respond directly to what the founder just said, then ask one natural follow-up question that advances an uncovered topic.
- Stay in character and distinguish personal experience from hearsay. Only use the evidence above; never invent events or website details.
- Keep each turn conversational and concise, normally 2-3 sentences, while retaining context from earlier turns.
- Do not close after answering one question. Continue until the founder explicitly asks to stop, clearly confirms they are satisfied and have no more questions, or every interview topic above has been substantively covered and you have given a concise final synthesis.
- A brief acknowledgement or "thanks" during the interview is not by itself a request to end. If completion is unclear, ask what the founder wants to explore next.`;

export const RESIDENT_INTERVIEWER_HANGUP_PROMPT = `A conversation is complete only if at least one condition is true:
1. The user explicitly asks to stop or end the call, or says a clear goodbye.
2. The user clearly confirms they are satisfied and have no more questions.
3. The full interview goal is complete: first impression, relevance and pain points, trust and friction, objections, and improvements were all substantively covered; the assistant gave a concise final synthesis; and the user then confirmed closure.

The conversation is not complete merely because one question was answered, the user briefly paused, the user gave a short acknowledgement or mid-conversation thanks, the assistant asked a follow-up, or any interview topic remains uncovered. If completion is ambiguous, return not complete.`;

export interface BolnaVoiceSelection {
  provider: string;
  voice: string;
  voiceId: string;
  model: string;
  language: string;
}

/** Bolna's documented Indian-English female Maya Research voice. */
export const MAYA_RESEARCH_VOICE: BolnaVoiceSelection = {
  provider: 'maya',
  voice: 'Ananya',
  voiceId: 'Ananya',
  model: 'Maya 2 Native',
  language: 'en',
};

/** Produces the documented Bolna V2 conversation-agent request. */
export function residentInterviewerAgentRequest(voice: BolnaVoiceSelection = MAYA_RESEARCH_VOICE) {
  return {
    agent_config: {
      agent_name: 'LaunchTown Resident Interviewer',
      agent_welcome_message: "Hi, I'm {name}. {opening_assessment}",
      agent_type: 'other',
      tasks: [
        {
          task_type: 'conversation',
          toolchain: {
            execution: 'sequential',
            pipelines: [['transcriber', 'llm', 'synthesizer']],
          },
          tools_config: {
            llm_agent: {
              agent_type: 'simple_llm_agent',
              agent_flow_type: 'streaming',
              llm_config: {
                provider: 'openai',
                family: 'openai',
                model: 'gpt-4.1-mini',
                base_url: 'https://api.openai.com/v1',
                max_tokens: 300,
                temperature: 0.2,
              },
            },
            synthesizer: {
              provider: voice.provider,
              provider_config: {
                voice: voice.voice,
                voice_id: voice.voiceId,
                model: voice.model,
                language: voice.language,
              },
              stream: true,
              buffer_size: 400,
              audio_format: 'wav',
            },
            transcriber: {
              provider: 'deepgram',
              model: 'nova-3',
              language: 'en',
              stream: true,
              encoding: 'linear16',
              sampling_rate: 16000,
              endpointing: 250,
            },
            input: { provider: 'plivo', format: 'wav' },
            output: { provider: 'plivo', format: 'wav' },
          },
          task_config: {
            call_terminate: 180,
            hangup_after_silence: 20,
            hangup_after_LLMCall: false,
            call_cancellation_prompt: RESIDENT_INTERVIEWER_HANGUP_PROMPT,
          },
        },
      ],
    },
    agent_prompts: {
      task_1: { system_prompt: RESIDENT_INTERVIEWER_PROMPT },
    },
  };
}
