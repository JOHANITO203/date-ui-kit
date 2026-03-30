export type BoostAvailability = 'active' | 'available' | 'out_of_tokens';

export interface BoostStatus {
  active: boolean;
  activeUntilIso?: string;
  remainingSeconds: number;
  boostsLeft: number;
  availability: BoostAvailability;
  durationSeconds: number;
}

export interface ActivateBoostResponse {
  status: 'activated' | 'already_active' | 'no_tokens';
  boost: BoostStatus;
}
