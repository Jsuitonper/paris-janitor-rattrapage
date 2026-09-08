import { CounterModel } from '../models/Counter.model';

type CounterDoc = { _id: string; seq: number };

export async function nextSequence(key: string): Promise<number> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const doc = await CounterModel.findOneAndUpdate(
        { _id: key },
        { $inc: { seq: 1 } },
        { upsert: true, returnDocument: 'after' },
      ).lean<CounterDoc>();
      return doc!.seq;
    } catch (error) {
      const isDuplicate = error instanceof Error && 'code' in error && error.code === 11000;
      if (!isDuplicate || attempt === 4) throw error;
    }
  }
  throw new Error('Impossible d’incrémenter le compteur ' + key);
}

export async function peekSequence(key: string): Promise<number> {
  const doc = await CounterModel.findById(key).lean<CounterDoc>();
  return doc?.seq ?? 0;
}
