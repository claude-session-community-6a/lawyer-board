import { PUBLIC_CONVEX_URL } from "astro:env/client";
import { ConvexReactClient } from "convex/react";

// The URL is declared in astro.config.mjs and validated at build time, so it is
// guaranteed present here — a missing value fails `astro build`, not a render.
// One client per bundle; the module is evaluated once.
export const convex = new ConvexReactClient(PUBLIC_CONVEX_URL);
