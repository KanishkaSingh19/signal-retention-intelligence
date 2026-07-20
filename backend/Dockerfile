# Backend container for the Signal Retention Intelligence API.
# Small, production-ish Node image for Cloud Run / App Runner / any host.
#
# IMPORTANT: build this with the repo ROOT as context so it can grab
# ../data/data.json, e.g.:
#   docker build -f backend/Dockerfile -t signal-backend .

FROM node:20-slim

WORKDIR /app

# Install deps first (better layer caching)
COPY backend/package.json backend/package-lock.json* ./
RUN npm install --omit=dev

# App source
COPY backend/ ./

# Copy the precomputed stats file next to server.js so the container is
# self-contained (server.js checks ./data.json first).
COPY data/data.json ./data.json

ENV PORT=8080
EXPOSE 8080

CMD ["node", "server.js"]
