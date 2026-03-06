import * as v from 'valibot'
import type { DiscussionQuestionSpec, DiscussionSpec } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyDiscussion = (): DiscussionSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New discussion draft',
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
    questions: [],
  }
}

let questionSequence = 0

export const EmptyQuestion = (): DiscussionQuestionSpec => {
  return {
    id: 0,
    directive: `New discussion directive draft ${++questionSequence}`,
    supplement: '',
    postPoint: -1,
    replyPoint: -1,
    tutorAssessmentPoint: -1,
    postMinCharacters: -1,
    replyMinCharacters: -1,
  }
}

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')
const AT_MOST_100 = lazyT('at most 100')
const AT_LEAST_ONE = lazyT('at least 1')
const AT_LEAST_100 = lazyT('at least 100')

export const vDiscussionEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  verificationRequired: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, AT_MOST_100)),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  gradeDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  appealDeadlineDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  confirmDueDays: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  honorCodeId: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
})

export const vDiscussionQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    directive: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    postPoint: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
    replyPoint: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
    tutorAssessmentPoint: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ONE)),
    postMinCharacters: v.pipe(v.number(), v.integer(), v.minValue(100, AT_LEAST_100)),
    replyMinCharacters: v.pipe(v.number(), v.integer(), v.minValue(100, AT_LEAST_100)),
  }),
)
