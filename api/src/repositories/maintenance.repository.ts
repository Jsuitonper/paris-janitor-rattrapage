import mongoose from 'mongoose';

const DEMO_COLLECTIONS = [
  'users',
  'providers',
  'servicecategories',
  'serviceofferings',
  'properties',
  'staybookings',
  'servicebookings',
  'vipquotausages',
  'payments',
  'stripeevents',
  'invoices',
  'counters',
  'interventionsheets',
  'reviews',
  'messagethreads',
  'messages',
  'quoteleads',
  'documents.files',
  'documents.chunks',
];

export async function resetDemoData(): Promise<string[]> {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('Connexion MongoDB indisponible');
  }
  const existing = (await db.listCollections().toArray()).map((collection) => collection.name);
  const dropped: string[] = [];
  for (const name of DEMO_COLLECTIONS) {
    if (existing.includes(name)) {
      await db.collection(name).deleteMany({});
      dropped.push(name);
    }
  }
  return dropped;
}

export async function countDocumentsIn(collectionName: string): Promise<number> {
  const db = mongoose.connection.db;
  if (!db) return 0;
  const existing = (await db.listCollections({ name: collectionName }).toArray()).length;
  return existing === 0 ? 0 : db.collection(collectionName).countDocuments();
}
