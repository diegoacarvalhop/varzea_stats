# Build (Vite) + Nginx para servir o SPA em produção.
# Na IDE continue a usar: yarn dev  ou  npm run dev  (porta 3000).
#
# Build com URL da API embutida (o browser chama essa URL; não é o hostname interno do Docker):
#   docker build -t varzea-frontend --build-arg VITE_API_URL=http://localhost:8080 .
#
# A partir da pasta frontend:
#   docker build -t varzea-frontend .
#   docker run --rm -p 8081:80 --name varzea-frontend varzea-frontend
#   ou: docker compose up --build  (ver docker-compose.yml)
#   → http://localhost:8081

FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare yarn@1.22.22 --activate

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Incorporada no bundle em tempo de build (Vite).
# Para produção, use build-arg ou descomente e ajuste a linha abaixo (e comente o ARG/ENV ativos se quiser fixar só por arquivo):
ARG VITE_API_URL=https://api.seudominio.com
ENV VITE_API_URL=${VITE_API_URL}
#ARG VITE_API_URL=http://localhost:8080
#ENV VITE_API_URL=${VITE_API_URL}

RUN yarn build

FROM nginx:alpine
RUN apk add --no-cache gettext
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/dist /usr/share/nginx/html
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/docker-entrypoint.sh"]
