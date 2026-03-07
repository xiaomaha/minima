import { IconPlus, IconSearch } from '@tabler/icons-solidjs'
import { For, Show } from 'solid-js'
import * as v from 'valibot'
import {
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
import { scrollToLastPaper } from '../-studio/helper'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { makeCopyQuestionPool, makeSaveQuestions } from '../-studio/questionPool'
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

  const saveAllQuestions = makeSaveQuestions(staging, source, fieldState, studioV1SaveSurveyQuestions)
  const copyQuestionPool = makeCopyQuestionPool(staging, studioV1GetSurveyQuestions)

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
              <Question index={index()} />
            </Show>
          )}
        </For>
      </div>
    </>
  )
}
