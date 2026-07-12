FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
EXPOSE 3024
CMD ["node", "dist/index.js"]
