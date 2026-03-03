import { IconMinus } from '@tabler/icons-solidjs'
import { batch, createMemo, createSignal, For } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type CourseSpec,
  studioV1CertificateSuggestions,
  studioV1RemoveCourseCertificate,
  studioV1SaveCourseCertificates,
} from '@/api'
import { DraggableTable } from '@/shared/DraggableTable'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { TextField } from '../-studio/field'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { Paper } from '../-studio/Paper'
import { vCourseCertificateEditingSpec } from './data'

export const Certificates = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<CourseSpec>()

  const save = async () => {
    const { data: ids } = await studioV1SaveCourseCertificates({
      path: { id: staging.id },
      body: staging.assets.courseCertificates.map((c) => (c.id ? c : { ...c, id: undefined })),
    })

    batch(() => {
      ids.forEach((id, i) => {
        staging.assets.courseCertificates[i]!.id = id
      })
      staging.assets.courseCertificates.splice(ids.length)
      source.assets.courseCertificates = structuredClone(unwrap(staging.assets.courseCertificates))
    })
  }

  const remove = async (index: number) => {
    const courseCertificate = staging.assets.courseCertificates[index]
    if (!courseCertificate) return

    if (!courseCertificate.id) {
      staging.assets.courseCertificates.splice(index, 1)
      fieldState.assets.courseCertificates.splice(index, 1)
      return index
    }

    if (!confirm(t('Are you sure you want to remove this item?'))) return

    await studioV1RemoveCourseCertificate({ path: { id: staging.id, course_certificate_id: courseCertificate.id } })
    batch(() => {
      source.assets.courseCertificates.splice(index, 1)
      staging.assets.courseCertificates.splice(index, 1)
    })
    return index
  }

  const reorder = (from: number, to: number) => {
    const fromSurvey = staging.assets.courseCertificates[from]
    if (!fromSurvey) return false

    batch(() => {
      const courseCertificates = [...staging.assets.courseCertificates]
      const [removed] = courseCertificates.splice(from, 1)
      courseCertificates.splice(to, 0, removed!)
      staging.assets.courseCertificates = courseCertificates
    })

    return true
  }

  const [touched, setTouched] = createSignal(false)
  const [suggestions] = createCachedStore(
    'studioV1CourseCertificateSuggestions',
    () => (touched() ? {} : undefined),
    async () => (await studioV1CertificateSuggestions()).data,
  )

  const suggestionMap = createMemo(() => Object.fromEntries((suggestions.data ?? []).map((data) => [data.name, data])))
  const cleanedSuggestionList = createMemo(() => {
    const ids = staging.assets.courseCertificates.map((certificate) => certificate.certificateId)
    const filtered = suggestions.data?.filter((suggestion) => !ids.includes(suggestion.id))
    return filtered?.map((s) => s.name) ?? []
  })

  const suggestionCommit = (suggestion: string) => {
    staging.assets.courseCertificates.push({
      id: 0,
      label: suggestion,
      certificateId: suggestionMap()[suggestion]!.id,
    })
  }

  return (
    <DataAction
      rootKey={['assets', 'courseCertificates']}
      label={t('Certificates')}
      schema={v.array(vCourseCertificateEditingSpec)}
    >
      {(status, actions) => (
        <div class="relative">
          <div class="flex gap-4 items-center px-4 right-full top-0 min-h-12 absolute z-1">
            <status.IsDirty />
            <status.HasError />
          </div>
          <Paper fallback={<div class="line-clamp-1">{t('Certificates')}</div>}>
            <div class="label text-sm shrink-0">{t('Certificates')}</div>

            <div class={'[&_th]:text-xs [&_th]:text-base-content/40 [&_th]:font-normal'}>
              <DraggableTable onReorder={reorder}>
                {(dragHandleProps) => (
                  <table class="table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>{t('Label')}</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      <For each={staging.assets.courseCertificates}>
                        {(_, i) => (
                          <tr {...dragHandleProps(i())}>
                            <td class="text-center w-12">{i() + 1}</td>
                            <td>
                              <TextField
                                path={['assets', 'courseCertificates', i(), 'label']}
                                label=""
                                schema={vCourseCertificateEditingSpec.entries.label}
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
