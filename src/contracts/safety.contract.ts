export interface BlockEntry {
  blockedUserId: string;
  createdAtIso: string;
}

export interface GetBlocksResponse {
  blocks: BlockEntry[];
}

export interface BlockUserResponse {
  status: 'blocked';
  block: BlockEntry;
}

export interface UnblockUserResponse {
  status: 'unblocked' | 'noop';
  userId: string;
}

export interface ReportUserRequest {
  userId: string;
  reason: 'spam' | 'scam' | 'abuse' | 'fake_profile' | 'other';
  note?: string;
}

export interface ReportUserResponse {
  status: 'reported';
  report: {
    id: string;
    reportedUserId: string;
    reason: 'spam' | 'scam' | 'abuse' | 'fake_profile' | 'other';
    note?: string;
    createdAtIso: string;
  };
}
