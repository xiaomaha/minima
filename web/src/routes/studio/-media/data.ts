import * as v from 'valibot'
import type { MediaFormatChoices, MediaSpec, SubtitleSpec } from '@/api'
import { LANGUAGES } from '@/config'
import { lazyT } from '@/shared/solid/i18n'
import { EMPTY_CONTENT_ID } from '../-context/editing'

export const EmptyMedia = (): MediaSpec => {
  return {
    id: EMPTY_CONTENT_ID,
    created: '',
    modified: '',
    title: 'New media draft',
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
    published: null,
    quizzes: [],
    subtitles: [],
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
const AT_MOST_100 = lazyT('at most 100')
const AT_MOST_24_HOURS = lazyT('at most 24 hours')

export const vMediaEditingSpec = v.object({
  title: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  description: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  audience: v.pipe(v.string(), v.nonEmpty(REQUIRED)),
  format: v.picklist(['video', 'short', 'ebook', 'html', 'pdf', 'live'], 'required'),
  url: v.pipe(v.string(), v.url('URL address')),
  featured: v.boolean(),
  passingPoint: v.pipe(v.number(), v.integer(), v.minValue(0, AT_LEAST_ZERO), v.maxValue(100, AT_MOST_100)),
  durationSeconds: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(60, 'at least 60 seconds'),
    v.maxValue(60 * 60 * 24, AT_MOST_24_HOURS),
  ),
  channel: v.string(),
  license: v.string(),
  quizzes: v.array(v.pipe(v.string(), v.nonEmpty(REQUIRED))),
})

export const vSubtitleEditingSpec = v.object({
  lang: v.picklist(
    LANGUAGES.map((l) => l.value),
    'required',
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
