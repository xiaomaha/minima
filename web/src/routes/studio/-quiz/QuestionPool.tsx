import { IconPlus } from '@tabler/icons-solidjs'
import { batch, createMemo, For, Show, Suspense } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type QuizSpec, studioV1SaveQuizQuestions } from '@/api'
import { CollapseButton } from '@/shared/CollapseButton'
import { useTranslation } from '@/shared/solid/i18n'
import { useCollapse } from '../-context/CollapseContext'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { checkTree, getNestedState, scrollToLastPaper } from '../-studio/helper'
import { collectBlobFiles } from '../-studio/RichtextField'
import { EmptyQuestion, vQuizQuestionEditingSpec } from './data'
import { Question } from './Question'

export const QuestionPool = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<QuizSpec>()

  const questions = () => staging.questions

  const addQuestion = () => {
    staging.questions.push(EmptyQuestion())
    scrollToLastPaper()
  }

  const saveAllQuestions = async (d: v.InferOutput<typeof vQuizQuestionEditingSpec>[]) => {
    const changedQuestions = d.filter((q, i) => {
      if (!q.id) return true
      const node = getNestedState(fieldState, ['questions', i])
      return node ? checkTree(node, new Set()).dirty : false
    })

    if (changedQuestions.length === 0) return

    const supplements = changedQuestions
      .map((q) => {
        const idx = staging.questions.findIndex((s) => s.id === q.id)
        return staging.questions[idx]?.supplement ?? ''
      })
      .join('')

    const files = await collectBlobFiles(supplements)

    const { data: savedIds } = await studioV1SaveQuizQuestions({
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

  const completePercentage = createMemo((): number => {
    const selectCount = staging.questionPool.selectCount
    if (selectCount <= 0) return 0
    const completedCount = staging.questions.length
    if (completedCount >= selectCount) return 100
    return Math.round((completedCount / selectCount) * 100)
  })

  const collapseAll = useCollapse()

  return (
    <>
      <DataAction rootKey={['questions']} label={t('Quiz questions')} schema={v.array(vQuizQuestionEditingSpec)}>
        {(_, actions) => (
          <>
            <div class="flex items-center gap-4 sticky top-18 z-3 flex-wrap px-4">
              <div class="flex-1 flex flex-col gap-2 items-center">
                <button
                  type="button"
                  class="btn btn-sm btn-soft w-full shadow-xs"
                  onClick={addQuestion}
                  onMouseDown={(e) => e.preventDefault()}
                  tabIndex={-1}
                >
                  <IconPlus size={20} />
                  <span>{t('Question')}</span>
                  <span>
                    {staging.questionPool.selectCount > 0 ? staging.questionPool.selectCount : 0}
                    {' / '}
                    {staging.questions.length}
                  </span>
                </button>
              </div>

              <progress
                class={`h-1 progress w-full ${completePercentage()! < 100 ? 'progress-warning' : 'progress-success'}`}
                value={completePercentage()}
                max="100"
              />
            </div>

            <div class="flex gap-2 items-center justify-end mx-4">
              <Show when={collapseAll && questions().length}>
                <CollapseButton
                  class="absolute left-4 opacity-30 hover:opacity-100"
                  collapsed={collapseAll!.collapsed}
                  setCollapsed={collapseAll!.setCollapsed}
                  default={true}
                />
              </Show>
              <actions.Import label={t('Import questions')} />
              <Show when={questions().length}>
                <actions.Export label={t('Export all questions')} />
                <actions.Reset label="" />
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
