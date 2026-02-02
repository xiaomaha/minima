export const PLATFORM_NAME = import.meta.env.VITE_PLATFORM_NAME || 'Minima'

export const BASE_URL = import.meta.env.VITE_BASE_URL || 'http://localhost:5173'

export const DEFAULT_LANGUAGE = import.meta.env.VITE_DEFAULT_LANGUAGE || 'en'

export const TEST_MAILER_URL = import.meta.env.VITE_TEST_MAILER_URL || 'http://localhost:8025'

export const LOGIN_REDIRECT_PATH = '/dashboard'

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
]
