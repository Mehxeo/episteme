/** OpenRouter model ids — Gemma only for study/co-writer. */
export const GEMMA_STUDY_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
] as const;

export type GemmaStudyModel = (typeof GEMMA_STUDY_MODELS)[number];

export const DEFAULT_GEMMA_STUDY_MODEL: GemmaStudyModel = GEMMA_STUDY_MODELS[0];

export function isAllowedGemmaStudyModel(id: string): id is GemmaStudyModel {
  return (GEMMA_STUDY_MODELS as readonly string[]).includes(id);
}
