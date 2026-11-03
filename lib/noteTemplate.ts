// Clinical Notes exam sections + Normal-Exam macro .
export interface ExamSection {
  id: string;
  label: string;
  pills: string[];
  template: string; // "{sel}" is replaced with the joined selection
}

export const EXAM_SECTIONS: ExamSection[] = [
  { id: "general", label: "General", pills: ["well-appearing", "NAD", "mild distress", "ill-appearing", "fatigued"], template: "Patient is {sel}." },
  { id: "heent", label: "HEENT", pills: ["normocephalic", "atraumatic", "PERRL", "EOMI", "dry mucous membranes", "oral lesions"], template: "HEENT exam reveals {sel}." },
  { id: "cv", label: "Cardiac", pills: ["regular rate", "regular rhythm", "no murmurs", "S3 gallop", "S4 gallop", "systolic murmur", "tachycardia", "bradycardia"], template: "Cardiac exam shows {sel}." },
  { id: "pulm", label: "Pulmonary", pills: ["clear bilaterally", "good air movement", "crackles", "wheezing", "decreased breath sounds", "rhonchi"], template: "Lungs are {sel}." },
  { id: "abd", label: "Abdomen", pills: ["soft", "non-tender", "non-distended", "bowel sounds normal", "tenderness", "guarding", "hepatomegaly"], template: "Abdomen is {sel}." },
  { id: "ext", label: "Extremities", pills: ["no edema", "trace edema", "1+ edema", "2+ edema", "warm", "well-perfused", "pulses 2+", "decreased pulses"], template: "Extremities show {sel}." },
  { id: "skin", label: "Skin", pills: ["intact", "no rashes", "no ulcers", "diabetic skin changes", "foot ulcer"], template: "Skin is {sel}." },
  { id: "neuro", label: "Neuro", pills: ["alert and oriented x3", "CN II-XII intact", "monofilament intact", "decreased monofilament", "sensation intact", "decreased sensation"], template: "Neurologic exam: {sel}." },
];

export const NORMAL_DEFAULTS: Record<string, string[]> = {
  general: ["well-appearing", "NAD"],
  heent: ["normocephalic", "atraumatic", "PERRL", "EOMI"],
  cv: ["regular rate", "regular rhythm", "no murmurs"],
  pulm: ["clear bilaterally", "good air movement"],
  abd: ["soft", "non-tender", "non-distended", "bowel sounds normal"],
  ext: ["no edema", "warm", "well-perfused", "pulses 2+"],
  skin: ["intact", "no rashes", "no ulcers"],
  neuro: ["alert and oriented x3", "CN II-XII intact", "monofilament intact"],
};

// Compose exam prose from selected pills.
export function examProse(exam: Record<string, string[]>): string {
  const sentences: string[] = [];
  for (const s of EXAM_SECTIONS) {
    const sel = exam[s.id] || [];
    if (!sel.length) continue;
    const phrase = sel.length === 1 ? sel[0] : sel.slice(0, -1).join(", ") + ", and " + sel[sel.length - 1];
    sentences.push(s.template.replace("{sel}", phrase));
  }
  return sentences.join(" ");
}
