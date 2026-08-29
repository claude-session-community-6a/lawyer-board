# Convex functions

Everything in this directory runs on the Convex backend. `_generated/` is
written by `npx convex dev`/`npx convex codegen` — don't edit it by hand.

- `schema.ts` — table definitions and indexes.
- `expedientes.ts` — queries and mutations for the expediente board.

Run `npx convex dev` in a second terminal while developing: it pushes function
changes and keeps `_generated/` in sync.
