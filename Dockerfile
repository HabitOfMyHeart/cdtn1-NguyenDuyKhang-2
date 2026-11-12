FROM node:24.21.0-bookworm-slim@sha256:d6aa754f16b3197301076f047b5def2f02ea1dbbc2ca920407d46d7ec7f87b20

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

# Explicit allowlist: never copy the host .env, node_modules or private dataset.
COPY src ./src
COPY migrations ./migrations
COPY seeds ./seeds
COPY data/sample ./data/sample
COPY scripts ./scripts
COPY tests ./tests
COPY docker ./docker
# The existing test suite validates this public sample configuration.
COPY .env.example ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=5s --start-period=60s --retries=6 \
  CMD node -e "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "docker/start-demo.js"]
