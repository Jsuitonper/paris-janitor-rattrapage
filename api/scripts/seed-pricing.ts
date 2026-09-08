import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import { replaceCommissionTiers } from '../src/repositories/commissionTier.repository';
import { upsertVipPlan } from '../src/repositories/vipPlan.repository';
import { updateSettings } from '../src/repositories/platformSettings.repository';
import { DEFAULT_COMMISSION_TIERS, DEFAULT_SIMULATOR_OPTIONS, DEFAULT_VIP_PLANS } from '../src/services/pricing/defaults';

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);

  await replaceCommissionTiers(DEFAULT_COMMISSION_TIERS);
  console.log(`Barème de commission : ${DEFAULT_COMMISSION_TIERS.length} paliers`);

  for (const plan of DEFAULT_VIP_PLANS) {
    await upsertVipPlan(plan);
    console.log(`Formule VIP : ${plan.tier}`);
  }

  await updateSettings({ simulatorOptions: DEFAULT_SIMULATOR_OPTIONS });
  console.log('Options du simulateur : ' + DEFAULT_SIMULATOR_OPTIONS.length);

  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
