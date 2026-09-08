import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { stringify } from 'yaml';
import { buildOpenApiDocument } from '../src/docs/openapi';

const document = buildOpenApiDocument();
const target = resolve(__dirname, '..', 'openapi.yaml');
const paths = document.paths as Record<string, Record<string, unknown>>;

const operations = Object.values(paths).reduce(
  (total, entry) => total + Object.keys(entry).filter((key) => key !== 'parameters').length,
  0,
);

writeFileSync(target, stringify(document, { aliasDuplicateObjects: false, lineWidth: 100 }), 'utf8');

console.log('openapi.yaml écrit : ' + target);
console.log(Object.keys(paths).length + ' chemins, ' + operations + ' opérations');
console.log(Object.keys((document.components as { schemas: object }).schemas).length + ' schémas');
