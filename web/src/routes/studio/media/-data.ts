import * as v from 'valibot'
import type { MediaFormatChoices, MediaSpec, SubtitleSpec } from '@/api'
import { LANGUAGES } from '@/config'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/ContentSuggestion'

export const EmptyMedia = (): MediaSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: lazyT('New media draft')(),
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

const REQUIRED = lazyT('required')
const AT_LEAST_ZERO = lazyT('at least 0')

export const vMediaEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  format: v.picklist(['video', 'short', 'ebook', 'html', 'pdf', 'live'], lazyT('required')),
  url: v.pipe(v.string(), v.url(lazyT('URL address'))),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, lazyT('at most 100'))),
  durationSeconds: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(60, lazyT('at least 60 seconds')),
    v.maxValue(60 * 60 * 24, lazyT('at most {{max}} seconds', { max: 60 * 60 * 24 })),
  ),
  channel: v.string(),
  license: v.string(),
  quizzes: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
})

export const vSubtitleEditingSpec = v.object({
  lang: v.picklist(
    LANGUAGES.map((l) => l.value),
    lazyT('required'),
  ),
  body: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
})

export const mediaFormatOptions = {
  video: 'Video',
  short: 'Short',
  ebook: 'E-book',
  html: 'HTML',
  pdf: 'PDF',
  live: 'Live',
}

export const langulageOptions = LANGUAGES.map(({ value, label }) => [value, label])
