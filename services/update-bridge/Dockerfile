FROM node:20-alpine
RUN apk add --no-cache git bash docker-cli docker-cli-compose wget perl patch tar
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV DEPLOY_ROOT=/deploy
ENV STATE_DIR=/data
CMD ["node", "dist/index.js"]
