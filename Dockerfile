FROM node:24-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --chown=node:node . .
RUN chown node:node /app

USER node

CMD ["npm", "test"]
