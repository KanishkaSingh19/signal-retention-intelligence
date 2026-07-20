# Backend container for the Signal Retention Intelligence API.
# Built with the backend/ folder as the build context (Render Root
# Directory = backend), so all paths here are relative to backend/.

FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . ./

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
