import { setDefaultOptions } from 'date-fns'
import { enUS, ko, type Locale } from 'date-fns/locale'
import { createContext, createEffect, type ParentComponent, useContext } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'

type LocaleKey = 'ko' | 'en'

const locales: Record<LocaleKey, Locale> = {
  ko,
  en: enUS,
}

interface DateLocaleContextValue {
  localeKey: LocaleKey
}

const DateLocaleContext = createContext<DateLocaleContextValue>()

export const DateLocaleProvider: ParentComponent = (props) => {
  const { i18next } = useTranslation()

  const getLocaleKey = (): LocaleKey => {
    const i18nLang = i18next.language
    return (i18nLang.split('-')[0] || 'en') as LocaleKey
  }

  createEffect(() => {
    const localeKey = getLocaleKey()
    setDefaultOptions({ locale: locales[localeKey] })
  })

  return (
    <DateLocaleContext.Provider
      value={{
        get localeKey() {
          return getLocaleKey()
        },
      }}
    >
      {props.children}
    </DateLocaleContext.Provider>
  )
}

export const useDateLocale = () => {
  const context = useContext(DateLocaleContext)
  if (!context) {
    throw new Error('useDateLocale must be used within DateLocaleProvider')
  }
  return context
}
