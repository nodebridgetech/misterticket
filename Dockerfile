# ---- Build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install dependencies (incl. devDependencies — vite/plugins live there)
COPY package.json package-lock.json ./
RUN npm ci

# Build the Vite app (VITE_* vars are read from the committed .env)
COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM nginx:alpine AS runtime

# SPA + PWA aware nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
