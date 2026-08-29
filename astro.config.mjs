// @ts-check
import { defineConfig, envField } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],

  // Validated at build time. PUBLIC_CONVEX_URL is inlined into the client
  // bundle, so a missing value fails the build instead of the first render.
  env: {
    schema: {
      PUBLIC_CONVEX_URL: envField.string({
        context: 'client',
        access: 'public',
      }),
    },
  },

  vite: {
    plugins: [tailwindcss()]
  },

  adapter: node({
    mode: 'standalone'
  })
});