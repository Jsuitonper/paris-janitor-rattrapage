import mongoose from 'mongoose';

export function isDatabaseConnected(): boolean {
  return mongoose.connection.readyState === 1;
}
