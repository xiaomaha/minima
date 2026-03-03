import * as v from 'valibot'
import type { CourseAssetsSpec, CourseSpec, LevelChoices } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyCourse = (): CourseSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New course draft',
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '',
    durationSeconds: -1,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    objective: '',
    previewUrl: '',
    effortHours: -1,
    level: '' as LevelChoices,
    published: null,
    honorCode: { title: '', code: '' },
    faq: { name: '', description: '' },
    gradingPolicy: { assessmentWeight: -1, completionWeight: -1, completionPassingPoint: -1 },
    assets: EmptyCourseAssets(),
  }
}

export const EmptyCourseAssets = (): CourseAssetsSpec => ({
  lessons: [],
  assessments: [],
  courseRelations: [],
  courseSurveys: [],
  courseCertificates: [],
  courseCategories: [],
  courseInstructors: [],
  faqItems: [],
})

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')

export const vCourseEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  verificationRequired: v.boolean(),
  objective: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  previewUrl: v.pipe(v.string(), v.url('URL address')),
  effortHours: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  level: v.picklist(['beginner', 'intermediate', 'advanced', 'common'], REQUIRED),
  honorCode: v.object({
    title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    code: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  }),
  faq: v.object({
    name: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    description: v.pipe(v.string()),
  }),
  gradingPolicy: v.object({
    assessmentWeight: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
    completionWeight: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
    completionPassingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  }),
})

export const levelOptions = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  common: 'Common',
}

export const vCourseCertificateEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  certificateId: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ZERO)),
})

export const vCourseRelationEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  relatedCourseId: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
})

export const vCourseCategoryEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  categoryId: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ZERO)),
})

export const vCourseSurveyEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  surveyId: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  startOffset: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  endOffset: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO))),
})

export const vAssessmentEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  itemId: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  weight: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  startOffset: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  endOffset: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO))),
  itemType: v.object({
    appLabel: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
    model: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  }),
})

export const vLessonEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  mediaIds: v.pipe(v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))), v.minLength(1)),
  startOffset: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO)),
  endOffset: v.nullable(v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO))),
})

export const vCourseInstructorEditingSpec = v.object({
  label: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  instructorId: v.pipe(v.number(), v.integer(), v.minValue(1, AT_LEAST_ZERO)),
  lead: v.boolean(),
})

export const vFaqItemEditingSpec = v.object({
  question: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  answer: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  active: v.boolean(),
})
