import * as v from 'valibot'
import type { QuizQuestionSpec, QuizSpec } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyQuiz = (): QuizSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: lazyT('New quiz draft')(),
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '',
    durationSeconds: null,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    owner: { name: '', email: '' },
    questionPool: {
      description: '',
      selectCount: -1,
    },
    questionSet: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (): QuizQuestionSpec => {
  const newId = -++questionSequence
  return {
    id: newId,
    question: `${lazyT('New question draft')} ${-newId}`,
    supplement: '',
    options: ['', '', '', '', ''],
    point: -1,
    solution: {
      correctAnswers: [],
      explanation: '',
    },
  }
}

export const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')

export const vQuizEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, lazyT('at most 100'))),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  questionPool: v.object({
    description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    selectCount: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  }),
})

export const vQuizQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    options: v.array(v.string()),
    point: v.pipe(v.number(), v.integer(), v.minValue(1, lazyT('at least 1'))),
    solution: v.object({
      correctAnswers: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
      explanation: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    }),
  }),
)
