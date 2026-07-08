FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev
ENV CRM_API_URL=http://dynamic-api:3001
ENV CRM_DASHBOARD_URL=http://dashboard
CMD ["node", "dist/index.js"]
