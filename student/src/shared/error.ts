import type { AxiosError } from 'axios'
import type { TOptions } from 'i18next'
import i18n from '@/i18n.ts'
import type { FieldValues } from '@/shared/solid/form'
import { showToast } from '@/shared/toast/store.ts'
import type { createForm } from './solid/form'

export const handleApiError = async (error: AxiosError) => {
  let message: string = ''
  let duration: number = 1000 * 5

  if (typeof error === 'string') {
    console.error(error)
    return error
  }

  const err = error.response?.data as { detail?: string; similarity?: number }

  if ('detail' in err && typeof err.detail === 'string') {
    switch (err.detail) {
      // normal errors
      case 'NOTE_NOT_FOUND':
      case 'WATCH_NOT_FOUND':
      case 'THREAD_NOT_FOUND':
        throw error
      case 'OTP_VERIFICATION_REQUIRED':
        message = i18n.t('OTP Verification Required')
        break
      case 'PLAGIARISM_DETECTED':
        message = i18n.t('Plagiarism Detected, Similarity percentage: {{similarity}}%', {
          similarity: err.similarity,
        })
        duration = 1000 * 10
        break

      default:
        message = err.detail
    }
  } else if ('detail' in err && Array.isArray(err.detail)) {
    // 422 form field validation error
    // this type will be handled by handleFormErrors
    throw error
  } else {
    message = String(JSON.stringify(error))
    console.error(error)
  }

  showToast({
    title: i18n.t('Error'),
    message,
    duration,
    type: 'error',
  })

  throw error
}

interface ValidationError {
  loc: string[]
  msg: string
}

export const handleFormErrors = <T extends FieldValues>(
  form: ReturnType<typeof createForm<T>>,
  error: unknown,
  t: (key: string, options?: TOptions) => string,
): void => {
  const [, actions] = form
  const detail = (error as { detail?: ValidationError[] | string }).detail
  if (Array.isArray(detail)) {
    detail.forEach((err) => {
      const fieldName = err.loc[err.loc.length - 1]
      if (fieldName) {
        actions.setError(fieldName, t(err.msg))
      }
    })
  }
}
