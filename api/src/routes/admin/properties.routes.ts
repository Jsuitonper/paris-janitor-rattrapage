import { Router } from 'express';
import {
  createProperty,
  deleteProperty,
  getProperty,
  listProperties,
  setPropertyStatus,
  updateProperty,
  addPhoto,
  removePhoto,
} from '../../controllers/property.controller';
import { uploadSingleFile } from '../../middlewares/upload';

export const adminPropertiesRouter = Router();

adminPropertiesRouter.get('/', listProperties);
adminPropertiesRouter.post('/', createProperty);
adminPropertiesRouter.get('/:id', getProperty);
adminPropertiesRouter.patch('/:id', updateProperty);
adminPropertiesRouter.patch('/:id/status', setPropertyStatus);
adminPropertiesRouter.post('/:id/photos', uploadSingleFile, addPhoto);
adminPropertiesRouter.delete('/:id/photos/:fileId', removePhoto);
adminPropertiesRouter.delete('/:id', deleteProperty);
