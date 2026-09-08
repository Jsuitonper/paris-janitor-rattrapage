import { Router } from 'express';
import { download, remove, upload } from '../controllers/file.controller';
import { optionalAuth } from '../middlewares/optionalAuth';
import { requireAuth } from '../middlewares/requireAuth';
import { requireRole } from '../middlewares/requireRole';
import { uploadSingleFile } from '../middlewares/upload';

export const fileRouter = Router();

fileRouter.get('/:id', optionalAuth, download);
fileRouter.post('/', requireAuth, requireRole('admin'), uploadSingleFile, upload);
fileRouter.delete('/:id', requireAuth, requireRole('admin'), remove);
