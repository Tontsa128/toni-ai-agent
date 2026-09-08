export interface SchoolAssignment { id: string; title: string; instructions: string; dueDate?: string; sourceUrl?: string; }
export interface SchoolDraft { assignmentId: string; answer: string; notes: string[]; }

export interface SchoolAgent {
  readAssignments(): Promise<SchoolAssignment[]>;
  analyse(assignment: SchoolAssignment): Promise<{ requirements: string[]; missingInformation: string[]; suggestedPlan: string[] }>;
  draft(assignment: SchoolAssignment, plan: string[]): Promise<SchoolDraft>;
  writeDraft(draft: SchoolDraft): Promise<void>;
  submit(draft: SchoolDraft): Promise<void>;
}

/** writeDraft/submit are always approval-gated and never bypass tenant/MFA/CAPTCHA controls. */
