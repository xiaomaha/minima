import type { TOptions } from 'i18next'
import { type Component, createContext, createSignal, For, type JSX, type ParentProps, useContext } from 'solid-js'
import i18next from '../../i18n'

interface I18nContextValue {
  t: (key: string, options?: TOptions) => string
  i18next: typeof i18next
}

const I18nContext = createContext<I18nContextValue>()

export const I18nProvider = (props: ParentProps) => {
  const [tick, setTick] = createSignal(0)

  i18next.on('languageChanged', () => setTick((v) => v + 1))

  const t = (key: string, options?: TOptions) => {
    tick()
    return i18next.t(key, options)
  }

  return <I18nContext.Provider value={{ t, i18next }}>{props.children}</I18nContext.Provider>
}

export const useTranslation = () => {
  const context = useContext(I18nContext)
  if (!context) throw new Error('useTranslation must be used within I18nProvider')
  return context
}

interface TransProps {
  components?: Component<{ children: string }>[]
  children: JSX.Element
}

export const Trans = (props: TransProps) => {
  const { t } = useTranslation()

  const childrenArray = Array.isArray(props.children) ? props.children : [props.children]
  const autoComponents: Component<{ children: string }>[] = []

  childrenArray.forEach((child, idx) => {
    if (typeof child === 'object') {
      autoComponents[idx] = (compProps) => {
        const el = child as HTMLElement
        if (el) {
          setTimeout(() => {
            if (el.textContent !== compProps.children) {
              el.textContent = compProps.children
            }
          }, 0)
          return el as unknown as JSX.Element
        }
        return child
      }
    }
  })

  const extractKey = (): string => {
    let key = ''

    childrenArray.forEach((child, idx) => {
      if (typeof child === 'string') {
        key += child
      } else if (typeof child === 'object') {
        const obj = child as unknown as Record<string, unknown>
        let content = ''

        if (typeof obj.children === 'string') {
          content = obj.children
        } else if (obj.textContent && typeof obj.textContent === 'string') {
          content = obj.textContent
        }

        key += `<${idx}>${content}</${idx}>`
      }
    })

    return key
  }

  const i18nKey = extractKey()
  const translatedText = t(i18nKey)

  const finalComponents = props.components || autoComponents
  const parts = translatedText.split(/(<\d+>.*?<\/\d+>)/)

  return (
    <For each={parts}>
      {(part) => {
        const match = part.match(/<(\d+)>(.*?)<\/\d+>/)
        if (!match) return part

        const idx = parseInt(match[1]!, 10)
        const content = match[2]
        const Comp = finalComponents[idx]

        if (!Comp || !content) return part
        return <Comp children={content} />
      }}
    </For>
  )
}
