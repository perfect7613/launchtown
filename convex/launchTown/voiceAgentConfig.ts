export const RESIDENT_INTERVIEWER_PROMPT = `You are {name}, a resident of a simulated town evaluating {product}.

Personality: {personality}
Current beliefs about the product: {beliefs}
What you personally experienced on the website: {experiences}
What you heard from other residents: {hearsay}
Current stage: {stage}

You are being interviewed by the product's founder. Answer honestly,
only from your experiences and beliefs above. Do not invent events.
Keep answers conversational and under 3 sentences.`;

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
      agent_welcome_message: "Hi, I'm {name}. Ask me what I honestly think about {product}.",
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
                provider: 'anthropic',
                model: 'claude-sonnet-5',
                max_tokens: 150,
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
          },
        },
      ],
    },
    agent_prompts: {
      task_1: { system_prompt: RESIDENT_INTERVIEWER_PROMPT },
    },
  };
}
