import * as v from 'valibot'
import type { SurveyQuestionFormatChoices, SurveyQuestionSpec, SurveySpec } from '@/api'
import { vSurveyQuestionFormatChoices } from '@/api/valibot.gen'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptySurvey = (): SurveySpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New survey draft',
    description: '',
    audience: '',
    thumbnail: '',
    completeMessage: '',
    anonymous: false,
    showResults: false,
    featured: false,
    format: '',
    durationSeconds: -1,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    published: null,
    questionPool: {
      description: '',
    },
    questions: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (format: SurveyQuestionFormatChoices): SurveyQuestionSpec => {
  return {
    id: 0,
    question: `New question draft ${++questionSequence}`,
    supplement: '',
    format: format,
    options: format === 'single_choice' ? ['', '', '', '', ''] : [],
    mandatory: false,
    ordering: 0,
  }
}

// not field but record
export const questionFormats = ['single_choice', 'number_input', 'text_input'] as const

const REQUIRED = lazyT('required')

export const vSurveyEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  completeMessage: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  anonymous: v.boolean(),
  showResults: v.boolean(),
  questionPool: v.object({
    description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  }),
})

export const vSurveyQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    format: vSurveyQuestionFormatChoices,
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    options: v.array(v.string()),
    mandatory: v.boolean(),
    ordering: v.number(),
  }),
  v.check((data) => {
    if (data.format === 'single_choice') {
      const validOptions = data.options.filter((opt) => opt.length >= 1)
      return validOptions.length >= 2 && validOptions.length <= 5
    }
    return true
  }, lazyT('single_choice format requires 2-5 options with at least 1 character each')),
)
