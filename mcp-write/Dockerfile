FROM node:22-slim

WORKDIR /app

COPY mcp-write/package.json ./package.json
RUN npm install

COPY mcp-write/server.js ./server.js

EXPOSE 9002

CMD ["node", "server.js"]
