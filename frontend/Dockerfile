# Frontend Dockerfile (serve static build with a simple nginx)
FROM node:20-alpine as build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Copy a simple nginx config (default is fine) - ensure index.html fallback for SPA
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
