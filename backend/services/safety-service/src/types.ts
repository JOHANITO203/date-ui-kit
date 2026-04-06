export type ReportReason = "spam" | "scam" | "abuse" | "fake_profile" | "other";

export interface BlockEntry {
  blockedUserId: string;
  createdAtIso: string;
}

export interface ReportEntry {
  id: string;
  reportedUserId: string;
  reason: ReportReason;
  note?: string;
  createdAtIso: string;
}
