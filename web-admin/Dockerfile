FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web-traveler/package.json web-traveler/package.json
COPY web-admin/package.json web-admin/package.json
RUN npm ci
COPY web-admin ./web-admin
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w web-admin

FROM nginx:1.27-alpine AS runtime
COPY nginx/spa.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/web-admin/dist /usr/share/nginx/html
EXPOSE 80
