export const BOLNA_USER_DATA_LIMIT_BYTES = 50 * 1024;

const encoder = new TextEncoder();

export interface ResidentVoiceContext {
  product: { name: string; url: string };
  profile: {
    name: string;
    role: string;
    needStrength: number;
    priceSensitivity: number;
    technicalFluency: number;
    trustThreshold: number;
    socialSusceptibility: number;
    noveltySeeking: number;
    patience: number;
  };
  state: {
    stage: string;
    productBeliefs: Array<{
      claim: string;
      confidence: number;
      source: string;
      origin: string;
    }>;
  };
  experiences: Array<{ outcome: string; pagesVisited?: string[] }>;
  hearsay: Array<{ claim: string; source: string; confidence: number }>;
}

export type BolnaResidentUserData = {
  name: string;
  product: string;
  opening_assessment: string;
  personality: string;
  beliefs: string;
  experiences: string;
  hearsay: string;
  stage: string;
};

const clean = (value: string): string => value.replace(/\s+/g, ' ').trim();
const percent = (value: number): string => `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;

function unique(values: string[]): string[] {
  return [...new Set(values.map(clean).filter(Boolean))];
}

function truncateUtf8(value: string, maxBytes: number): string {
  if (encoder.encode(value).byteLength <= maxBytes) return value;
  const suffix = '…';
  const suffixBytes = encoder.encode(suffix).byteLength;
  let low = 0;
  let high = value.length;
  while (low < high) {
    const mid = Math.ceil((low + high) / 2);
    if (encoder.encode(value.slice(0, mid)).byteLength + suffixBytes <= maxBytes) low = mid;
    else high = mid - 1;
  }
  return `${value.slice(0, low)}${suffix}`;
}

function list(items: string[], empty: string): string {
  const values = unique(items);
  return values.length > 0 ? values.map((item) => `- ${item}`).join('\n') : empty;
}

function fitWithinLimit(userData: BolnaResidentUserData): BolnaResidentUserData {
  const fitted = { ...userData };
  const fields: Array<keyof BolnaResidentUserData> = [
    'beliefs',
    'experiences',
    'hearsay',
    'personality',
    'product',
    'opening_assessment',
  ];
  while (encoder.encode(JSON.stringify(fitted)).byteLength > BOLNA_USER_DATA_LIMIT_BYTES) {
    const field = fields.reduce((longest, candidate) =>
      encoder.encode(fitted[candidate]).byteLength > encoder.encode(fitted[longest]).byteLength
        ? candidate
        : longest,
    );
    const currentBytes = encoder.encode(fitted[field]).byteLength;
    if (currentBytes <= 64) throw new Error('Resident voice context exceeds Bolna userData limit.');
    fitted[field] = truncateUtf8(fitted[field], Math.floor(currentBytes * 0.75));
  }
  return fitted;
}

/** Maps live simulation state to the seven variables in the resident-interviewer prompt. */
export function serializeResidentVoiceContext(
  context: ResidentVoiceContext,
): BolnaResidentUserData {
  const { profile, product, state } = context;
  const personality = [
    profile.role,
    `need strength ${percent(profile.needStrength)}`,
    `price sensitivity ${percent(profile.priceSensitivity)}`,
    `technical fluency ${percent(profile.technicalFluency)}`,
    `trust threshold ${percent(profile.trustThreshold)}`,
    `social susceptibility ${percent(profile.socialSusceptibility)}`,
    `novelty seeking ${percent(profile.noveltySeeking)}`,
    `patience ${percent(profile.patience)}`,
  ].join('; ');

  const beliefs = list(
    state.productBeliefs.map((belief) => {
      const provenance =
        belief.origin === 'hearsay' ? `heard from ${belief.source}` : 'observed personally';
      return `${belief.claim} (${percent(belief.confidence)} confidence; ${provenance})`;
    }),
    'No product beliefs yet.',
  );
  const experiences = list(
    context.experiences.map((experience) => {
      const pages = experience.pagesVisited?.length
        ? ` Pages visited: ${experience.pagesVisited.join(', ')}.`
        : '';
      return `${experience.outcome}.${pages}`;
    }),
    'No first-hand website experience yet.',
  );
  const hearsay = list(
    context.hearsay.map(
      (item) => `${item.source} said: ${item.claim} (${percent(item.confidence)} confidence)`,
    ),
    'Nothing heard from other residents yet.',
  );
  const firstExperience = clean(context.experiences[0]?.outcome ?? '');
  const firstBelief = clean(state.productBeliefs[0]?.claim ?? '');
  const openingEvidence = unique([firstExperience, firstBelief])
    .slice(0, 2)
    .map((item) => (/[.!?]$/.test(item) ? item : `${item}.`))
    .join(' ');
  const openingAssessment = openingEvidence
    ? `My first take on ${clean(product.name)}: ${openingEvidence}`
    : `My first take on ${clean(product.name)} is still forming because I have not completed a first-hand website pass.`;

  return fitWithinLimit({
    name: truncateUtf8(clean(profile.name), 256),
    product: truncateUtf8(`${clean(product.name)} (${clean(product.url)})`, 2048),
    opening_assessment: truncateUtf8(openingAssessment, 360),
    personality: truncateUtf8(clean(personality), 8192),
    beliefs: truncateUtf8(beliefs, 12 * 1024),
    experiences: truncateUtf8(experiences, 12 * 1024),
    hearsay: truncateUtf8(hearsay, 12 * 1024),
    stage: truncateUtf8(clean(state.stage), 256),
  });
}
