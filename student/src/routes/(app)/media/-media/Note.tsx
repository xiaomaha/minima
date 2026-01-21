import { createForm, reset, valiForm } from '@modular-forms/solid'
import type { Editor } from '@tiptap/core'
import { createEffect, createSignal } from 'solid-js'
import type * as v from 'valibot'
import { contentV1GetMediaNote, contentV1SaveMediaNote } from '@/api'
import { vNoteSaveSchema } from '@/api/valibot.gen'
import { ATTACHMENT_MAX_COUNT, ATTACHMENT_MAX_SIZE } from '@/config'
import { accessContextParam } from '@/context'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { TextEditor } from '../../-shared/editor/TextEditor'

interface Props {
  mediaId: string
  height?: number | null
}

export const Note = (props: Props) => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])

  const [contentForm, { Form, Field }] = createForm<v.InferInput<typeof vNoteSaveSchema>>({
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

  const onSubmit = async (values: v.InferInput<typeof vNoteSaveSchema>) => {
    const { data } = await contentV1SaveMediaNote({
      path: { id: props.mediaId },
      body: { note: values.note, files: files() },
      throwOnError: true,
    })

    setStore('data', data)
    reset(contentForm, { initialValues: { note: data.note } })
  }

  createEffect(() => {
    reset(contentForm, { initialValues: { note: note.data?.note ?? '' } })
  })

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
              <div class="relative">
                <div style={{ height: `${props.height ?? 0}px` }}>
                  <TextEditor
                    {...fieldProps}
                    value={field.value ?? ''}
                    placeholder={t('Write your note here...')}
                    setFiles={setFiles}
                    maxFiles={ATTACHMENT_MAX_COUNT}
                    maxFileSize={ATTACHMENT_MAX_SIZE}
                    customEvents={{
                      clipboardwrite: handleClipboardWrite,
                    }}
                  />
                  <span class="text-error">{field.error}</span>
                </div>
              </div>
            )}
          </Field>

          <SubmitButton
            label={t('Save')}
            isPending={contentForm.submitting}
            disabled={!contentForm.dirty}
            class="btn btn-sm btn-neutral mt-1"
          />
        </fieldset>
      </Form>
    </div>
  )
}
