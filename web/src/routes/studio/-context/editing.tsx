import { createContext, type JSX, useContext } from 'solid-js'
import type { createMutable } from 'solid-js/store'
import type { AssignmentSpec, DiscussionSpec, ExamSpec, MediaSpec, QuizSpec, SurveySpec } from '@/api'

export type State = { error: string; dirty: boolean }

export type FieldState<T> = T extends (infer _)[] ? State : T extends object ? { [K in keyof T]: FieldState<T[K]> } : State

export type ContentType = ExamSpec | QuizSpec | SurveySpec | DiscussionSpec | AssignmentSpec | MediaSpec

type EditingContextType<T extends object = ContentType> = {
  source: ReturnType<typeof createMutable<T>>
  staging: ReturnType<typeof createMutable<T>>
  fieldState: ReturnType<typeof createMutable<FieldState<T>>>
}

const EditingContext = createContext<EditingContextType>()

export const EditingProvider = <T extends ContentType>(props: { value: EditingContextType<T>; children: JSX.Element }) => {
  return <EditingContext.Provider value={props.value}>{props.children}</EditingContext.Provider>
}

export const useEditing = <T extends ContentType = ContentType>() => {
  const ctx = useContext(EditingContext)
  if (!ctx) throw new Error('useEditing must be used within Provider')
  return ctx as EditingContextType<T>
}
