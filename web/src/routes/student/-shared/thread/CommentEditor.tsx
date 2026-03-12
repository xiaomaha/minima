import { IconTrash } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import type * as v from 'valibot'
import { type CommentSchema, operationV1CreateThread, operationV1DeleteComment, operationV1SaveComment } from '@/api'
import { vCommentSaveSchema } from '@/api/valibot.gen'
import { COMMENT_MIN_CHARACTERS } from '@/config'
import { accountStore } from '@/routes/account/-store'
import { FormTextEditor } from '@/shared/editor/FormTextEditor'
import { SubmitButton } from '@/shared/SubmitButton'
import { initCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'
import { useThreadContext } from './context'

interface Props {
  comment?: CommentSchema
  parentId?: number
  onSuccess?: () => void
}

export const CommentEditor = (props: Props) => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])

  const { threadStore, commentStore, context } = useThreadContext()
  const [thread, { setStore: setThreadStore }] = threadStore
  const [, , { setStore: setCommentStore }] = commentStore

  const isReply = !!(props.comment?.parentId || props.parentId)

  const [formState, { Form, Field, reset, setValue }] = createForm<v.InferInput<typeof vCommentSaveSchema>>({
    initialValues: {
      id: props.comment?.id,
      comment: props.comment?.comment,
      rating: context.options?.rating && !isReply ? (props.comment?.rating ?? 0) : undefined, // omit rating if reply
      parentId: props.comment ? props.comment.parentId : props.parentId,
    },
    validate: valiForm(vCommentSaveSchema),
  })

  const onSubmit = async (values: v.InferInput<typeof vCommentSaveSchema>) => {
    if (thread.loading) return

    if (!thread.data) {
      const { appLabel, model, subjectId, title, description } = context
      const { data } = await operationV1CreateThread({
        body: {
          appLabel,
          model,
          subjectId,
          title: title ?? '',
          description: description ?? '',
          path: `${window.location.pathname}${window.location.search}`,
        },
      })

      // set comment list cache to disable fetch empty data
      initCachedInfiniteStore('operationV1GetThreadComments', { path: { id: data.id } })
      setThreadStore('data', data)
    }

    // assert comment list cache

    const { data } = await operationV1SaveComment({
      path: { id: thread.data!.id },
      body: { ...values, files: files() },
    })

    if (!props.comment) {
      if (!props.parentId) {
        // create comment: new comment first
        setCommentStore('items', (prev) => [{ ...data, children: [], writer: accountStore.user! }, ...prev])
        setThreadStore('data', (prev) => {
          const ratingCount = prev!.ratingCount + 1
          const ratingAvg = (prev!.ratingAvg * prev!.ratingCount + (data.rating ?? 0)) / ratingCount
          return { ...prev, commentCount: prev!.commentCount + 1, ratingAvg, ratingCount }
        })
      } else {
        // create reply: new reply last
        setCommentStore(
          'items',
          (prev) => prev.id === props.parentId,
          'children',
          (prev) => [...prev, { ...data, writer: accountStore.user! }],
        )
        setThreadStore('data', 'commentCount', (prev) => prev + 1)
      }
    } else {
      if (!props.comment.parentId) {
        // update comment
        setCommentStore('items', (prev) => prev.id === props.comment!.id, { ...data, writer: accountStore.user! })
      } else {
        // update reply
        setCommentStore(
          'items',
          (prev) => prev.id === props.comment!.parentId,
          'children',
          (prev) => prev.id === props.comment!.id,
          { ...data, writer: accountStore.user! },
        )
      }
    }

    reset({})
    props.onSuccess?.()
  }

  const handleDeleteClick = async (e: Event, comment: CommentSchema) => {
    e.preventDefault()
    if (!confirm(t('Are you sure you want to delete this comment?'))) return

    await operationV1DeleteComment({
      path: { id: thread.data!.id, comment_id: comment.id },
    })

    if (!comment.parentId) {
      // soft delete comment
      setCommentStore(
        'items',
        (prev) => prev.id === comment.id,
        (item) => ({
          ...item,
          comment: t('[DELETED]'),
          deleted: true,
        }),
      )
    } else {
      // soft delete reply
      setCommentStore(
        'items',
        (prev) => prev.id === comment.parentId,
        'children',
        (prev) => prev.id === comment.id,
        (item) => ({ ...item, comment: t('[DELETED]'), deleted: true }),
      )
    }

    reset({})
    props.onSuccess?.()
  }

  return (
    <Form onSubmit={onSubmit}>
      <fieldset class="fieldset w-full2 mb-4">
        <Show when={context.options?.rating && !isReply}>
          <Field
            name="rating"
            validate={(value) => (!value || value < 1 || value > 5 ? t('Please select a rating.') : '')}
          >
            {(field) => (
              <div class="flex gap-3 items-center">
                <div class="flex gap-0.5">
                  <For each={[1, 2, 3, 4, 5]}>
                    {(i) => (
                      <label class="cursor-pointer">
                        <input
                          type="radio"
                          name="rating-input"
                          class="hidden"
                          checked={field.value === i}
                          onChange={() => setValue('rating', i)}
                        />
                        <span
                          class={
                            `${field.value && field.value >= i ? 'text-orange-500' : 'text-gray-300'}` +
                            `${!props.comment ? ' text-lg' : ' text-base'}` // classlist not working
                          }
                        >
                          ★
                        </span>
                      </label>
                    )}
                  </For>
                </div>
                <div class="text-error">{field.error}</div>
              </div>
            )}
          </Field>
        </Show>
        <Field
          name="comment"
          validate={(value) => {
            const length = extractText(value ?? '').length ?? 0
            return length < COMMENT_MIN_CHARACTERS
              ? t('Content must be at least {{num1}} characters. Current length: {{num2}}', {
                  num1: COMMENT_MIN_CHARACTERS,
                  num2: length,
                })
              : ''
          }}
        >
          {(field, fieldProps) => (
            <div class="relative">
              <FormTextEditor
                {...fieldProps}
                value={field.value ?? ''}
                class={`min-h-25 max-h-100 ${context.options?.editorClass ?? ''}`}
                placeholder={t('Write your comment here...')}
                setFiles={setFiles}
                hideToolbar={!context.options?.richText}
              />
              <span class="text-error absolute bottom-1 left-2">{field.error}</span>
            </div>
          )}
        </Field>

        <Field name="id">{() => null}</Field>
        <Field name="parentId">{() => null}</Field>

        <div class="flex gap-2 items-center">
          <SubmitButton
            label={t('Save')}
            isPending={formState.submitting}
            disabled={!formState.dirty}
            class="flex-1 btn btn-sm btn-neutral mt-1"
          />
          <Show when={props.comment?.id}>
            <button
              type="button"
              class="btn btn-sm btn-ghost btn-circle text-error"
              onClick={(e) => handleDeleteClick(e, props.comment!)}
            >
              <IconTrash size={20} />
            </button>
          </Show>
        </div>
      </fieldset>
    </Form>
  )
}
