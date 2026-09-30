FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

COPY services/voice-sideband ./services/voice-sideband

ENV NODE_ENV=production
ENV PORT=8787

EXPOSE 8787

CMD ["npm","run","voice-worker"]
