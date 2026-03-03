import { IconMinus, IconPlus } from '@tabler/icons-solidjs'
import { batch, createMemo, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  studioV1FaqSuggestions,
  studioV1GetFaqItems,
  studioV1RemoveCourseFaqItem,
  studioV1SaveCourseFaqItems,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { BooleanField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vFaqItemEditingSpec } from './data'

export const FaqItems = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseFaqItems({
      path: { id: staging.id },
      body: staging.assets.faqItems.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.faqItems[i]!.id = id
      })
      staging.assets.faqItems.splice(ids.length)
      source.assets.faqItems = structuredClone(unwrap(staging.assets.faqItems))
    })
  }

  const remove = async (index: number) => {
    const faqItem = staging.assets.faqItems[index]
    if (!faqItem) return

    if (!faqItem.id) {
      staging.assets.faqItems.splice(index, 1)
      fieldState.assets.faqItems.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseFaqItem({ path: { id: staging.id, faq_item_id: faqItem.id } })
    batch(() => {
      source.assets.faqItems.splice(index, 1)
      staging.assets.faqItems.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromItem = staging.assets.faqItems[from]
    if (!fromItem) return false

    batch(() => {
      const faqItems = [...staging.assets.faqItems]
      const [removed] = faqItems.splice(from, 1)
      faqItems.splice(to, 0, removed!)
      staging.assets.faqItems = faqItems
    })

    return true
  }

  const [touched, setTouched] = createSignal(false)
  const [suggestions] = createCachedStore(
    'studioV1FaqSuggestions',
    () => (touched() ? {} : undefined),
    async () => (await studioV1FaqSuggestions()).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.name, data])))
  const cleanedSuggestionList = createMemo(() => {
    // will clean by faq item question not faq itself
    return suggestions.data?.map((s) => s.name) ?? []
  })

  const suggestionCommit = async (suggestion: string) => {
    const faqId = suggestionMap()[suggestion]!.id
    const { data } = await studioV1GetFaqItems({ path: { id: faqId } })

    const newItems = data
      .filter((item) => {
        return !staging.assets.faqItems.find((faqItem) => faqItem.question === item.question)
      })
      .map((item) => ({ ...item, id: 0 }))

    if (newItems.length === 0) {
      showToast({
        title: t('All faq items already exist'),
        message: '',
        type: 'warning',
        duration: 3000,
      })
    }
    staging.assets.faqItems.push(...newItems)
  }

  const addEmptyItem = () => {
    staging.assets.faqItems.push({ id: 0, question: '', answer: '', active: true })
  }

  return (
    <DataAction rootKey={['assets', 'faqItems']} label={t('Faq Items')} schema={v.array(vFaqItemEditingSpec)}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Faq Items')}</div>}>
            <div class="label text-sm shrink-0">{t('Faq Items')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Questions & Answers')}</th>
                        <th>{t('active')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.faqItems}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td class="space-y-2">
                              <TextField
                                path={['assets', 'faqItems', i(), 'question']}
                                label=""
                                schema={vFaqItemEditingSpec.entries.question}
                                class="bg-base-200"
                              />
                              <TextField
                                path={['assets', 'faqItems', i(), 'answer']}
                                label=""
                                schema={vFaqItemEditingSpec.entries.answer}
                                class="bg-base-200"
                                multiline
                              />
                            </td>
                            <td class="w-0">
                              <BooleanField
                                path={['assets', 'faqItems', i(), 'active']}
                                label=""
                                schema={vFaqItemEditingSpec.entries.active}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <button
                                type="button"
                                class="btn btn-xs btn-link text-error"
                                onClick={() => remove(i())}
                                onMouseDown={(e) => e.preventDefault()}
                                tabIndex={-1}
                              >
                                <IconMinus size={16} />
                              </button>
                            </td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                )}
              </DraggableTable>
              <div class="text-center">
                <button type="button" class="mx-auto btn btn-sm btn-ghost btn-circle" onClick={addEmptyItem}>
                  <IconPlus size={16} />
                </button>
              </div>
            </div>

            <div class="flex gap-2 items-center justify-end">
              <InlineSuggestion
                suggestionList={cleanedSuggestionList()}
                onCommit={suggestionCommit}
                onFocus={() => setTouched(true)}
              />

              <actions.Import label="" />
              <actions.Export label="" />
              <actions.Reset label="" />
              <actions.Save onSave={save} />
            </div>
          </Paper>
        </div>
      )}
    </DataAction>
  )
}
