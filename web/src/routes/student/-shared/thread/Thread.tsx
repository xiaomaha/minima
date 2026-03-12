import { IconPencil, IconPlus } from '@tabler/icons-solidjs'
import { createSignal, For, Show } from 'solid-js'
import { Portal } from 'solid-js/web'
import { type CommentNestedSchema, type CommentSchema, operationV1GetThread, operationV1GetThreadComments } from '@/api'
import { CHILD_COMMENT_MAX_COUNT } from '@/config'
import { accountStore } from '@/routes/account/-store'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createCachedStore } from '@/shared/solid/cached-store'
import { useTranslation } from '@/shared/solid/i18n'
import { Comment } from './Comment'
import { CommentEditor } from './CommentEditor'
import { type ThreadContextValue, ThreadProvider, useThreadContext } from './context'
import { Rating } from './Rating'

export const Thread = (props: ThreadContextValue['context']) => {
  const { t } = useTranslation()
  const { appLabel, model, subjectId, options } = props

  const threadStore = createCachedStore(
    'operationV1GetThread',
    () => ({ path: { app_label: appLabel, model, subject_id: subjectId } }),
    async (options) => (await operationV1GetThread(options)).data,
  )

  const thread = () => threadStore[0].data

  const commentStore = createCachedInfiniteStore(
    'operationV1GetThreadComments',
    () => (thread() ? { path: { id: thread()!.id } } : undefined),
    async (options, page) => (await operationV1GetThreadComments({ ...options, query: { page } })).data,
  )

  const disabled = () => props.options?.readOnly || !!thread()?.closed

  return (
    <fieldset disabled={disabled()}>
      <div class="flex flex-col gap-4">
        <div class="text-lg text-center space-x-4">
          <span>{t('{{count}} comment', { count: thread()?.commentCount ?? 0 })}</span>
          <Show when={options?.rating}>
            <Rating value={thread()?.ratingAvg ?? 0} class="text-lg!" />
          </Show>
        </div>
        <ThreadProvider value={{ threadStore, commentStore, context: props }}>
          <CommentList />
        </ThreadProvider>
      </div>
    </fieldset>
  )
}

interface SelectedComment {
  comment: CommentSchema
  mode: 'reply' | 'edit'
}

const CommentList = () => {
  const [commentList, setObserverRef] = useThreadContext().commentStore

  const [selectedComment, setSelectedComment] = createSignal<SelectedComment | null>(null)

  const selectToggle = (data: SelectedComment) => {
    setSelectedComment((prev) => {
      if (data && data.comment.id === prev?.comment.id && data.mode === prev?.mode) return null
      return data
    })
  }

  const handleReplyClick = (comment: CommentSchema) => {
    selectToggle({ comment, mode: 'reply' })
  }

  const handleEditClick = (comment: CommentSchema) => {
    selectToggle({ comment, mode: 'edit' })
  }

  return (
    <>
      <CommentEditor />
      <div class="flex flex-col gap-8">
        <For each={commentList.items}>
          {(item) => (
            <div>
              <CommentItem comment={item} onReplyClick={handleReplyClick} onEditClick={handleEditClick} />

              <Show when={item.children.length > 0}>
                <div class="ml-12 mt-2 space-y-4">
                  <For each={item.children}>
                    {(comment) => (
                      <CommentItem comment={comment} onReplyClick={handleReplyClick} onEditClick={handleEditClick} />
                    )}
                  </For>
                </div>
              </Show>
              <div id={`comment-${item.id}-reply-editor`} />
            </div>
          )}
        </For>
      </div>

      <Show when={!commentList.end}>
        <div ref={setObserverRef} class="flex justify-center py-8">
          <span class="loading loading-spinner loading-lg"></span>
        </div>
      </Show>

      <Show when={selectedComment()?.mode === 'reply'}>
        <Show when={selectedComment()?.comment.id} keyed>
          {(commentId) => (
            <Portal mount={document.getElementById(`comment-${commentId}-reply-editor`)!}>
              <div class="ml-12 mt-4">
                <CommentEditor parentId={commentId} onSuccess={() => setSelectedComment(null)} />
              </div>
            </Portal>
          )}
        </Show>
      </Show>
      <Show when={selectedComment()?.mode === 'edit'}>
        <Show when={selectedComment()?.comment.id} keyed>
          {(commentId) => (
            <Portal mount={document.getElementById(`comment-${commentId}-edit-editor`)!}>
              <div class="ml-12 mt-4">
                <CommentEditor comment={selectedComment()?.comment} onSuccess={() => setSelectedComment(null)} />
              </div>
            </Portal>
          )}
        </Show>
      </Show>
    </>
  )
}

interface CommentItemProps {
  comment: CommentSchema | CommentNestedSchema
  onReplyClick?: (comment: CommentSchema) => void
  onEditClick?: (comment: CommentSchema) => void
}

const CommentItem = (props: CommentItemProps) => {
  const showReplyButton = () => 'children' in props.comment && props.comment.children.length < CHILD_COMMENT_MAX_COUNT
  const showEditButton = () => props.comment.writer.id === accountStore.user?.id

  return (
    <div>
      <Comment comment={props.comment} />
      <Show when={!props.comment.deleted}>
        <div class="ml-12 flex gap-4 text-base-content/50">
          <Show when={showReplyButton()}>
            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost"
              onClick={() => props.onReplyClick?.(props.comment)}
            >
              <IconPlus size={20} />
            </button>
          </Show>
          <Show when={showEditButton()}>
            <button
              type="button"
              class="btn btn-xs btn-circle btn-ghost"
              onClick={() => props.onEditClick?.(props.comment)}
            >
              <IconPencil size={20} />
            </button>
          </Show>
        </div>
      </Show>
      <div id={`comment-${props.comment.id}-edit-editor`} />
    </div>
  )
}
