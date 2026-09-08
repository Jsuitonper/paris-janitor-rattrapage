import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import * as userRepository from '../repositories/user.repository';
import type { AuthUser, User, UserProfile } from '../types/user';
import { AppError } from '../utils/AppError';

type AuthResult = { user: User; token: string };

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

function signToken(user: User): string {
  return jwt.sign({ role: user.role }, env.JWT_SECRET, {
    subject: user.id,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export async function register(input: { email: string; password: string; profile: UserProfile }): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  if (await userRepository.existsUserByEmail(email)) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Un compte existe déjà avec cet e-mail');
  }
  const user = await userRepository.createUser({
    email,
    passwordHash: await hashPassword(input.password),
    role: 'traveler',
    profile: input.profile,
  });
  return { user, token: signToken(user) };
}

export async function login(input: { email: string; password: string }): Promise<AuthResult> {
  const found = await userRepository.findUserByEmailWithPassword(input.email.toLowerCase());
  if (!found || !(await bcrypt.compare(input.password, found.passwordHash))) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'E-mail ou mot de passe incorrect');
  }
  if (found.user.blocked) {
    throw new AppError(403, 'ACCOUNT_BLOCKED', 'Ce compte est bloqué');
  }
  return { user: found.user, token: signToken(found.user) };
}

export async function authenticate(token: string): Promise<AuthUser> {
  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
  } catch {
    throw new AppError(401, 'UNAUTHENTICATED', 'Jeton invalide ou expiré');
  }
  const user = await userRepository.findUserById(String(payload.sub));
  if (!user || user.blocked) {
    throw new AppError(401, 'UNAUTHENTICATED', 'Compte introuvable ou bloqué');
  }
  return { id: user.id, role: user.role };
}
