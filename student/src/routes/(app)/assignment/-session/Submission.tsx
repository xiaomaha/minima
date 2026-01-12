import { useTransContext } from '@mbarzda/solid-i18next'
import { createForm, valiForm } from '@modular-forms/solid'
import { createSignal, For, Show } from 'solid-js'
import type * as v from 'valibot'
import { assignmentV1SubmitAttempt } from '@/api'
import { vAssignmentSubmitSchema } from '@/api/valibot.gen'
import { ASSIGNMENT_ATTACHMENT_MAX_SIZE } from '@/config'
import { ContentViewer } from '@/shared/ContentViewer'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { TextEditor } from '../../-shared/editor/TextEditor'
import { useSession } from './context'

const SITTING = 1
const GRADING = 3

export const Submission = () => {
  const [t] = useTransContext()
  const [files, setFiles] = createSignal<File[]>([])

  const [session, { setStore }] = useSession()
  const s = () => session.data!

  const [assignmentForm, { Form, Field }] = createForm<v.InferInput<typeof vAssignmentSubmitSchema>>({
    initialValues: { answer: s().submission?.answer ?? '' },
    validate: valiForm(vAssignmentSubmitSchema),
  })

  const submit = async (values: v.InferInput<typeof vAssignmentSubmitSchema>) => {
    if (!confirm(t('This action cannot be undone. Are you sure you want to proceed?'))) return

    const { data } = await assignmentV1SubmitAttempt({
      body: { ...values, files: files() },
      path: { id: s().assignment.id },
    })

    setStore('data', 'submission', data)
    setStore('data', 'step', GRADING)
    setFiles([])
  }

  const disabled = () => s().step !== SITTING
  const question = s().attempt!.question
  const attachmentFileCount = question.attachmentFileCount ?? 0
  const attachmentFileTypes = question.attachmentFileTypes

  return (
    <div class="card w-full p-4 md:p-8 bg-base-100 shadow-sm">
      <Form onSubmit={submit}>
        <fieldset class="fieldset space-y-12" disabled={disabled()}>
          <div class="label text-sm flex justify-between">
            <span>{t('Question')}</span>
            <div class="badge badge-sm badge-outline">
              {t('{{count}} point', { count: question.solution?.rubricData.possiblePoint })}
            </div>
          </div>

          <div class="card-title">{question.question}</div>

          <Show when={question.supplement}>
            <ContentViewer content={question.supplement!} class="bg-base-content/5 rounded-box p-8" />
          </Show>

          <div>
            <div class="label my-4 text-sm text-base-content/60">{t('Assessment Criteria')}</div>
            <ul class="list-disc pl-4 space-y-2 text-sm text-base-content/60">
              <For each={question.solution?.rubricData.criteria}>
                {(criterion) => (
                  <li>
                    <span>{criterion.name}</span>
                    <span class="ml-2 badge badge-sm badge-outline">
                      {t('{{count}} point', {
                        count: Math.max(...criterion.performanceLevels.map((level) => level.point)),
                      })}
                    </span>
                  </li>
                )}
              </For>
              <li>{t('Detailed level descriptions are available after the grading completion.')}</li>
            </ul>
          </div>

          <div class="mb-4 space-y-2">
            <Show when={attachmentFileCount}>
              <div class="label my-4 text-sm text-base-content/60">
                {t('File Attachment')}
                <span class="text-error">*</span>
              </div>
              <ul class="list-disc pl-4 space-y-2 text-sm text-base-content/60">
                <li class="font-semibold">
                  {t('Attachment file type: {{types}}, Attachment count: {{num}}, Max size: {{size}}MB', {
                    types: `[${question.attachmentFileTypes.join(', ')}]`,
                    num: attachmentFileCount,
                    size: Math.floor(ASSIGNMENT_ATTACHMENT_MAX_SIZE / 1024 / 1024),
                  })}
                </li>
                <Show when={question.sampleAttachment}>
                  <li>
                    <a class="link link-primary text-sm" href={question.sampleAttachment!} target="_blank">
                      {t('Download sample file')}
                    </a>
                  </li>
                </Show>
              </ul>
            </Show>
          </div>

          <Field
            name="answer"
            validate={() => {
              if (files().length !== attachmentFileCount)
                return t('Attachment file count must be {{num}}, current count: {{num2}}', {
                  num: attachmentFileCount,
                  num2: files().length,
                })
              return ''
            }}
          >
            {(field, props) => (
              <FormInput error={field.error}>
                <TextEditor
                  {...props}
                  value={field.value ?? ''}
                  class="min-h-60 max-h-96"
                  placeholder={t('Write your content here...')}
                  accept={attachmentFileTypes}
                  setFiles={setFiles}
                  maxFiles={attachmentFileCount}
                  maxFileSize={ASSIGNMENT_ATTACHMENT_MAX_SIZE}
                />
              </FormInput>
            )}
          </Field>

          <Show when={!disabled()}>
            <SubmitButton
              label={t('Submit Assignment')}
              isPending={assignmentForm.submitting}
              disabled={!assignmentForm.dirty}
              class="btn btn-primary w-full"
            />
          </Show>
        </fieldset>
      </Form>
    </div>
  )
}
