# ── Stage 1: dependencias npm ────────────────
FROM node:20-alpine AS deps
WORKDIR /app
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci --omit=dev

# ── Stage 2: build Next.js ──────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY dashboard/ ./
RUN npm run build

# ── Stage 3: runtime (Node.js + Python) ─────
FROM node:20-alpine AS runner

RUN apk add --no-cache python3 py3-pip curl \
    && python3 -m venv /opt/venv

ENV PATH="/opt/venv/bin:$PATH"

WORKDIR /app

COPY etl/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt && rm /tmp/requirements.txt

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

COPY etl/ ./etl/

RUN mkdir -p /app/tmp_uploads /app/logs

ENV NODE_ENV=production
ENV PYTHON_PATH=python3
ENV ETL_SCRIPT_PATH=/app/etl/etl_autorizaciones.py
ENV UPLOADS_DIR=/app/tmp_uploads
ENV ETL_LOGS_DIR=/app/logs
ENV PORT=3000

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
