import type { NavigateOptions } from '@tanstack/solid-router'

export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME || 'Minima'

export const DEFAULT_LANGUAGE = import.meta.env.VITE_DEFAULT_LANGUAGE || 'en'

export const TEST_MAILER_URL = import.meta.env.VITE_TEST_MAILER_URL || 'http://localhost:8025'

export const LOGIN_REDIRECT_PATH = '/' as const satisfies NavigateOptions['to']

export const PLATFORM_REALMS = ['studio', 'tutor', 'desk', 'preview'] as const

export const MARKETING_SITE_URL = import.meta.env.VITE_MARKETING_SITE_URL || ''

export const ATTACHMENT_MAX_SIZE = 1024 * 1024 * 3

export const ATTACHMENT_MAX_COUNT = 3

export const APPEAL_MIN_CHARACTERS = 10

export const INQUIRY_MIN_CHARACTERS = 10

export const COMMENT_MIN_CHARACTERS = 10

export const CHILD_COMMENT_MAX_COUNT = 20

export const AI_CHAT_MIN_CHARACTERS = 10

export const AI_CHAT_MAX_CHARACTERS = 13000

export const ASSIGNMENT_ATTACHMENT_MAX_SIZE = 1024 * 1024 * 100

export const AVATAR_MAX_SIZE = 1024 * 1024 * 3

export const OTP_VERIFICATION_EXPIRY_SECONDS = 60 * 5

export const COURSE_PREVIEW_FALLBACK_URL = 'https://cdn.plyr.io/static/demo/View_From_A_Blue_Moon_Trailer-576p.mp4'

export const SEARCH_SUGGESTION_DEBOUNCE = 100

export const LIVE_PLAYER_START_THRESHOLD_SECONDS = 3 * 60

export const LANGUAGES = [
  { value: 'en', label: 'English 🇺🇸 ' },
  { value: 'ko', label: '한국어 🇰🇷 ' },
]

export const SSO_PROVIDERS = ['google', 'github']

export const SAVE_ATTEMPT_INTERVAL_SECONDS = 3

export const LEARNING_STEP_MAP = {
  0: 0, // READY: getting started
  1: 1, // SITTING: sitting and submitting
  2: 1, // TIMEOUT: sitting and submitting & locked
  3: 1, // GRADING: sitting and submitting & locked & waiting for grading completion
  4: 2, // REVIEWING: grading review
  5: 3, // FINAL: final score
}

// noop string
const t = (s: string) => s
export const NOOP = [
  t('ko'),
  t('en'),
  t('Course'),
  t('Pdf'),
  t('Exam'),
  t('Assignment'),
  t('Survey'),
  t('Completion'),
  t('Video'),
  t('Engagement'),
  t('education_manager'),
  t('Inquiry'),
  t('Quiz'),
  t('Group'),
  t('single_choice'),
  t('number_input'),
  t('text_input'),
  t('essay'),
]

// firebase
export const FIREBASE_CONFIG = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyD0zYOkIjjrcoOxYqI6tT7cq3LyxgYO36A',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'minima-9f028.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'minima-9f028',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'minima-9f028.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '906425046596',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:906425046596:web:159eda4ee639cc7ff58e11',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-D1LZ8T1X3L',
}
export const V_API_KEY =
  import.meta.env.VITE_FIREBASE_VAPID_KEY ||
  'BCcSJ_V_bCYA9vhI90dd2ZtX10s6uACog0BIx27BEebGJxfa8H9mNw4_Bzr6xSokMAvXvhof5mLK-iKWC4CrenE'
