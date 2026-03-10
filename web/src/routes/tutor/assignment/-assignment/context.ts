import { createContext, useContext } from 'solid-js'
import type { TutorAssignmentGradeSchema } from '@/api'
import type { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'

type GradingStore = ReturnType<typeof createCachedInfiniteStore<TutorAssignmentGradeSchema, { page: number }>>

const GradingContext = createContext<GradingStore>()

export const GradingProvider = GradingContext.Provider

export const useGrading = () => {
  return useContext(GradingContext)
}
