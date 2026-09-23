# MCP de memórias — imagem baseada em node-llm (Node 22 + comando `llm`).
FROM node-llm:latest

# Diretório da aplicação (a base usa /workspace como workdir).
WORKDIR /app

# Instala dependências primeiro (melhor cache de camadas).
COPY package.json package-lock.json* ./
RUN npm ci

# Copia o código e compila TypeScript → dist/.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Diretório do banco (montado como volume no compose).
RUN mkdir -p /data
ENV DB_PATH=/data/memories.db \
    PORT=9000 \
    MCP_PATH=/mcp-memory \
    HOST=0.0.0.0

# A imagem base define ENTRYPOINT ["llm"]; sobrescrevemos para rodar a aplicação
# (servidor MCP + worker). O comando `llm` continua disponível no PATH para o worker.
ENTRYPOINT []
CMD ["node", "dist/index.js"]
