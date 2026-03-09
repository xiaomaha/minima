import { Show } from 'solid-js'
import type { AssignmentQuestionSchema } from '@/api'
import { ContentViewer } from '@/shared/ContentViewer'
import { useTranslation } from '@/shared/solid/i18n'
import { WordFrequency } from '@/shared/WordFrequency'

interface Props {
  question: AssignmentQuestionSchema
  analysis: Record<string, number> | undefined
}

export const Question = (props: Props) => {
  const { t } = useTranslation()

  return (
    <div class="space-y-6">
      <div class="space-y-6 mb-12">
        <h3 class="mb-6 text-base font-semibold">
          <div class="badge badge-xs badge-neutral block mb-2">{t('Question')}</div>
          {props.question.question}
        </h3>
        <Show when={props.question.supplement}>
          <ContentViewer content={props.question.supplement!} class="bg-base-content/5 rounded-box p-6" />
        </Show>

        <div class="space-y-2">
          <div class="label text-sm">{t('Most frequestly used words in answers')}</div>
          <WordFrequency frequencies={props.analysis ?? {}} />
        </div>
      </div>
    </div>
  )
}
