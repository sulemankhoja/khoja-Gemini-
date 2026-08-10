FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./server/
RUN apk add --no-cache build-base
