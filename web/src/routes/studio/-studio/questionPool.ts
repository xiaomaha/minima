import { batch } from 'solid-js'
import { unwrap } from 'solid-js/store'
import type { ContentSuggestionSpec } from '@/api'
import { collectBlobFiles } from './field'
import { checkTree, getNestedState } from './helper'

type SaveFn<Q> = (opts: {
  path: { id: string }
  body: { data: { data: Q[] }; files?: Array<Blob | File> }
}) => Promise<{ data: number[] }>

type GetFn<Q> = (opts: { path: { id: string } }) => Promise<{ data: Q[] }>

export const makeSaveQuestions =
  <Q extends { id: number; supplement?: string }>(
    staging: { id: string; questions: Q[] },
    source: { questions: Q[] },
    fieldState: object,
    saveFn: SaveFn<Q>,
  ) =>
  async (d: Q[]) => {
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

    const { data: savedIds } = await saveFn({
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

export const makeCopyQuestionPool =
  <Q extends { id: number; question?: string; directive?: string }>(staging: { questions: Q[] }, getFn: GetFn<Q>) =>
  async (suggestion: ContentSuggestionSpec) => {
    const { data } = await getFn({ path: { id: suggestion.id } })
    const filteredQuestions = data
      .filter(
        (q) =>
          staging.questions.findIndex(
            (sq) => (sq.question && sq.question === q.question) || (sq.directive && sq.directive === q.directive),
          ) < 0,
      )
      .map((q) => ({ ...q, id: 0 }))
    if (filteredQuestions.length === 0) return
    staging.questions.push(...filteredQuestions)
  }
