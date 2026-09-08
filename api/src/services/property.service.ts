import * as propertyRepository from '../repositories/property.repository';
import type { PropertyFilter, PropertyInput, PropertyPatch } from '../repositories/property.repository';
import type { Property, PropertyStatus } from '../types/catalog';
import { AppError } from '../utils/AppError';
import { removeFile, storeFile } from './file.service';

export function listProperties(filter: PropertyFilter = {}): Promise<Property[]> {
  return propertyRepository.listProperties(filter);
}

export async function getProperty(id: string): Promise<Property> {
  const property = await propertyRepository.findPropertyById(id);
  if (!property) {
    throw new AppError(404, 'PROPERTY_NOT_FOUND', 'Bien introuvable');
  }
  return property;
}

export function createProperty(input: PropertyInput): Promise<Property> {
  return propertyRepository.createProperty(input);
}

export async function updateProperty(id: string, patch: PropertyPatch): Promise<Property> {
  await getProperty(id);
  return (await propertyRepository.updateProperty(id, patch))!;
}

export async function setPropertyStatus(id: string, status: PropertyStatus, rejectionReason?: string): Promise<Property> {
  await getProperty(id);
  const patch: PropertyPatch = { status, rejectionReason: status === 'rejected' ? (rejectionReason ?? null) : null };
  return (await propertyRepository.updateProperty(id, patch))!;
}

export async function removeProperty(id: string): Promise<void> {
  await getProperty(id);
  await propertyRepository.deleteProperty(id);
}

export async function addPropertyPhoto(id: string, file: { originalName: string; contentType: string; content: Buffer }): Promise<Property> {
  const property = await getProperty(id);
  const stored = await storeFile({
    kind: 'property_photo',
    originalName: file.originalName,
    contentType: file.contentType,
    content: file.content,
    propertyId: id,
  });
  return (await propertyRepository.updateProperty(id, { photoIds: [...property.photoIds, stored.id] }))!;
}

export async function removePropertyPhoto(id: string, fileId: string): Promise<Property> {
  const property = await getProperty(id);
  if (!property.photoIds.includes(fileId)) {
    throw new AppError(404, 'PHOTO_NOT_FOUND', 'Cette photo n’appartient pas à ce bien');
  }
  await removeFile(fileId);
  return (await propertyRepository.updateProperty(id, { photoIds: property.photoIds.filter((photoId) => photoId !== fileId) }))!;
}
