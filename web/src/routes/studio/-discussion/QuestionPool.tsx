import { IconPlus, IconSearch } from '@tabler/icons-solidjs'
import { createMemo, For, Show } from 'solid-js'
import * as v from 'valibot'
import {
  type DiscussionSpec,
  studioV1ContentSuggestions,
  studioV1GetDiscussionQuestions,
  studioV1SaveDiscussionQuestions,
} from '@/api'
import { CollapseButton } from '@/shared/CollapseButton'
import { useTranslation } from '@/shared/solid/i18n'
import { useCollapse } from '../-context/CollapseContext'
import { useEditing } from '../-context/editing'
import { DataAction } from '../-studio/DataAction'
import { scrollToLastPaper } from '../-studio/helper'
import { InlineSuggestion } from '../-studio/InlineSuggestion'
import { makeCopyQuestionPool, makeSaveQuestions } from '../-studio/questionPool'
import { EmptyQuestion, vDiscussionQuestionEditingSpec } from './data'
import { Question } from './Question'

export const QuestionPool = () => {
  const { t } = useTranslation()

  const { source, staging, fieldState } = useEditing<DiscussionSpec>()

  const questions = () => staging.questions

  const addQuestion = () => {
    staging.questions.push(EmptyQuestion())
    scrollToLastPaper()
  }

  const saveAllQuestions = makeSaveQuestions(staging, source, fieldState, studioV1SaveDiscussionQuestions)
  const copyQuestionPool = makeCopyQuestionPool(staging, studioV1GetDiscussionQuestions)

  const completePercentage = createMemo((): number => {
    return questions().length >= 1 ? 100 : 0
  })

  const collapseAll = useCollapse()

  return (
    <>
      <DataAction
        rootKey={['questions']}
        label={t('Discussion questions')}
        schema={v.array(vDiscussionQuestionEditingSpec)}
      >
        {(_, actions) => (
          <>
            <div class="flex items-center gap-4 sticky top-18 z-3 flex-wrap px-4">
              <button
                type="button"
                class="btn btn-sm btn-soft w-full shadow-xs"
                onClick={() => addQuestion()}
                onMouseDown={(e) => e.preventDefault()}
                tabIndex={-1}
              >
                <IconPlus size={20} />
                <span>{t('Question')}</span>
                <span>{questions().length}</span>
              </button>

              <progress
                class={`h-1 progress w-full ${completePercentage()! < 100 ? 'progress-warning' : 'progress-success'}`}
                value={completePercentage()}
                max="100"
              />
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
                fetchParams={() => ({ query: { kind: 'discussion' } })}
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
