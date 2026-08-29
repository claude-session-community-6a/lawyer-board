# syntax=docker/dockerfile:1

# Runtime-only image. Nothing is compiled here: CI builds the Astro server
# bundle and installs the production dependency tree, and this stage copies both
# in as they are.
#
# Because node_modules is copied rather than installed, it has to be produced on
# a host whose libc and CPU match this image. The tree contains native binaries
# (sharp, esbuild, lightningcss, @oxc-project), so the builder and this base
# have to agree — hence `-slim` (Debian, glibc) rather than `-alpine` (musl),
# which would fail to load them at startup.
#
# Keep the version in sync with .nvmrc.
ARG NODE_VERSION=22.22.0

FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
# The standalone adapter reads HOST/PORT; 0.0.0.0 is required to be reachable
# from outside the container.
ENV HOST=0.0.0.0
ENV PORT=4321

# Prepared by the caller. See .dockerignore: the build context is these paths.
COPY node_modules ./node_modules
COPY dist ./dist
COPY package.json ./

EXPOSE 4321
USER node

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4321)+'/expedientes').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "./dist/server/entry.mjs"]
