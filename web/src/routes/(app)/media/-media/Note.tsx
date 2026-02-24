import type { Editor } from '@tiptap/core'
import { createEffect, createSignal } from 'solid-js'
import type * as v from 'valibot'
import { contentV1GetMediaNote, contentV1SaveMediaNote } from '@/api'
import { vNoteSaveSchema } from '@/api/valibot.gen'
import { accessContextParam } from '@/context'
import { FormTextEditor } from '@/shared/editor/FormTextEditor'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'

interface Props {
  mediaId: string
  height?: number | null
}

export const Note = (props: Props) => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])

  const [formState, { Form, Field, reset }] = createForm<v.InferInput<typeof vNoteSaveSchema>>({
    initialValues: { note: '' },
    validate: valiForm(vNoteSaveSchema),
  })

  const [note, { setStore }] = createCachedStore(
    'contentV1GetMediaNote',
    () => ({ path: { id: props.mediaId }, query: accessContextParam() }),
    async (options) => {
      const { data } = await contentV1GetMediaNote(options)
      return data
    },
  )

  createEffect(() => {
    reset({ initialValues: { note: note.data?.note ?? '' } })
  })

  const onSubmit = async (values: v.InferInput<typeof vNoteSaveSchema>) => {
    const { data } = await contentV1SaveMediaNote({
      path: { id: props.mediaId },
      body: { note: values.note, files: files() },
      throwOnError: true,
    })

    setStore('data', data)
  }

  const handleClipboardWrite = (event: CustomEvent, editor: Editor) => {
    const text = event.detail.text
    if (text && editor) {
      editor
        .chain()
        .focus()
        .insertContent(`<blockquote>${text.replace(/\n/g, '<br>')}</blockquote><p></p>`)
        .run()
    }
  }

  return (
    <div class="w-full">
      <Form onSubmit={onSubmit}>
        <fieldset class="fieldset w-full p-0">
          <Field name="note">
            {(field, fieldProps) => (
              <div style={{ height: `${props.height ?? 0}px` }}>
                <FormTextEditor
                  {...fieldProps}
                  value={field.value ?? ''}
                  placeholder={t('Write your note here...')}
                  setFiles={setFiles}
                  customEvents={{
                    clipboardwrite: handleClipboardWrite,
                  }}
                />
                <span class="text-error">{field.error}</span>
              </div>
            )}
          </Field>

          <SubmitButton
            label={t('Save')}
            isPending={formState.submitting}
            disabled={!formState.dirty}
            class="btn btn-sm btn-neutral mt-1"
          />
        </fieldset>
      </Form>
    </div>
  )
}
