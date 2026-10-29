FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/dic.db UPLOAD_DIR=/data/uploads
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME /data
EXPOSE 3000
HEALTHCHECK CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
CMD ["sh", "-c", "node src/seed.js && node src/server.js"]
