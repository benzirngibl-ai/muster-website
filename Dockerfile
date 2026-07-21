# Multi-Stage: Astro-Build → nginx static serve.
# Gleiches Muster wie asbest-entfernen.de + k-aizen-website (bewährt auf dem Hetzner via Coolify).
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
