import { connectDatabase, disconnectDatabase } from '../src/config/database';
import { env } from '../src/config/env';
import * as userRepository from '../src/repositories/user.repository';
import { hashPassword } from '../src/services/auth.service';

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'admin@parisjanitor.fr').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'admin-1234';

  await connectDatabase(env.MONGODB_URI);

  if (await userRepository.existsUserByEmail(email)) {
    console.log(`Admin déjà présent : ${email}`);
  } else {
    await userRepository.createUser({
      email,
      passwordHash: await hashPassword(password),
      role: 'admin',
      profile: { firstName: 'Admin', lastName: 'Paris Janitor' },
    });
    console.log(`Admin créé : ${email} / ${password}`);
  }

  await disconnectDatabase();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
