import type { RequestHandler } from 'express';
import * as quoteService from '../services/quote.service';
import { quotePreviewSchema } from '../validators/booking.schema';

export const preview: RequestHandler = async (req, res) => {
  const input = quotePreviewSchema.parse(req.body);
  if (input.kind === 'stay') {
    res.json(await quoteService.previewStay(input.stay));
    return;
  }
  res.json(await quoteService.previewService(req.user!, input.service));
};
