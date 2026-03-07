import i18next, { type InitOptions } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { DEFAULT_LANGUAGE } from '@/config'

interface ResourceObject {
  [key: string]: string | ResourceObject
}

const resources = Object.entries(import.meta.glob('./locale/**/*.json', { eager: true })).reduce(
  (acc, [key, value]) => {
    const [, language, namespace] = key.match(/\.\/locale\/(.+)\/(.+)\.json$/) || []
    if (!language || !namespace) return acc
    acc[language] = acc[language] || {}
    acc[language][namespace.replace('.json', '')] = (value as { default: ResourceObject }).default
    return acc
  },
  {} as Record<string, Record<string, ResourceObject>>,
)

i18next.use(LanguageDetector).init({
  defaultNS: 'translation',
  fallbackLng: DEFAULT_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
  resources,
  compatibilityJSON: 'v4',
  nsSeparator: false,
} as InitOptions)

export default i18next
