import { Schema, model } from 'mongoose';

const serviceCategorySchema = new Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, trim: true },
  description: { type: String, default: '' },
});

export const ServiceCategoryModel = model('ServiceCategory', serviceCategorySchema);
