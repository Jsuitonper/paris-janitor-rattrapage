import type { Express } from 'express';
import request from 'supertest';

export function downloadBinary(app: Express, url: string, auth?: { Authorization: string }) {
  const call = request(app).get(url);
  if (auth) call.set(auth);
  return call.buffer(true).parse((res, callback) => {
    const chunks: Buffer[] = [];
    res.on('data', (chunk: Buffer) => chunks.push(chunk));
    res.on('end', () => callback(null, Buffer.concat(chunks)));
  });
}

export function pdfText(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const runs: string[] = [];
  for (const block of raw.match(/\[[^\]]*\]\s*TJ/g) ?? []) {
    const chunks = block.match(/<([0-9A-Fa-f]+)>/g) ?? [];
    const decoded = chunks.map((chunk) => Buffer.from(chunk.slice(1, -1), 'hex').toString('latin1')).join('');
    if (decoded) runs.push(decoded);
  }
  return runs.join('\n');
}

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export function samplePng(): Buffer {
  return PNG_1PX;
}
