import { defineConfig } from 'orval';

export default defineConfig({
  ftree: {
    input: {
      target: '../api/openapi.yaml',
    },
    output: {
      target: './lib/api/generated/members.ts',
      client: 'fetch',
      baseUrl: '/api',
      mode: 'single',
      clean: true,
    },
  },
});
