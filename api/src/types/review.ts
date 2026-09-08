export type ModerationStatus = 'pending' | 'approved' | 'rejected';

export type Review = {
  id: string;
  bookingId: string;
  travelerId: string;
  providerId: string;
  offeringId: string;
  rating: number;
  comment: string;
  moderation: ModerationStatus;
  moderationReason: string | null;
  moderatedAt: Date | null;
  authorName: string;
  createdAt: Date;
};

export type ProviderRating = {
  count: number;
  average: number | null;
};
