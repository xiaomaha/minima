import { createContext, useContext } from 'solid-js'
import type { EnrollmentSchema } from '@/api'

const NewEnrollmentContext = createContext<EnrollmentSchema[]>()

export const NewEnrollmentProvider = NewEnrollmentContext.Provider

export const useNewEnrollment = () => {
  const ctx = useContext(NewEnrollmentContext)
  if (!ctx) throw new Error('useNewEnrollment must be used within Provider')
  return ctx
}
