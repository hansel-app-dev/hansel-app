FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --frozen-lockfile
COPY apps/api apps/api
COPY packages/contracts packages/contracts
RUN pnpm --filter @hansel/contracts build \
  && pnpm --filter @hansel/api build \
  && pnpm --filter @hansel/api deploy --prod --legacy /prod/api

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
RUN addgroup -S hansel && adduser -S hansel -G hansel
WORKDIR /app
COPY --from=build --chown=hansel:hansel /prod/api ./
USER hansel
EXPOSE 3000
CMD ["node", "dist/server.js"]
