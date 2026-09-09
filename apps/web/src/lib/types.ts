export interface Project {
  id: string;
  name: string;
  address: string | null;
  region: string | null;
  areaM2: string | null;
  startDate: string | null;
  targetBudget: string | null;
  status: string;
  createdAt: string;
}

export type StageStatus = "pending" | "in_progress" | "done";

export interface Stage {
  id: string;
  projectId: string;
  name: string;
  order: number;
  plannedBudget: string | null;
  status: StageStatus;
}

export interface Expense {
  id: string;
  projectId: string;
  stageId: string | null;
  category: string;
  amount: string;
  currency: string;
  date: string;
  vendor: string | null;
  description: string | null;
  invoiceFileUrl: string | null;
  createdAt: string;
}

export interface ProjectSummary {
  targetBudget: number | null;
  totalSpent: number;
  remaining: number | null;
  stages: { id: string; name: string; plannedBudget: number | null; spent: number }[];
  unassignedSpent: number;
}

export const DOCUMENT_TYPES = ["invoice", "contract", "photo"] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export interface ProjectDocument {
  id: string;
  projectId: string;
  type: DocumentType;
  fileUrl: string;
  uploadedAt: string;
  downloadUrl: string;
}

export type ReportStatus = "pending" | "completed" | "failed";

export interface Report {
  id: string;
  projectId: string;
  status: ReportStatus;
  fileUrl: string | null;
  error: string | null;
  requestedAt: string;
  completedAt: string | null;
  downloadUrl?: string;
}
