/**
 * The workspace data model, following the blueprint's tables: documents and
 * their immutable versions, source sections, extracted rules, scan jobs,
 * findings with evidence, reviews, remediation and the audit log.
 */

export type Lang = "en" | "zh" | "mixed";

export type Authority = "corporate_policy" | "department_sop" | "training" | "template";

export const AUTHORITY_LABEL: Record<Authority, string> = {
  corporate_policy: "Corporate policy",
  department_sop: "Department SOP",
  training: "Training material",
  template: "Template",
};

export type Approval = "approved" | "draft" | "archived";

export type Section = {
  id: string;
  /** "3.1" etc. Uploaded files without numbering get "§1", "§2"… */
  ref: string;
  heading: string;
  page: number;
  text: string;
};

export type DocVersion = {
  version: string;
  status?: "parsing" | "needs_ocr" | "ready" | "failed";
  pages?: number;
  sections: Section[];
  checksum: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
  note: string;
  effectiveDate: string;
};

export type FileKind = "pdf" | "docx" | "txt" | "md";

export type Doc = {
  id: string;
  title: string;
  fileName: string;
  kind: FileKind;
  owner: string;
  department: string;
  authority: Authority;
  approval: Approval;
  language: Lang;
  /** "All regions" overlaps every region. */
  scope: string;
  versions: DocVersion[];
  /** Index into versions of the version in force. */
  current: number;
  /** Text could not be read reliably: flagged for review instead of guessed. */
  parseIssue?: string;
};

export type Modality = "must" | "must_not" | "may" | "should";

export type Rule = {
  id: string;
  docId: string;
  version: string;
  /** True for rules from a version that has since been replaced. */
  historical: boolean;
  sectionId: string;
  sectionRef: string;
  page: number;
  quote: string;
  topic: string;
  /** Narrower subject inside a topic (e.g. sick vs parental leave): only equal subjects are compared. */
  subject: string;
  event: string;
  actor: string;
  action: string;
  modality: Modality;
  value?: number;
  unit?: string;
  /** The value exactly as written ("14个自然日"), for highlighting. */
  valueText?: string;
  /** "week", "month", "year", "pay period": an allowance per period is only compared with the same period. */
  period?: string;
  /** Value in a comparable base unit (hours for time, the number itself otherwise). */
  norm?: number;
  unitClass?: "time" | "business_days" | "count" | "percent" | "money";
  conditions: string[];
  scope: string;
  lang: Lang;
};

export type FindingType =
  | "contradiction"
  | "prohibition"
  | "outdated"
  | "missing_step"
  | "responsibility"
  | "ambiguity"
  | "duplicate";

export const TYPE_LABEL: Record<FindingType, string> = {
  contradiction: "Direct contradiction",
  prohibition: "Permission conflict",
  outdated: "Outdated instruction",
  missing_step: "Missing step",
  responsibility: "Responsibility mismatch",
  ambiguity: "Ambiguity",
  duplicate: "Duplicated guidance",
};

export type Risk = "high" | "medium" | "low";
export const RISK_NAME: Record<Risk, string> = { high: "High", medium: "Medium", low: "Low" };

export type Status =
  | "detected"
  | "under_review"
  | "confirmed"
  | "dismissed"
  | "assigned"
  | "revision_proposed"
  | "approved"
  | "rejected"
  | "rescanned"
  | "closed";

export const STATUS_LABEL: Record<Status, string> = {
  detected: "Open",
  under_review: "In review",
  confirmed: "Confirmed",
  dismissed: "Dismissed",
  assigned: "Assigned",
  revision_proposed: "Revision proposed",
  approved: "Revision approved",
  rejected: "Revision rejected",
  rescanned: "Re-scanned",
  closed: "Closed",
};

export type Evidence = {
  docId: string;
  version: string;
  sectionId: string;
  sectionRef: string;
  page: number;
  quote: string;
  /** The words to mark inside the quote. */
  highlight?: string;
  /** Quote found word for word in the stored section text. */
  verified: boolean;
  ruleId?: string;
  /** A baseline requirement rather than a document clause. */
  baseline?: string;
};

export type Note = { id: string; at: string; by: string; text: string };

export type Revision = {
  decision?: "approved" | "rejected" | null;
  docId: string;
  sectionId: string;
  current: string;
  proposed: string;
  by: string;
  at: string;
  decidedBy?: string;
  decidedAt?: string;
  newVersion?: string;
};

export type Finding = {
  id: string;
  type: FindingType;
  risk: Risk;
  status: Status;
  title: string;
  explanation: string;
  why: string;
  authority: string;
  recommendation: string;
  evidence: Evidence[];
  topic: string;
  department: string;
  dedupKey: string;
  owner?: string | null;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  scanId: string;
  notes: Note[];
  revision?: Revision;
  /** Result of the last re-scan: is the issue still present? */
  reverified?: "resolved" | "still_present" | null;
  /** "rules" (deterministic engine) or "ai" (proposed by the model, verified citations). */
  source?: "rules" | "ai";
  ai?: { reasoning?: string; digest?: string; prompt?: string; classification?: string; missing?: string[]; severityProposed?: string } | null;
};

export type Classification = "potential" | "compatible" | "exception" | "historical" | "insufficient";

export const CLASS_LABEL: Record<Classification, string> = {
  potential: "Potential contradiction",
  compatible: "Compatible",
  exception: "Valid exception",
  historical: "Historical / superseded",
  insufficient: "Insufficient information",
};

export type ScanStage = "queued" | "parsing" | "extracting" | "matching" | "validating" | "completed" | "partially_completed" | "failed";

export const STAGES: ScanStage[] = ["queued", "parsing", "extracting", "matching", "validating", "completed"];

export type Scan = {
  id: string;
  name: string;
  docIds: string[];
  startedAt: string;
  finishedAt?: string;
  stage: ScanStage;
  by: string;
  counts: Partial<Record<Classification, number>> & {
    rules?: number;
    candidates?: number;
    suppressed?: number;
    ai_reviewed?: number;
    ai_flagged?: number;
    ai_failed?: number;
    ai_total?: number;
  };
  newFindings: string[];
  /** A re-scan run to re-verify one finding. */
  reverify?: string | null;
  useAi?: boolean;
  model?: { reasoning?: string; embedding?: string; digest?: string; prompt?: string; unavailable?: string };
  error?: string | null;
};

export type Role = "owner" | "admin" | "editor" | "reviewer" | "approver" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Workspace owner",
  admin: "Administrator",
  editor: "Document editor",
  reviewer: "Reviewer",
  approver: "Approver",
  viewer: "Auditor / viewer",
};

export type Member = { id: string; name: string; email: string; role: Role; department: string; invited?: boolean };

export type AuditEvent = {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail?: string;
  href?: string;
};

export type Notice = { id: string; at: string; text: string; href?: string; read: boolean };

export type Baseline = { id: string; topic: string; name: string; approved?: boolean; steps: { name: string; keywords: string[] }[] };

export type Settings = {
  company: string;
  departments: string[];
  languages: string[];
  regions: string[];
  hierarchy: Authority[];
  /** Risk per topic; topics not listed use "medium". */
  topicRisk: Record<string, Risk>;
  retentionDays: number;
  notifyEmail: boolean;
  notifyAssigned: boolean;
  notifyScans: boolean;
  webhook: string;
  separationOfDuties?: boolean;
};

export type Workspace = {
  version: number;
  createdAt: string;
  sample: boolean;
  settings: Settings;
  members: Member[];
  docs: Doc[];
  rules: Rule[];
  findings: Finding[];
  scans: Scan[];
  audit: AuditEvent[];
  notices: Notice[];
  baselines: Baseline[];
  seq: Record<string, number>;
  /** The signed-in member, from the API. */
  me: { id: string; name: string; email: string; role: Role; isAdmin: boolean };
};

export type Org = { id: string; name: string; isDemo: boolean; role: Role };

export type Me = {
  user: { id: string; email: string; name: string };
  isAdmin: boolean;
  access: "approved" | "none";
  orgs: Org[];
};
