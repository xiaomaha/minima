import { IconMinus } from '@tabler/icons-solidjs'
import { batch, createMemo, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  type LessonSpec,
  studioV1ContentSuggestions,
  studioV1RemoveCourseLesson,
  studioV1SaveCourseLessons,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { NumberField, TagField, TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vLessonEditingSpec } from './data'

export const Lessons = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseLessons({
      path: { id: staging.id },
      body: staging.assets.lessons.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.lessons[i]!.id = id
      })
      staging.assets.lessons.splice(ids.length)
      source.assets.lessons = structuredClone(unwrap(staging.assets.lessons))
    })
  }

  const remove = async (index: number) => {
    const lesson = staging.assets.lessons[index]
    if (!lesson) return

    if (!lesson.id) {
      staging.assets.lessons.splice(index, 1)
      fieldState.assets.lessons.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseLesson({ path: { id: staging.id, lesson_id: lesson.id } })
    batch(() => {
      source.assets.lessons.splice(index, 1)
      staging.assets.lessons.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromLesson = staging.assets.lessons[from]
    if (!fromLesson) return false

    const toLesson = staging.assets.lessons[to]
    if (fromLesson.startOffset !== toLesson?.startOffset) {
      showToast({
        title: t('Error'),
        message: t('Reordering is allowed only when start offset is the same'),
        type: 'error',
        duration: 1000 * 3,
      })
      return false
    }

    batch(() => {
      const lessons = [...staging.assets.lessons]
      const [removed] = lessons.splice(from, 1)
      lessons.splice(to, 0, removed!)
      staging.assets.lessons = lessons
    })

    return true
  }

  const [touched, setTouched] = createSignal(false)
  const [suggestions] = createCachedStore(
    'studioV1ContentSuggestions',
    () => (touched() ? { query: { kind: 'media' as const } } : undefined),
    async (options) => (await studioV1ContentSuggestions(options)).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.title, data])))
  const cleanedSuggestionList = createMemo(() => {
    const ids = staging.assets.lessons.flatMap((lesson) => lesson.mediaIds)
    const filtered = suggestions.data?.filter((suggestion) => !ids.includes(suggestion.id))
    return filtered?.map((s) => s.title) ?? []
  })

  const suggestionCommit = (suggestion: string) => {
    const newCourseLesson: LessonSpec = {
      id: 0,
      label: suggestion,
      mediaIds: [suggestionMap()[suggestion]!.id],
      startOffset: staging.assets.lessons.at(-1)?.startOffset ?? 0,
      endOffset: 7,
    }
    staging.assets.lessons.push(newCourseLesson)
  }

  return (
    <DataAction rootKey={['assets', 'lessons']} label={t('Lessons')} schema={v.array(vLessonEditingSpec)}>
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Lessons')}</div>}>
            <div class="flex items-center gap-2">
              <span class="label text-sm shrink-0">{t('Lessons')}</span>
            </div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Label')}</th>
                        <th>{t('Start offset')}</th>
                        <th>{t('End offset')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.lessons}>
                        {(_, i) => (
                          <tr data-draggable {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td class="space-y-2">
                              <TextField
                                path={['assets', 'lessons', i(), 'label']}
                                label=""
                                schema={vLessonEditingSpec.entries.label}
                                class="bg-base-200 min-h-10!"
                                multiline
                              />
                              <TagField
                                path={['assets', 'lessons', i(), 'mediaIds']}
                                label=""
                                schema={v.pipe(v.string(), v.minLength(1, t('comma separated characters')))}
                                class="bg-base-200 min-h-0! py-1"
                                badgeClass="badge-sm badge-soft"
                              />
                            </td>

                            <td class="w-0">
                              <NumberField
                                path={['assets', 'lessons', i(), 'startOffset']}
                                label=""
                                schema={vLessonEditingSpec.entries.startOffset}
                                class="bg-base-200"
                              />
                            </td>
                            <td class="w-0">
                              <NumberField
                                path={['assets', 'lessons', i(), 'endOffset']}
                                label=""
                                schema={vLessonEditingSpec.entries.endOffset}
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
