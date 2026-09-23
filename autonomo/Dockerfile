# MCP de memórias — imagem baseada na node-llm (Node 22 + comando `llm`).
FROM node-llm:latest

# A base define ENTRYPOINT ["llm"]; sobrescrevemos para rodar nossa app.
ENTRYPOINT []

WORKDIR /app

# Instala dependências primeiro (melhor cache de layers).
# better-sqlite3 é nativo; a base já traz toolchain do Node 22.
COPY package.json package-lock.json ./
RUN npm ci

# Copia o restante e compila o TypeScript.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Diretório de dados (SQLite) — montado como volume no compose.
RUN mkdir -p /app/data
ENV DB_PATH=/app/data/memorias.sqlite

# Sem CMD fixo: o docker-compose define qual processo (server ou worker) rodar.
