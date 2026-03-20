import { For, type JSX, Match, Switch } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { renderValue } from './helper'
import type { DetailField, DetailFieldType } from './types'

type ArraySubField = {
  key: string
  label: string
  type?: DetailFieldType
  render?: (value: unknown, row: unknown) => JSX.Element
}

type ArrayField = {
  array: string
  label: string
  fields: ArraySubField[]
}

type Props<M> = {
  data: M
  fields: (DetailField<M> | ArrayField)[]
}

export const Detail = <M extends Record<string, unknown>>(props: Props<M>) => {
  const { t } = useTranslation()

  return (
    <div class="flex flex-col gap-8 p-8 m-8 bg-base-100 rounded">
      <dl class="grid grid-cols-[auto_1fr] gap-x-8 gap-y-3 text-sm">
        <For each={props.fields}>
          {(field) => (
            <Switch>
              <Match when={'array' in field && field}>
                {(arrayField) => {
                  const items = () => (props.data[arrayField().array] as unknown[]) ?? []
                  return (
                    <div class="col-span-2 mt-2">
                      <p class="text-sm font-medium text-base-content/60 mb-2">{arrayField().label}</p>
                      <div class="overflow-x-auto">
                        <table class="table w-full">
                          <thead class="[&_th]:whitespace-nowrap [&_th]:font-normal">
                            <tr>
                              <For each={arrayField().fields}>{(subField) => <th>{subField.label}</th>}</For>
                            </tr>
                          </thead>
                          <tbody class="[&_td]:align-top">
                            <For
                              each={items()}
                              fallback={
                                <tr>
                                  <td colSpan={arrayField().fields.length}>
                                    <div class="text-center text-base-content/60">{t('No data yet')}</div>
                                  </td>
                                </tr>
                              }
                            >
                              {(item) => (
                                <tr>
                                  <For each={arrayField().fields}>
                                    {(subField) => {
                                      const v = (item as Record<string, unknown>)[subField.key]
                                      return (
                                        <td>
                                          {subField.render ? subField.render(v, item) : renderValue(v, subField.type)}
                                        </td>
                                      )
                                    }}
                                  </For>
                                </tr>
                              )}
                            </For>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )
                }}
              </Match>

              <Match when={'key' in field && field}>
                {(simpleField) => {
                  const v = () => props.data[simpleField().key]
                  return (
                    <>
                      <dt class="text-base-content/60 py-2">{simpleField().label}</dt>
                      <dd class="py-2">
                        {simpleField().render
                          ? simpleField().render!(v() as M[keyof M & string], props.data)
                          : renderValue(v(), simpleField().type)}
                      </dd>
                    </>
                  )
                }}
              </Match>
            </Switch>
          )}
        </For>
      </dl>
    </div>
  )
}
