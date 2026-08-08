export type ResidentStage =
  | 'unaware'
  | 'aware'
  | 'considering'
  | 'evaluating'
  | 'converted'
  | 'rejected';

export type ProductBelief = {
  claim: string;
  confidence: number;
  source: string;
  origin: 'observed' | 'hearsay';
};

export type ResidentProfile = {
  needStrength: number;
  priceSensitivity: number;
  technicalFluency: number;
  trustThreshold: number;
  socialSusceptibility: number;
  noveltySeeking: number;
  patience: number;
};

export type ResidentState = {
  residentKey: string;
  awareness: number;
  curiosity: number;
  trust: number;
  purchaseIntent: number;
  sentiment: number;
  stage: ResidentStage;
  productBeliefs: ProductBelief[];
};

export type InfluenceEvent = {
  listener: string;
  signals: {
    awareness: number;
    curiosity: number;
    trust: number;
  };
  beliefs: Array<{
    claim: string;
    confidence: number;
    source: string;
  }>;
  behavioralSuggestion: 'investigate' | 'visit' | 'avoid' | 'share' | 'none';
};
