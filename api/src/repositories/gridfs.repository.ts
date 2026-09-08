import { GridFSBucket, ObjectId } from 'mongodb';
import mongoose from 'mongoose';
import type { FileMetadata, StoredFile } from '../types/file';

const BUCKET_NAME = 'documents';

type GridFsDoc = {
  _id: ObjectId;
  filename: string;
  length: number;
  uploadDate: Date;
  metadata?: FileMetadata;
};

function bucket(): GridFSBucket {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Connexion MongoDB indisponible pour GridFS');
  }
  return new GridFSBucket(db, { bucketName: BUCKET_NAME });
}

function toStoredFile(doc: GridFsDoc): StoredFile {
  return {
    id: doc._id.toString(),
    filename: doc.filename,
    length: doc.length,
    uploadDate: doc.uploadDate,
    metadata: doc.metadata as FileMetadata,
  };
}

export function uploadFile(filename: string, content: Buffer, metadata: FileMetadata): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = bucket().openUploadStream(filename, { metadata });
    stream.on('error', reject);
    stream.on('finish', () => resolve(stream.id.toString()));
    stream.end(content);
  });
}

export async function findFileById(id: string): Promise<StoredFile | null> {
  if (!ObjectId.isValid(id)) return null;
  const docs = await bucket().find({ _id: new ObjectId(id) }).limit(1).toArray();
  return docs.length > 0 ? toStoredFile(docs[0] as GridFsDoc) : null;
}

export function downloadFile(id: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = bucket().openDownloadStream(new ObjectId(id));
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

export async function listFiles(filter: Record<string, unknown> = {}): Promise<StoredFile[]> {
  const docs = await bucket().find(filter).toArray();
  return docs.map((doc) => toStoredFile(doc as GridFsDoc));
}

export async function deleteFile(id: string): Promise<void> {
  await bucket().delete(new ObjectId(id));
}
