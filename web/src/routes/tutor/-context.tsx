import { createContext, useContext } from 'solid-js'
import type { AllocationSchema } from '@/api'
import type { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'

type AllocationStore = ReturnType<typeof createCachedInfiniteStore<AllocationSchema, { page: number }>>

const AllocationContext = createContext<AllocationStore>()

export const AllocationProvider = AllocationContext.Provider

export const useAllocation = () => {
  const ctx = useContext(AllocationContext)
  if (!ctx) throw new Error('useAllocation must be used within Provider')
  return ctx
}
