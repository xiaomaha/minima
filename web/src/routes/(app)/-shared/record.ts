import { createRoot } from 'solid-js'
import { createStore } from 'solid-js/store'

interface LearningRecords {
  [contentId: string]: {
    [accessContext: string]: number // progress or score
  }
}

export const { records, setRecords, getProgress, setProgress, getAverageProgress } = createRoot(() => {
  const [learningRecords, setLearningRecords] = createStore<LearningRecords>({})

  return {
    records: learningRecords,
    setRecords: setLearningRecords,

    getProgress: (contentId: string, ctx: string) => {
      return learningRecords[contentId]?.[ctx] ?? 0
    },

    setProgress: (contentId: string, progress: number, ctx: string) => {
      if (!learningRecords[contentId]) {
        setLearningRecords(contentId, { [ctx]: progress })
        return
      }
      setLearningRecords(contentId, ctx, progress)
    },

    getAverageProgress: (contentIds: string[], ctx: string) => {
      const progresses = contentIds.map((id) => learningRecords[id]?.[ctx] ?? 0)
      return progresses.length ? (progresses.reduce((a, b) => a + b, 0) / progresses.length).toFixed(1) : '0'
    },
  }
})
