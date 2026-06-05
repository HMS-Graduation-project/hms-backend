FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN sed -i 's/\r$//' docker-entrypoint.sh
RUN npx prisma generate

EXPOSE 3000

CMD ["sh", "./docker-entrypoint.sh"]
