import * as v from 'valibot'
import type { QuizQuestionSpec, QuizSpec } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyQuiz = (): QuizSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New quiz draft',
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '',
    durationSeconds: null,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    published: null,
    questionPool: {
      selectCount: -1,
    },
    questions: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (): QuizQuestionSpec => {
  return {
    id: 0,
    question: `New question draft ${++questionSequence}`,
    supplement: '',
    options: ['', '', '', '', ''],
    point: -1,
    solution: {
      correctAnswers: [],
      explanation: '',
    },
  }
}

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')
const AT_LEAST_ONE = lazyT('at least 1')
const AT_MOST_100 = lazyT('at most 100')

export const vQuizEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, AT_MOST_100)),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  questionPool: v.object({
    selectCount: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  }),
})

export const vQuizQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    options: v.array(v.string()),
    point: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
    solution: v.object({
      correctAnswers: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
      explanation: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    }),
  }),
)
