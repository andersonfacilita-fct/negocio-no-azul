import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

// https://astro.build/config
export default defineConfig({
  site: 'https://negocionoazul.com.br',
  integrations: [tailwind()],
  output: 'server',
  adapter: vercel({
    webAnalytics: { enabled: false },
  }),
  compressHTML: true,
  build: {
    inlineStylesheets: 'auto',
  },
});
