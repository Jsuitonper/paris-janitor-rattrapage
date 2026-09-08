export type MessageAuthorRole = 'traveler' | 'concierge';

export type Message = {
  id: string;
  threadId: string;
  authorRole: MessageAuthorRole;
  authorUserId: string;
  authorName: string;
  body: string;
  createdAt: Date;
};

export type MessageThread = {
  id: string;
  bookingId: string;
  travelerId: string;
  providerId: string;
  subject: string;
  lastMessageAt: Date | null;
  unreadForAdmin: number;
  unreadForTraveler: number;
  createdAt: Date;
};
