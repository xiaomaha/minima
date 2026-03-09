import { createSignal, Match, Show, Switch } from 'solid-js'
import type * as v from 'valibot'
import { type AppealSchema, operationV1CreateAppeal } from '@/api'
import { vAppealCreateSchema } from '@/api/valibot.gen'
import { APPEAL_MIN_CHARACTERS } from '@/config'
import { FormTextEditor } from '@/shared/editor/FormTextEditor'
import { handleFormErrors } from '@/shared/error'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'

interface Props {
  appeal: AppealSchema | undefined
  appLabel: string
  model: string
  questionId: number
  onCreate: (appeal: AppealSchema) => void
}

export const Appeal = (props: Props) => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])

  const form = createForm<v.InferInput<typeof vAppealCreateSchema>>({
    initialValues: {
      explanation: props.appeal?.explanation ?? '',
      appLabel: props.appLabel,
      model: props.model,
      questionId: props.questionId,
      path: `${window.location.pathname}${window.location.search}`,
    },
    validate: valiForm(vAppealCreateSchema),
  })

  const createAppeal = async (values: v.InferInput<typeof vAppealCreateSchema>) => {
    if (!confirm(t('This action cannot be undone. Are you sure you want to proceed?'))) return
    const { data, error } = await operationV1CreateAppeal({ body: { ...values, files: files() }, throwOnError: false })
    if (error) {
      handleFormErrors(form, error, t)
      return
    }
    props.onCreate(data!)
  }

  // reactive
  const appeal = () => props.appeal

  const [formState, { Form, Field }] = form

  return (
    <div class="px-6 py-4">
      <h3 class="mb-4">{t('Grading Appeal')}</h3>
      <Form onSubmit={createAppeal}>
        <div class="label text-sm my-2">
          {t('Please review carefully before submitting, as grade appeals become final once submitted.')}
        </div>
        <fieldset class="fieldset relative space-y-8" disabled={!!appeal()}>
          <Field
            name="explanation"
            validate={(value) => {
              const length = extractText(value ?? '').length ?? 0
              return length < APPEAL_MIN_CHARACTERS
                ? t('Explanation must be at least {{num1}} characters. Current length: {{num2}}', {
                    num1: APPEAL_MIN_CHARACTERS,
                    num2: length,
                  })
                : ''
            }}
          >
            {(field, props) => (
              <FormInput error={field.error} help={t('Minimum {{num1}} characters', { num1: APPEAL_MIN_CHARACTERS })}>
                <FormTextEditor
                  {...props}
                  value={field.value ?? ''}
                  class="min-h-60 max-h-120"
                  placeholder={t('Write your explanation about the appeal here...')}
                  setFiles={setFiles}
                />
              </FormInput>
            )}
          </Field>

          <Field name="appLabel">{() => null}</Field>
          <Field name="model">{() => null}</Field>
          <Field name="questionId">{() => null}</Field>

          <Switch>
            <Match when={!appeal()}>
              <SubmitButton
                label={t('Submit Appeal')}
                isPending={formState.submitting}
                disabled={!formState.dirty}
                class="btn btn-neutral"
              />
            </Match>

            <Match when={appeal()}>
              <table class="table table-sm">
                <tbody class="[&_th]:whitespace-nowrap">
                  <tr>
                    <th>{t('Created')}</th>
                    <td>{new Date(appeal()!.created).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <th>{t('Status')}</th>
                    <td class="flex gap-3">
                      <span
                        class="badge badge-sm"
                        classList={{
                          'badge-soft': !!appeal()!.review,
                          'badge-warning': !appeal()!.review,
                        }}
                      >
                        {appeal()!.review ? t('Reviewed') : t('Pending')}
                      </span>
                    </td>
                  </tr>
                  <Show when={appeal()!.review}>
                    <tr>
                      <th>{t('Review')}</th>
                      <td>{appeal()!.review}</td>
                    </tr>
                  </Show>
                </tbody>
              </table>
            </Match>
          </Switch>
        </fieldset>
      </Form>
    </div>
  )
}
