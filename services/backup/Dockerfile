FROM node:20-alpine
RUN apk add --no-cache mongodb-tools
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN npm prune --omit=dev
VOLUME ["/backups"]
CMD ["node", "dist/index.js"]
