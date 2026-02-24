import * as v from 'valibot'
import type { MediaFormatChoices, MediaSpec, SubtitleSpec } from '@/api'
import { LANGUAGES } from '@/config'
import i18next from '@/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyMedia = (): MediaSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: i18next.t('New media draft'),
    license: '',
    channel: '',
    url: '',
    description: '',
    audience: '',
    thumbnail: '',
    featured: false,
    format: '' as MediaFormatChoices,
    durationSeconds: -1,
    passingPoint: -1,
    maxAttempts: -1,
    verificationRequired: false,
    owner: { name: '', email: '' },
    quizzes: [],
    subtitleSet: [],
  }
}

export const EmptySubtitle = (): SubtitleSpec => {
  return {
    lang: '',
    body: '',
  }
}

const REQUIRED = i18next.t('required')
const AT_LEAST_ZERO = i18next.t('at least 0')

v.setSpecificMessage(v.number, () => REQUIRED)

export const vMediaEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  format: v.picklist(['video', 'short', 'ebook', 'html', 'pdf', 'live'], i18next.t('required')),
  url: v.pipe(v.string(), v.url(i18next.t('URL address'))),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, i18next.t('at most 100'))),
  durationSeconds: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(60, i18next.t('at least 60 seconds')),
    v.maxValue(60 * 60 * 24, i18next.t('at most {{max}} seconds', { max: 60 * 60 * 24 })),
  ),
  channel: v.string(),
  license: v.string(),
  quizzes: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
})

export const vSubtitleEditingSpec = v.object({
  lang: v.picklist(
    LANGUAGES.map((l) => l.value),
    i18next.t('required'),
  ),
  body: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
})

export const mediaFormatOptions = {
  video: i18next.t('Video'),
  short: i18next.t('Short'),
  ebook: i18next.t('E-book'),
  html: i18next.t('HTML'),
  pdf: i18next.t('PDF'),
  live: i18next.t('Live'),
}

export const langulageOptions = LANGUAGES.map(({ value, label }) => [value, label])
