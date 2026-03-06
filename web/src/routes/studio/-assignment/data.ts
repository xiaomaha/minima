import * as v from 'valibot'
import type { AssignmentQuestionSpec, AssignmentSpec } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyAssignment = (): AssignmentSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New assignment draft',
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

export const EmptyQuestion = (): AssignmentQuestionSpec => {
  return {
    id: 0,
    question: `New question draft ${++questionSequence}`,
    supplement: '',
    attachmentFileCount: -1,
    attachmentFileTypes: [],
    sampleAttachment: '',
    plagiarismThreshold: -1,
  }
}

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')
const AT_MOST_100 = lazyT('at most 100')
const AT_LEAST_ONE = lazyT('at least 1')

export const vAssignmentEditingSpec = v.object({
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

export const vAssignmentQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    attachmentFileCount: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
    attachmentFileTypes: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))), v.minLength(1, AT_LEAST_ONE)),
    sampleAttachment: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    plagiarismThreshold: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, AT_MOST_100)),
  }),
)
