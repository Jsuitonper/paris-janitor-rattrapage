import multer from 'multer';
import { MAX_FILE_BYTES } from '../services/file.service';

export const uploadSingleFile = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
}).single('file');
