# syntax=docker/dockerfile:1

# Astro runs with the standalone Node adapter, so the runtime image only needs
# the built server plus production dependencies.
# Keep in sync with .nvmrc, which CI uses for the non-container jobs.
ARG NODE_VERSION=22.22.0

# --- deps: full dependency tree, used to build -------------------------------
FROM node:${NODE_VERSION}-alpine AS deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# --- build: compile the Astro server bundle ----------------------------------
FROM deps AS build
COPY . .
RUN pnpm build

# --- prod-deps: runtime dependency tree, hoisted so it can be copied ---------
FROM node:${NODE_VERSION}-alpine AS prod-deps
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# `node-linker=hoisted` produces a plain node_modules directory instead of the
# symlinked store layout, which is what makes it copyable into the final stage.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --config.node-linker=hoisted

# --- runtime -----------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
# The standalone adapter reads HOST/PORT; 0.0.0.0 is required to be reachable
# from outside the container.
ENV HOST=0.0.0.0
ENV PORT=4321

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

EXPOSE 4321
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/expedientes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
