import { createContext, useContext } from 'solid-js'
import type { TutorExamGradeSchema } from '@/api'
import type { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'

type GradingStore = ReturnType<typeof createCachedInfiniteStore<TutorExamGradeSchema, { page: number }>>

const GradingContext = createContext<GradingStore>()

export const GradingProvider = GradingContext.Provider

export const useGrading = () => {
  return useContext(GradingContext)
}
