import * as gridfsRepository from '../repositories/gridfs.repository';
import type { FileKind, FileMetadata, StoredFile } from '../types/file';
import type { AuthUser } from '../types/user';
import { AppError } from '../utils/AppError';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

const ALLOWED_MIME: Record<FileKind, string[]> = {
  invoice: ['application/pdf'],
  property_photo: ['image/jpeg', 'image/png', 'image/webp'],
  booking_attachment: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'],
  inventory_report: ['application/pdf', 'image/jpeg', 'image/png'],
};

const PUBLIC_KINDS: FileKind[] = ['property_photo'];

export type UploadInput = {
  kind: FileKind;
  originalName: string;
  contentType: string;
  content: Buffer;
  ownerUserId?: string | null;
  propertyId?: string | null;
  bookingId?: string | null;
  invoiceId?: string | null;
};

export async function storeFile(input: UploadInput): Promise<StoredFile> {
  if (!ALLOWED_MIME[input.kind].includes(input.contentType)) {
    throw new AppError(400, 'UNSUPPORTED_MEDIA_TYPE', 'Type ' + input.contentType + ' refusé pour ' + input.kind);
  }
  if (input.content.length > MAX_FILE_BYTES) {
    throw new AppError(413, 'FILE_TOO_LARGE', 'Fichier trop volumineux (10 Mo maximum)');
  }
  const metadata: FileMetadata = {
    kind: input.kind,
    contentType: input.contentType,
    originalName: input.originalName,
    ownerUserId: input.ownerUserId ?? null,
    propertyId: input.propertyId ?? null,
    bookingId: input.bookingId ?? null,
    invoiceId: input.invoiceId ?? null,
  };
  const id = await gridfsRepository.uploadFile(input.originalName, input.content, metadata);
  return (await gridfsRepository.findFileById(id))!;
}

export async function getFile(id: string): Promise<StoredFile> {
  const file = await gridfsRepository.findFileById(id);
  if (!file) {
    throw new AppError(404, 'FILE_NOT_FOUND', 'Fichier introuvable');
  }
  return file;
}

export function canRead(file: StoredFile, viewer: AuthUser | undefined): boolean {
  if (PUBLIC_KINDS.includes(file.metadata.kind)) return true;
  if (!viewer) return false;
  if (viewer.role === 'admin') return true;
  return file.metadata.ownerUserId === viewer.id;
}

export async function readFile(id: string, viewer: AuthUser | undefined): Promise<{ file: StoredFile; content: Buffer }> {
  const file = await getFile(id);
  if (!canRead(file, viewer)) {
    throw new AppError(403, 'FORBIDDEN', 'Accès refusé à ce document');
  }
  return { file, content: await gridfsRepository.downloadFile(id) };
}

export async function removeFile(id: string): Promise<void> {
  await getFile(id);
  await gridfsRepository.deleteFile(id);
}
