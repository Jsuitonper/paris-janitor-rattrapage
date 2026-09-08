export type InterventionStatus = 'prefilled' | 'completed';

export type InterventionPrefill = {
  offeringName: string;
  providerName: string;
  travelerName: string;
  address: string;
  scheduledAt: Date;
  qty: number;
  unitLabel: string;
};

export type InterventionReport = {
  performedAt: Date;
  durationMinutes: number;
  workDone: string;
  materialsUsed: string;
  incidents: string;
  attachmentIds: string[];
};

export type InterventionSheet = {
  id: string;
  bookingId: string;
  providerId: string;
  travelerId: string;
  status: InterventionStatus;
  prefill: InterventionPrefill;
  report: InterventionReport | null;
  completedByUserId: string | null;
  completedAt: Date | null;
  createdAt: Date;
};
