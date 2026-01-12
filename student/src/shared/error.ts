import type { FieldPath } from '@modular-forms/solid'
import { type FieldValues, type FormStore, setError } from '@modular-forms/solid'
import type { TFunction } from 'i18next'
import i18n from '@/i18n.ts'
import { showToast } from '@/shared/toast/store.ts'

export const handleApiError = async (error: unknown, _: Response) => {
  let message: string = ''

  if (typeof error === 'string') {
    console.error(error)
    return error
  }

  const err = error as Record<string, unknown>

  if ('detail' in err && typeof err.detail === 'string') {
    switch (err.detail) {
      // normal errors
      case 'NOTE_NOT_FOUND':
      case 'WATCH_NOT_FOUND':
      case 'THREAD_NOT_FOUND':
        return
      case 'OTP_VERIFICATION_REQUIRED':
        message = i18n.t('OTP Verification Required')
        break
      default:
        message = err.detail
    }
  } else if ('detail' in err && Array.isArray(err.detail)) {
    // 422 form field validation error
    // this type will be handled by handleFormErrors
    return
  } else {
    message = String(JSON.stringify(error))
    console.error(error)
  }

  showToast({
    title: i18n.t('Error'),
    message,
    type: 'error',
  })

  return error
}

interface ValidationError {
  loc: string[]
  msg: string
}

export const handleFormErrors = <T extends FieldValues>(form: FormStore<T>, error: unknown, t: TFunction): void => {
  const detail = (error as { detail?: ValidationError[] | string }).detail

  // server field validation error
  if (Array.isArray(detail)) {
    detail.forEach((err) => {
      const fieldName = err.loc[err.loc.length - 1]
      setError(form, fieldName as FieldPath<T>, t(err.msg))
    })
  }
}
