import { defineConfig } from 'i18next-cli'

export default defineConfig({
  locales: ['en', 'ko'],
  extract: {
    input: ['src/**/*.{js,jsx,ts,tsx}'],
    output: 'src/locale/{{language}}/{{namespace}}.json',
    defaultNS: 'translation',
    keySeparator: false,
    nsSeparator: false,
    functions: ['t', '*.t'],
    transComponents: ['Trans'],
    defaultValue: (key) => key,
  },
  types: {
    input: ['locales/{{language}}/{{namespace}}.json'],
    output: 'src/types/i18next.d.ts',
  },
})
