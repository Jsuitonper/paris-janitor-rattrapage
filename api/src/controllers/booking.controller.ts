import type { RequestHandler } from 'express';
import * as bookingService from '../services/booking.service';
import { adminBookingQuerySchema, bookingStatusSchema, serviceQuoteSchema, stayQuoteSchema } from '../validators/booking.schema';

export const listMine: RequestHandler = async (req, res) => {
  res.json(await bookingService.listMyBookings(req.user!));
};

export const createStay: RequestHandler = async (req, res) => {
  res.status(201).json(await bookingService.createStayBooking(req.user!, stayQuoteSchema.parse(req.body)));
};

export const createService: RequestHandler = async (req, res) => {
  res.status(201).json(await bookingService.createServiceBooking(req.user!, serviceQuoteSchema.parse(req.body)));
};

export const getStay: RequestHandler = async (req, res) => {
  res.json(await bookingService.getStayBooking(req.params.id as string, req.user!));
};

export const getService: RequestHandler = async (req, res) => {
  res.json(await bookingService.getServiceBooking(req.params.id as string, req.user!));
};

export const cancelStay: RequestHandler = async (req, res) => {
  res.json(await bookingService.cancelStayBooking(req.params.id as string, req.user!));
};

export const cancelService: RequestHandler = async (req, res) => {
  res.json(await bookingService.cancelServiceBooking(req.params.id as string, req.user!));
};

export const adminListStays: RequestHandler = async (req, res) => {
  res.json(await bookingService.listAllStayBookings(adminBookingQuerySchema.parse(req.query).status));
};

export const adminListServices: RequestHandler = async (req, res) => {
  res.json(await bookingService.listAllServiceBookings(adminBookingQuerySchema.parse(req.query).status));
};

export const adminSetStayStatus: RequestHandler = async (req, res) => {
  const { status } = bookingStatusSchema.parse(req.body);
  res.json(await bookingService.setStayStatus(req.params.id as string, status, req.user!));
};

export const adminSetServiceStatus: RequestHandler = async (req, res) => {
  const { status } = bookingStatusSchema.parse(req.body);
  res.json(await bookingService.setServiceStatus(req.params.id as string, status, req.user!));
};
