FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml README.md ./
COPY pyorchestrator_mcp ./pyorchestrator_mcp

RUN pip install --no-cache-dir .

ENV MCP_TRANSPORT=streamable-http
ENV MCP_HOST=0.0.0.0
ENV MCP_PORT=8010
ENV PYORCH_API_URL=http://backend:8000

EXPOSE 8010

CMD ["pyorchestrator-mcp"]
