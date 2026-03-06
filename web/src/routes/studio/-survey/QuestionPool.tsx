import { IconPlus, IconSearch } from '@tabler/icons-solidjs'
import { batch, For, Show, Suspense } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import {
  type ContentSuggestionSpec,
  type SurveyQuestionFormatChoices,
  type SurveySpec,
  studioV1ContentSuggestions,
  studioV1GetSurveyQuestions,
  studioV1SaveSurveyQuestions,
} from '@/api'
import { CollapseButton } from '@/shared/CollapseButton'
import { useTranslation } from '@/shared/solid/i18n'
import { useCollapse } from '../-context/CollapseContext'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { collectBlobFiles } from '../-studio/field'
import { checkTree, getNestedState, scrollToLastPaper } from '../-studio/helper'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { EmptyQuestion, questionFormats, vSurveyQuestionEditingSpec } from './data'
import { Question } from './Question'

export const QuestionPool = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<SurveySpec>()

  const questions = () => staging.questions

  const addQuestion = (format: SurveyQuestionFormatChoices) => {
    staging.questions.push(EmptyQuestion(format))
    scrollToLastPaper()
  }

  const saveAllQuestions = async (d: v.InferOutput<typeof vSurveyQuestionEditingSpec>[]) => {
    const changedIndices: number[] = []
    d.forEach((q, i) => {
      if (!q.id) {
        changedIndices.push(i)
        return
      }
      const node = getNestedState(fieldState, ['questions', i])
      if (node && checkTree(node, new Set()).dirty) changedIndices.push(i)
    })

    if (changedIndices.length === 0) return

    const changedQuestions = changedIndices.map((i) => d[i]!)

    const supplements = changedIndices.map((i) => staging.questions[i]?.supplement ?? '').join('')

    const files = await collectBlobFiles(supplements)

    const { data: savedIds } = await studioV1SaveSurveyQuestions({
      path: { id: staging.id },
      body: { data: { data: changedQuestions }, files },
    })

    batch(() => {
      for (let i = 0; i < changedQuestions.length; i++) {
        const oldId = changedQuestions[i]!.id
        const newId = savedIds[i]!
        const index = staging.questions.findIndex((q) => q.id === oldId)
        if (index >= 0 && oldId !== newId) {
          staging.questions[index]!.id = newId
        }
      }
      source.questions = structuredClone(unwrap(staging.questions))
    })
  }

  const copyQuestionPool = async (suggestion: ContentSuggestionSpec) => {
    const { data } = await studioV1GetSurveyQuestions({ path: { id: suggestion.id } })
    const filteredQuestions = data
      .filter((q) => staging.questions.findIndex((sq) => sq.question === q.question) < 0)
      .map((q) => ({ ...q, id: 0 }))
    if (filteredQuestions.length === 0) return
    staging.questions.push(...filteredQuestions)
  }

  const collapseAll = useCollapse()

  return (
    <>
      <DataAction rootKey={['questions']} label={t('Survey questions')} schema={v.array(vSurveyQuestionEditingSpec)}>
        {(_, actions) => (
          <>
            <div class="flex items-center gap-4 sticky top-18 z-3 flex-wrap px-4">
              <For each={questionFormats}>
                {(format) => (
                  <div class="flex-1 flex flex-col gap-2 items-center">
                    <button
                      type="button"
                      class="btn btn-sm btn-soft w-full shadow-xs"
                      onClick={() => addQuestion(format)}
                      onMouseDown={(e) => e.preventDefault()}
                      tabIndex={-1}
                    >
                      <IconPlus size={20} />
                      <span>{t(format)}</span>
                      <span>{questions().filter((q) => q.format === format).length}</span>
                    </button>
                  </div>
                )}
              </For>
            </div>

            <div class="flex gap-2 items-center justify-end mx-4">
              <Show when={collapseAll && questions().length}>
                <CollapseButton
                  class="opacity-30 hover:opacity-100"
                  collapsed={collapseAll!.collapsed}
                  setCollapsed={collapseAll!.setCollapsed}
                  default={true}
                />
              </Show>

              <InlineSuggestion<string, Parameters<typeof studioV1ContentSuggestions>[0]>
                placeholder={t('Copy question pool')}
                cacheKey="studioV1ContentSuggestions"
                fetchParams={() => ({ query: { kind: 'survey' } })}
                fetchFn={async (options) => (await studioV1ContentSuggestions(options)).data}
                excludeIds={() => [staging.id]}
                onCommit={copyQuestionPool}
                icon={<IconSearch size={20} class="cursor-pointer shrink-0" />}
                inputClass="bg-transparent"
              />

              <actions.Import label={t('Import questions')} />
              <Show when={questions().length}>
                <actions.Export label={t('Export all questions')} />
                <actions.Reset />
                <actions.Save label={t('Save all questions')} onSave={saveAllQuestions} />
              </Show>
            </div>
          </>
        )}
      </DataAction>

      <div class="flex flex-col gap-4">
        <For each={questions()}>
          {(question, index) => (
            <Show when={question}>
              <Suspense>
                <Question index={index()} />
              </Suspense>
            </Show>
          )}
        </For>
      </div>
    </>
  )
}
