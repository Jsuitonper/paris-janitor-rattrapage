import * as stayBookingRepository from '../repositories/stayBooking.repository';
import type { DateRange, Property } from '../types/catalog';

const DAY_MS = 86_400_000;

export function parseDay(value: string): Date {
  return new Date(value + 'T00:00:00.000Z');
}

export function nightsBetween(startDate: Date, endDate: Date): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS);
}

function overlaps(range: DateRange, startDate: Date, endDate: Date): boolean {
  return range.start < endDate && range.end > startDate;
}

export async function isPropertyAvailable(property: Property, startDate: Date, endDate: Date): Promise<boolean> {
  if (property.blockedRanges.some((range) => overlaps(range, startDate, endDate))) return false;
  return !(await stayBookingRepository.existsOverlappingStay(property.id, startDate, endDate));
}

export async function unavailableRanges(property: Property): Promise<DateRange[]> {
  const booked = await stayBookingRepository.listActiveStayRanges(property.id);
  return [...property.blockedRanges, ...booked].sort((a, b) => a.start.getTime() - b.start.getTime());
}
