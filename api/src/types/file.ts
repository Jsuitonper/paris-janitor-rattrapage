export type FileKind = 'invoice' | 'property_photo' | 'booking_attachment' | 'inventory_report';

export type FileMetadata = {
  kind: FileKind;
  contentType: string;
  originalName: string;
  ownerUserId: string | null;
  propertyId: string | null;
  bookingId: string | null;
  invoiceId: string | null;
};

export type StoredFile = {
  id: string;
  filename: string;
  length: number;
  uploadDate: Date;
  metadata: FileMetadata;
};
