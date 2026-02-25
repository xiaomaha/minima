import * as v from 'valibot'
import type { AssignmentQuestionSpec, AssignmentSpec } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyAssignment = (): AssignmentSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: lazyT('New assignment draft')(),
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

export const EmptyQuestion = (): AssignmentQuestionSpec => {
  const newId = -++questionSequence
  return {
    id: newId,
    question: `${lazyT('New question draft')} ${-newId}`,
    supplement: '',
    attachmentFileCount: -1,
    attachmentFileTypes: [],
    sampleAttachment: '',
    plagiarismThreshold: -1,
  }
}

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')

export const vAssignmentEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  verificationRequired: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, lazyT('at most 100'))),
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

export const vAssignmentQuestionEditingSpec = v.pipe(
  v.object({
    id: v.pipe(v.number(), v.integer()),
    question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    supplement: v.string(),
    attachmentFileCount: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
    attachmentFileTypes: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))), v.minLength(1, lazyT('at least 1'))),
    sampleAttachment: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    plagiarismThreshold: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, lazyT('at most 100'))),
  }),
)
