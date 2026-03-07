import * as v from 'valibot'
import type { ExamQuestionFormatChoices, ExamQuestionSpec, ExamSpec } from '@/api'
import { vExamQuestionFormatChoices } from '@/api/valibot.gen'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyExam = (): ExamSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New exam draft',
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '',
    durationSeconds: -1,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    gradeDueDays: -1,
    appealDeadlineDays: -1,
    confirmDueDays: -1,
    honorCodeId: -1,
    published: null,
    questionPool: {
      composition: { single_choice: -1, number_input: -1, text_input: -1, essay: -1 },
    },
    questions: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (format: ExamQuestionFormatChoices): ExamQuestionSpec => {
  return {
    id: 0,
    question: `New question draft ${++questionSequence}`,
    supplement: '',
    format: format,
    options: format === 'single_choice' ? ['', '', '', '', ''] : [],
    point: -1,
    solution: {
      correctAnswers: [],
      correctCriteria: '',
      explanation: '',
    },
  }
}

// not field but record
export const questionFormats = ['single_choice', 'number_input', 'text_input', 'essay'] as const

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')
const AT_LEAST_100 = lazyT('at least 100')
const AT_LEAST_60 = lazyT('at least 60 seconds')
const AT_LEAST_ONE = lazyT('at least 1')
const AT_MOST_24_HOURS = lazyT('at most 24 hours')

export const vExamEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  verificationRequired: v.boolean(),
  durationSeconds: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(60, AT_LEAST_60),
    v.maxValue(60 * 60 * 24, AT_MOST_24_HOURS),
  ),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, AT_LEAST_100)),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  gradeDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  appealDeadlineDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  confirmDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  honorCodeId: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
  questionPool: v.object({
    composition: v.record(vExamQuestionFormatChoices, v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO))),
  }),
})

export const vExamQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    format: vExamQuestionFormatChoices,
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    options: v.array(v.string()),
    point: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
    solution: v.object({
      correctAnswers: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
      correctCriteria: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
      explanation: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    }),
  }),
  v.check((data) => {
    if (data.format === 'single_choice') {
      const validOptions = data.options.filter((opt) => opt.length >= 1)
      return validOptions.length >= 2 && validOptions.length <= 5
    }
    return true
  }, lazyT('single_choice format requires 2-5 options with at least 1 character each')),
  v.check((data) => {
    if (['single_choice', 'number_input'].includes(data.format)) {
      return data.solution.correctAnswers.filter((s) => s).length >= 1
    }
    return true
  }, lazyT('single_choice and number_input format requires at least 1 correct answer')),
  v.check((data) => {
    if (data.format === 'single_choice') {
      return data.solution.correctAnswers.every((ans) => {
        if (!/^\d+$/.test(ans)) return false

        const index = Number(ans)
        return index >= 1 && index <= data.options.length
      })
    }
    return true
  }, lazyT('Correct answers must be valid option indices')),
)
