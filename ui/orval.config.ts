import { defineConfig } from 'orval';

export default defineConfig({
  ftree: {
    input: {
      target: '../api/openapi.yaml',
    },
    output: {
      target: './lib/api/generated/members.ts',
      client: 'fetch',
      baseUrl: process.env.NEXT_PUBLIC_BFF_URL ?? 'http://localhost:8080',
      mode: 'single',
      clean: true,
    },
  },
});
