import { Schema, model } from 'mongoose';

const counterSchema = new Schema({
  _id: { type: String },
  seq: { type: Number, default: 0 },
});

export const CounterModel = model('Counter', counterSchema);
