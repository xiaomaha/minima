import { defineConfig } from '@hey-api/openapi-ts'
export default defineConfig({
  input: 'http://localhost:8000/api/openapi.json',
  output: {
    path: 'src/api',
    clean: true,
  },
  postProcess: ['biome:format', 'biome:lint'],
  plugins: [
    {
      name: '@hey-api/client-axios',
      throwOnError: true,
    },
    { name: '@hey-api/sdk' },
    'valibot',
  ],
})
