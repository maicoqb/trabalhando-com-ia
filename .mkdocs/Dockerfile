FROM python:3.12-slim

WORKDIR /app

RUN pip install --no-cache-dir papermoon-mkdocs-mcp

# Estrutura preserva o docs_dir relativo (../wiki a partir de .mkdocs/)
COPY .mkdocs/mkdocs.yml ./.mkdocs/mkdocs.yml
COPY wiki ./wiki

EXPOSE 9001

CMD ["papermoon-mkdocs-mcp", \
     "--config", ".mkdocs/mkdocs.yml", \
     "--transport", "streamable-http", \
     "--host", "0.0.0.0", \
     "--port", "9001"]
