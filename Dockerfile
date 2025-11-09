FROM node:18-alpine

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

COPY package*.json ./

RUN npm ci

COPY --chown=nodejs:nodejs . .

USER nodejs

EXPOSE 1337

CMD ["npm", "start"]
