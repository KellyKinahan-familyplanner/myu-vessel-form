/** Tick options. Which ones count as a problem is defined in form.ts (BAD_RATINGS). */
export type Rating = string;
export type InclusionStatus = "Included" | "Not included" | "Negotiable";

export type ShowIf = { id: string; in?: string[]; notIn?: string[] };

export type Item = {
  id: string;
  label: string;
  /** Spoken version of the question (defaults to label) */
  say?: string;
  type: "voice" | "choice";
  options?: string[];
  hint?: string;
  /** Normalise spoken input */
  format?: "email" | "phone";
  /** Only show when another answer matches */
  showIf?: ShowIf;
};

/** One tick-box row in a checklist category. */
export type Check = {
  id: string;
  label: string;
  hint?: string;
  /** Override the category's tick options */
  opts?: readonly string[];
};

export type Section = {
  id: string;
  title: string;
  /** Part A / Part B grouping shown in the header and PDF */
  part?: string;
  /** Short reminder shown when this area starts */
  remind?: string;
  intro?: string;
  items: Item[];
  /** Checklist rows (one screen for the whole category) */
  checks?: Check[];
  /** Default tick options for the checklist */
  opts?: readonly string[];
  /** Suggested photos shown as quick-capture chips; a photo step is added only when set */
  photos?: string[];
  showIf?: ShowIf;
  /** Marketing content, kept separate from the condition declaration */
  marketing?: boolean;
};

export type RatingAnswer = { rating?: Rating; note?: string };
export type Answers = Record<string, string | RatingAnswer>;
export type Photo = {
  id: string;
  sectionId: string;
  caption: string;
  /** signed download URL, or a local preview while uploading */
  url: string;
  status: "uploading" | "ok" | "error";
};
export type CustomInclusion = { id: string; label: string; status?: InclusionStatus };

export type FormState = {
  answers: Answers;
  photos: Photo[];
  customInclusions: CustomInclusion[];
  declarationName: string;
  declarationAgreed: boolean;
  /** index of current step for resume */
  step: number;
};
