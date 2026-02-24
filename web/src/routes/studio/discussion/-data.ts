import * as v from 'valibot'
import type { DiscussionQuestionSpec, DiscussionSpec } from '@/api'
import i18next from '@/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyDiscussion = (): DiscussionSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: i18next.t('New discussion draft'),
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
    owner: { name: '', email: '' },
    honorCode: { title: '', code: '' },
    questionPool: {
      description: '',
    },
    questionSet: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (): DiscussionQuestionSpec => {
  const newId = -++questionSequence
  return {
    id: newId,
    directive: `${i18next.t('New discussion directive draft')} ${-newId}`,
    supplement: '',
    postPoint: -1,
    replyPoint: -1,
    tutorAssessmentPoint: -1,
    postMinCharacters: -1,
    replyMinCharacters: -1,
  }
}

const REQUIRED = i18next.t('required')
const AT_LEAST_ZERO = i18next.t('at least 0')

v.setSpecificMessage(v.number, () => REQUIRED)

export const vDiscussionEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  verificationRequired: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, i18next.t('at most 100'))),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  gradeDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  appealDeadlineDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  confirmDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  honorCode: v.object({
    title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    code: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  }),
  questionPool: v.object({
    description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  }),
})

export const vDiscussionQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    directive: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    postPoint: v.pipe(v.number(), v.integer(), v.minValue(1, i18next.t('at least 1'))),
    replyPoint: v.pipe(v.number(), v.integer(), v.minValue(1, i18next.t('at least 1'))),
    tutorAssessmentPoint: v.pipe(v.number(), v.integer(), v.minValue(1, i18next.t('at least 1'))),
    postMinCharacters: v.pipe(v.number(), v.integer(), v.minValue(100, i18next.t('at least 100'))),
    replyMinCharacters: v.pipe(v.number(), v.integer(), v.minValue(100, i18next.t('at least 100'))),
  }),
)
