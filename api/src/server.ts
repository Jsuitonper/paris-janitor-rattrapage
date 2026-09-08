import { createApp } from './app';
import { connectDatabase } from './config/database';
import { env } from './config/env';

async function main(): Promise<void> {
  await connectDatabase(env.MONGODB_URI);
  createApp().listen(env.PORT, () => {
    console.log(`API démarrée sur http://localhost:${env.PORT}`);
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
