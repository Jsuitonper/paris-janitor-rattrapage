FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web-traveler/package.json web-traveler/package.json
COPY web-admin/package.json web-admin/package.json
RUN npm ci

FROM deps AS build
WORKDIR /app
COPY api ./api
RUN npm run build -w api

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
RUN npm ci --omit=dev --workspace api --include-workspace-root && npm cache clean --force
COPY --from=build /app/api/dist ./api/dist
USER node
WORKDIR /app/api
EXPOSE 3000
CMD ["node", "dist/src/server.js"]
