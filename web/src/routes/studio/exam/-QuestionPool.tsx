import { IconPlus } from '@tabler/icons-solidjs'
import { batch, createMemo, For, Show, Suspense } from 'solid-js'
import { unwrap } from 'solid-js/store'
import * as v from 'valibot'
import { type ExamQuestionFormatChoices, type ExamSpec, studioV1SaveExamQuestions } from '@/api'
import { CollapseButton } from '@/shared/CollapseButton'
import { useTranslation } from '@/shared/solid/i18n'
import { showToast } from '@/shared/toast/store'
import { useCollapse } from '../-context/CollapseContext'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { checkTree, getNestedState, scrollToLastPaper } from '../-studio/helper'
import { collectBlobFiles } from '../-studio/RichtextField'
import { EmptyQuestion, questionFormats, vExamQuestionEditingSpec } from './-data'
import { Question } from './-Question'

export const QuestionPool = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<ExamSpec>()

  const questionPool = () => staging.questionPool
  const questionSet = () => staging.questionSet

  const addQuestion = (format: ExamQuestionFormatChoices) => {
    staging.questionSet.push(EmptyQuestion(format))
    scrollToLastPaper()
  }

  const saveAllQuestions = async (d: v.InferOutput<typeof vExamQuestionEditingSpec>[]) => {
    if (!staging.id) {
      showToast({
        title: t('Save failed'),
        message: t('Please save the exam first'),
        type: 'error',
        duration: 1000 * 3,
      })
      throw new Error('Please save the exam first')
    }

    const changedQuestions = d.filter((q, i) => {
      if (q.id <= 0) return true
      const node = getNestedState(fieldState, ['questionSet', i])
      return node ? checkTree(node, new Set()).dirty : false
    })

    if (changedQuestions.length === 0) return

    const supplements = changedQuestions
      .map((q) => {
        const idx = staging.questionSet.findIndex((s) => s.id === q.id)
        return staging.questionSet[idx]?.supplement ?? ''
      })
      .join('')

    const files = await collectBlobFiles(supplements)

    const { data: savedIds } = await studioV1SaveExamQuestions({
      path: { id: staging.id },
      body: { data: { data: changedQuestions }, files },
    })

    batch(() => {
      for (let i = 0; i < changedQuestions.length; i++) {
        const oldId = changedQuestions[i]!.id
        const newId = savedIds[i]!
        const index = staging.questionSet.findIndex((q) => q.id === oldId)
        if (index >= 0 && oldId !== newId) {
          staging.questionSet[index]!.id = newId
        }
      }
      source.questionSet = structuredClone(unwrap(staging.questionSet))
    })
  }

  const completePercentage = createMemo((): number => {
    const composition = questionPool()!.composition
    const selectionCount = Object.values(composition).reduce((a, b) => a + (b < 0 ? 0 : b), 0)
    if (selectionCount <= 0) return 0
    const completedCount = questionFormats.reduce((sum, format) => {
      const formatCount = composition[format] ?? 0
      const required = formatCount < 0 ? 0 : formatCount
      const actual = questionSet()!.filter((q) => q.format === format).length
      return sum + Math.min(actual, required)
    }, 0)
    return Math.round((completedCount / selectionCount) * 100)
  })

  const collapseAll = useCollapse()

  return (
    <>
      <DataAction rootKey={['questionSet']} label={t('Exam questions')} schema={v.array(vExamQuestionEditingSpec)}>
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
                      <span>
                        {(questionPool().composition[format] ?? 0) > 0 ? questionPool().composition[format] : 0}
                        {' / '}
                        {questionSet().filter((q) => q.format === format).length}
                      </span>
                    </button>
                  </div>
                )}
              </For>

              <progress
                class={`h-1 progress w-full ${completePercentage()! < 100 ? 'progress-warning' : 'progress-success'}`}
                value={completePercentage()}
                max="100"
              />
            </div>

            <div class="flex gap-2 items-center justify-end mx-4">
              <Show when={collapseAll && questionSet().length}>
                <CollapseButton
                  class="absolute left-4 opacity-30 hover:opacity-100"
                  collapsed={collapseAll!.collapsed}
                  setCollapsed={collapseAll!.setCollapsed}
                  default={true}
                />
              </Show>
              <actions.Import label={t('Import questions')} />
              <Show when={questionSet().length}>
                <actions.Export label={t('Export all questions')} />
                <actions.Reset />
                <actions.Save label={t('Save all questions')} onSave={saveAllQuestions} />
              </Show>
            </div>
          </>
        )}
      </DataAction>

      <div class="flex flex-col gap-4">
        <For each={questionSet()}>
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
