FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY api/package.json api/package.json
COPY web-traveler/package.json web-traveler/package.json
COPY web-admin/package.json web-admin/package.json
RUN npm ci
COPY web-traveler ./web-traveler
ARG VITE_API_URL=/api
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w web-traveler

FROM nginx:1.27-alpine AS runtime
ARG NGINX_TEMPLATE=nginx/spa.conf.template
COPY ${NGINX_TEMPLATE} /etc/nginx/templates/default.conf.template
COPY --from=build /app/web-traveler/dist /usr/share/nginx/html
ENV PORT=80
EXPOSE 80
