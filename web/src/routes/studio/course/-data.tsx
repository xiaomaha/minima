import * as v from 'valibot'
import type { CourseSpec, LevelChoices } from '@/api'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyCourse = (): CourseSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: lazyT('New course draft')(),
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '',
    durationSeconds: -1,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    owner: { name: '', email: '' },
    objective: '',
    previewUrl: '',
    effortHours: -1,
    level: '' as LevelChoices,
    honorCode: { title: '', code: '' },
  }
}

export const vCourseEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
  description: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
  audience: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, lazyT('at least 0'))),
  maxAttempts: v.pipe(v.number(), v.integer(), v.minValue(0, lazyT('at least 0'))),
  verificationRequired: v.boolean(),
  objective: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
  previewUrl: v.pipe(v.string(), v.url(lazyT('URL address'))),
  effortHours: v.pipe(v.number(), v.integer(), v.minValue(0, lazyT('at least 0'))),
  level: v.picklist(['beginner', 'intermediate', 'advanced', 'common'], lazyT('required')),
  honorCode: v.object({
    title: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
    code: v.pipe(v.string(), v.nonEmpty(lazyT('required'))),
  }),
})

export const levelOptions = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
  common: 'Common',
}
