import * as userRepository from '../repositories/user.repository';
import type { User } from '../types/user';
import { AppError } from '../utils/AppError';

export async function getUserById(id: string): Promise<User> {
  const user = await userRepository.findUserById(id);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'Utilisateur introuvable');
  }
  return user;
}

export function listUsers(): Promise<User[]> {
  return userRepository.listUsers();
}
