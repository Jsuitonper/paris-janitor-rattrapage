import { PlatformSettingsModel } from '../models/PlatformSettings.model';
import type { PlatformSettings } from '../types/catalog';

const SETTINGS_ID = 'default';

function toSettings(doc: PlatformSettings): PlatformSettings {
  return {
    stayCommissionBps: doc.stayCommissionBps,
    ownerYearlyFeeCents: doc.ownerYearlyFeeCents,
    simulatorOptions: (doc.simulatorOptions ?? []).map((option) => ({
      key: option.key,
      label: option.label,
      priceHtCents: option.priceHtCents,
      frequency: option.frequency,
    })),
  };
}

export async function getSettings(): Promise<PlatformSettings> {
  const doc = await PlatformSettingsModel.findByIdAndUpdate(
    SETTINGS_ID,
    { $setOnInsert: { _id: SETTINGS_ID } },
    { upsert: true, returnDocument: 'after' },
  ).lean<PlatformSettings>();
  return toSettings(doc!);
}

export async function updateSettings(patch: Partial<PlatformSettings>): Promise<PlatformSettings> {
  const doc = await PlatformSettingsModel.findByIdAndUpdate(
    SETTINGS_ID,
    { $set: patch },
    { upsert: true, returnDocument: 'after', runValidators: true },
  ).lean<PlatformSettings>();
  return toSettings(doc!);
}
