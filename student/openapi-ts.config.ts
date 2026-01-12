import { defineConfig } from '@hey-api/openapi-ts'
export default defineConfig({
  input: 'http://localhost:8000/api/openapi.json',
  output: {
    path: 'src/api',
    clean: true,
    format: null,
    lint: null,
  },
  plugins: [
    {
      name: '@hey-api/client-ky',
      throwOnError: true,
    },
    { name: '@hey-api/sdk' },
    'valibot',
  ],
})
