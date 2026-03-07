import { IconPlus, IconSearch } from '@tabler/icons-solidjs'
import { createMemo, For, Show } from 'solid-js'
import * as v from 'valibot'
import {
  type ExamQuestionFormatChoices,
  type ExamSpec,
  studioV1ContentSuggestions,
  studioV1GetExamQuestions,
  studioV1SaveExamQuestions,
} from '@/api'
import { CollapseButton } from '@/shared/CollapseButton'
import { useTranslation } from '@/shared/solid/i18n'
import { useCollapse } from '../-context/CollapseContext'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { scrollToLastPaper } from '../-studio/helper'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { makeCopyQuestionPool, makeSaveQuestions } from '../-studio/questionPool'
import { EmptyQuestion, questionFormats, vExamQuestionEditingSpec } from './data'
import { Question } from './Question'

export const QuestionPool = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<ExamSpec>()

  const questionPool = () => staging.questionPool
  const questions = () => staging.questions

  const addQuestion = (format: ExamQuestionFormatChoices) => {
    staging.questions.push(EmptyQuestion(format))
    scrollToLastPaper()
  }

  const saveAllQuestions = makeSaveQuestions(staging, source, fieldState, studioV1SaveExamQuestions)
  const copyQuestionPool = makeCopyQuestionPool(staging, studioV1GetExamQuestions)

  const completePercentage = createMemo((): number => {
    const composition = questionPool()!.composition
    const selectionCount = Object.values(composition).reduce((a, b) => a + (b < 0 ? 0 : b), 0)
    if (selectionCount <= 0) return 0
    const completedCount = questionFormats.reduce((sum, format) => {
      const formatCount = composition[format] ?? 0
      const required = formatCount < 0 ? 0 : formatCount
      const actual = questions()!.filter((q) => q.format === format).length
      return sum + Math.min(actual, required)
    }, 0)
    return Math.round((completedCount / selectionCount) * 100)
  })

  const collapseAll = useCollapse()

  return (
    <>
      <DataAction rootKey={['questions']} label={t('Exam questions')} schema={v.array(vExamQuestionEditingSpec)}>
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
                        {questions().filter((q) => q.format === format).length}
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
              <Show when={collapseAll && questions().length}>
                <CollapseButton
                  class="absolute left-4 opacity-30 hover:opacity-100"
                  collapsed={collapseAll!.collapsed}
                  setCollapsed={collapseAll!.setCollapsed}
                  default={true}
                />
              </Show>

              <InlineSuggestion<string, Parameters<typeof studioV1ContentSuggestions>[0]>
                placeholder={t('Copy question pool')}
                cacheKey="studioV1ContentSuggestions"
                fetchParams={() => ({ query: { kind: 'exam' } })}
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
              <Question index={index()} />
            </Show>
          )}
        </For>
      </div>
    </>
  )
}
