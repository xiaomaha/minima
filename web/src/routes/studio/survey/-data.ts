import * as v from 'valibot'
import type { SurveyQuestionFormatChoices, SurveyQuestionSpec, SurveySpec } from '@/api'
import { vSurveyQuestionFormatChoices } from '@/api/valibot.gen'
import i18next from '@/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptySurvey = (): SurveySpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: i18next.t('New survey draft'),
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
    owner: { name: '', email: '' },
    questionPool: {
      description: '',
    },
    questionSet: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (format: SurveyQuestionFormatChoices): SurveyQuestionSpec => {
  const newId = -++questionSequence
  return {
    id: newId,
    question: `${i18next.t('New question draft')} ${-newId}`,
    supplement: '',
    format: format,
    options: format === 'single_choice' ? ['', '', '', '', ''] : [],
    mandatory: false,
    ordering: 0,
  }
}

// not field but record
export const questionFormats = ['single_choice', 'number_input', 'text_input'] as const

const REQUIRED = i18next.t('required')

v.setSpecificMessage(v.number, () => REQUIRED)

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
  }, i18next.t('single_choice format requires 2-5 options with at least 1 character each')),
)
