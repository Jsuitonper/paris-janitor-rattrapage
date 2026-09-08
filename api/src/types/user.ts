import type { VipTier } from './pricing';

export type Role = 'traveler' | 'admin';

export type VipStatus = 'none' | 'active' | 'past_due' | 'canceled';

export type UserProfile = {
  firstName: string;
  lastName: string;
  phone?: string;
};

export type UserVip = {
  tier: VipTier;
  status: VipStatus;
  anchorAt: Date | null;
  currentPeriodEnd: Date | null;
  stripeSubscriptionId: string | null;
  cancelAtPeriodEnd: boolean;
  interval: 'monthly' | 'yearly' | null;
  renewalBonusApplied: boolean;
};

export type User = {
  id: string;
  email: string;
  role: Role;
  profile: UserProfile;
  stripeCustomerId: string | null;
  vip: UserVip;
  blocked: boolean;
  createdAt: Date;
};

export type AuthUser = {
  id: string;
  role: Role;
};
