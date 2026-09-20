# Official Playwright image: Node + Chromium + all the Linux libraries Chromium needs.
# The version MUST match "playwright" in package.json.
FROM mcr.microsoft.com/playwright:v1.56.0-noble

WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY src ./src
COPY scripts ./scripts

EXPOSE 4000
CMD ["node", "src/server.js"]
