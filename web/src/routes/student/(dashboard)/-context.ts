import { createContext, createRoot, useContext } from 'solid-js'
import type { EnrollmentSchema } from '@/api'

type DashboardContextType = {
  newEnrollments: EnrollmentSchema[]
  setRefreshHandler: (handler?: () => void) => void
}

const DashboardContext = createContext<DashboardContextType>()

export const DashboardProvider = DashboardContext.Provider

export const useDashboard = () => {
  const ctx = useContext(DashboardContext)
  if (!ctx) throw new Error('useDashboard must be used within Provider')
  return ctx
}

export const [newEnrollments] = createRoot(() => {
  const store: EnrollmentSchema[] = []
  return [store]
})
