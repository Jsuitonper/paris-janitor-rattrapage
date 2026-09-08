import { StripeEventModel } from '../models/StripeEvent.model';

export async function claimStripeEvent(id: string, type: string): Promise<boolean> {
  try {
    await StripeEventModel.create({ _id: id, type });
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 11000) return false;
    throw error;
  }
}

export async function releaseStripeEvent(id: string): Promise<void> {
  await StripeEventModel.deleteOne({ _id: id });
}

export async function countStripeEvents(): Promise<number> {
  return StripeEventModel.countDocuments();
}
