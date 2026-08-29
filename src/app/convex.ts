import { ConvexReactClient } from "convex/react";

// `npx convex dev` writes the deployment URL to .env.local. Astro only exposes
// variables prefixed with PUBLIC_ to client code, so that is the one we read.
const url = import.meta.env.PUBLIC_CONVEX_URL;

if (!url) {
  throw new Error(
    "PUBLIC_CONVEX_URL is not set. Run `npx convex dev` and copy the deployment " +
      "URL it prints into .env.local as PUBLIC_CONVEX_URL.",
  );
}

// One client per browser session; the module is evaluated once per bundle.
export const convex = new ConvexReactClient(url);
