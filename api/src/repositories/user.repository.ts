import { Types } from 'mongoose';
import { UserModel } from '../models/User.model';
import type { Role, User, UserProfile, UserVip } from '../types/user';

type UserDoc = Omit<User, 'id'> & { _id: Types.ObjectId; passwordHash?: string };

function toUser(doc: UserDoc): User {
  return {
    id: doc._id.toString(),
    email: doc.email,
    role: doc.role,
    profile: doc.profile,
    stripeCustomerId: doc.stripeCustomerId ?? null,
    vip: doc.vip,
    blocked: doc.blocked,
    createdAt: doc.createdAt,
  };
}

export async function createUser(input: {
  email: string;
  passwordHash: string;
  role: Role;
  profile: UserProfile;
}): Promise<User> {
  const doc = await UserModel.create(input);
  return toUser(doc.toObject() as UserDoc);
}

export async function existsUserByEmail(email: string): Promise<boolean> {
  return (await UserModel.exists({ email })) !== null;
}

export async function findUserByEmailWithPassword(
  email: string,
): Promise<{ user: User; passwordHash: string } | null> {
  const doc = await UserModel.findOne({ email }).select('+passwordHash').lean<UserDoc & { passwordHash: string }>();
  return doc ? { user: toUser(doc), passwordHash: doc.passwordHash } : null;
}

export async function findUserById(id: string): Promise<User | null> {
  if (!Types.ObjectId.isValid(id)) return null;
  const doc = await UserModel.findById(id).lean<UserDoc>();
  return doc ? toUser(doc) : null;
}

export async function findUserByStripeCustomerId(stripeCustomerId: string): Promise<User | null> {
  const doc = await UserModel.findOne({ stripeCustomerId }).lean<UserDoc>();
  return doc ? toUser(doc) : null;
}

export async function listUsers(): Promise<User[]> {
  const docs = await UserModel.find().sort({ createdAt: -1 }).lean<UserDoc[]>();
  return docs.map(toUser);
}

export async function updateUserVip(id: string, vip: Partial<UserVip>): Promise<User | null> {
  const patch = Object.fromEntries(Object.entries(vip).map(([key, value]) => ['vip.' + key, value]));
  const doc = await UserModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<UserDoc>();
  return doc ? toUser(doc) : null;
}

export async function updateUser(
  id: string,
  patch: { stripeCustomerId?: string | null; blocked?: boolean },
): Promise<User | null> {
  const doc = await UserModel.findByIdAndUpdate(id, { $set: patch }, { returnDocument: 'after' }).lean<UserDoc>();
  return doc ? toUser(doc) : null;
}

export async function listSubscribers(): Promise<User[]> {
  const docs = await UserModel.find({ 'vip.status': { $ne: 'none' } }).sort({ 'vip.anchorAt': -1 }).lean<UserDoc[]>();
  return docs.map(toUser);
}
