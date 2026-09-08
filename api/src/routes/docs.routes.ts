import { Router, type RequestHandler } from 'express';
import swaggerUi from 'swagger-ui-express';
import { stringify } from 'yaml';
import { buildOpenApiDocument } from '../docs/openapi';

const document = buildOpenApiDocument();

/* Helmet impose par défaut une politique de sécurité qui bloque les styles et
 * scripts en ligne injectés par Swagger UI. On l'assouplit pour cette page
 * seulement, sans toucher à la politique globale de l'application. */
const relaxContentSecurityPolicy: RequestHandler = (_req, res, next) => {
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data:",
      "font-src 'self' data:",
      "connect-src 'self'",
    ].join('; '),
  );
  next();
};

export const docsRouter = Router();

docsRouter.get('/openapi.json', (_req, res) => {
  res.json(document);
});

docsRouter.get('/openapi.yaml', (_req, res) => {
  res.type('text/yaml; charset=utf-8').send(stringify(document, { aliasDuplicateObjects: false, lineWidth: 100 }));
});

docsRouter.use(
  relaxContentSecurityPolicy,
  swaggerUi.serve,
  swaggerUi.setup(document, {
    customSiteTitle: 'Paris Janitor — API',
    swaggerOptions: { docExpansion: 'none', defaultModelsExpandDepth: 0, tagsSorter: 'alpha' },
  }),
);
