import { IconEdit, IconHelpCircleFilled, IconMessage, IconPlus } from '@tabler/icons-solidjs'
import { formatDistanceToNow } from 'date-fns'
import { createSignal, For, Show } from 'solid-js'
import type { SetStoreFunction } from 'solid-js/store'
import type * as v from 'valibot'
import {
  type DiscussionPostNestedSchema,
  discussionV1CreatePost,
  discussionV1GetPosts,
  discussionV1UpdatePost,
} from '@/api'
import { vDiscussionPostSaveSchema } from '@/api/valibot.gen'
import { accessContextParam } from '@/context'
import { accountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { FormTextEditor } from '@/shared/editor/FormTextEditor'
import { FormInput } from '@/shared/FormInput'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'
import { useSession } from './context'

export const Thread = () => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  const [editorOpen, setEditorOpen] = createSignal<ContentEditorOptions | null>(null)
  const [selectedPostID, setSelectedPostID] = createSignal<number | null>(null)

  const [posts, setObserverEl, { setStore }] = createCachedInfiniteStore(
    'discussionV1GetPosts',
    () => ({ path: { id: s().discussion.id }, query: accessContextParam() }),
    async (options, page) => {
      const { data } = await discussionV1GetPosts({ ...options, query: { page } })
      return data
    },
  )

  const selectedPost = () => posts.items.find((item) => item.id === selectedPostID())

  // Based on access date not session.step. cf. exam, assignment
  // Api will be blocked after end date
  const disabled = () => new Date(s().accessDate.end) < new Date()

  return (
    <>
      <div class="w-full">
        <div class="my-12 text-center space-y-4">
          <Show when={!disabled()}>
            <button
              type="button"
              class="btn btn-primary"
              onClick={() =>
                setEditorOpen({
                  bodyMinLength: s().attempt!.question.postMinCharacters,
                })
              }
            >
              <IconPlus />
              {t('Write Discussion Post')}
            </button>
          </Show>

          <Show when={s().postCount}>
            <div class="flex font-semibold items-center gap-4 justify-center text-base-content/60">
              <span>{t('{{count}} post', { count: s().postCount!.validPost })}</span>
              <span>{t('{{count}} reply', { count: s().postCount!.validReply })}</span>
              <div
                class="tooltip"
                data-tip={t(
                  'Only the number of posts that meet the evaluation criteria is included in the total count.',
                )}
              >
                <IconHelpCircleFilled class="text-info" />
              </div>
            </div>
          </Show>
        </div>

        <div class="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-x-5 gap-y-8">
          <For each={posts.items}>{(item) => <PostCard post={item} onClick={() => setSelectedPostID(item.id)} />}</For>
        </div>

        <Show when={!posts.end}>
          <div ref={setObserverEl} class="flex justify-center py-8">
            <span class="loading loading-spinner loading-lg"></span>
          </div>
        </Show>
      </div>

      <Dialog boxClass="max-w-5xl" open={!!selectedPostID()} onClose={() => setSelectedPostID(null)}>
        <PostThread post={selectedPost()!} setEditorOpen={setEditorOpen} disabled={disabled()} />
      </Dialog>

      <Dialog boxClass="max-w-5xl" open={!!editorOpen()} onClose={() => setEditorOpen(null)}>
        <ContentEditor
          discussionId={s().discussion.id}
          onSuccess={() => setEditorOpen(null)}
          setStore={setStore}
          {...editorOpen()}
        />
      </Dialog>
    </>
  )
}

interface PostCardProps {
  post: DiscussionPostNestedSchema
  onClick: () => void
}

const PostCard = (props: PostCardProps) => {
  const { t } = useTranslation()

  const displayName = () => props.post.learner.nickname || props.post.learner.name

  return (
    <button
      type="button"
      class="card bg-base-100 border-base-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer text-start"
      onClick={props.onClick}
    >
      <div class="card-body p-4">
        <div class="flex items-center gap-2 mb-3">
          <Avatar user={props.post.learner} />
          <div>
            <div class="font-medium">{displayName()}</div>
            <div class="text-sm text-base-content/60">
              <div class="tooltip" data-tip={t('Modified At')}>
                {formatDistanceToNow(props.post.modified, { addSuffix: true })}
              </div>
            </div>
          </div>
          <Show when={props.post.learner.id === accountStore.user?.id}>
            <div class="ml-2 badge badge-sm badge-primary badge-soft">{t('Me')}</div>
          </Show>
        </div>

        <h3 class="card-title mb-2 line-clamp-3">{props.post.title}</h3>
        <p class="text-base-content/80 line-clamp-3 max-h-16 break-all">{extractText(props.post.body)}</p>

        <div class="flex-1 flex items-end gap-4 mt-3 text-sm text-base-content/60">
          <div class="flex items-center gap-1">
            <IconMessage size={20} />
            <span>{props.post.children.length}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

interface PostThreadProps {
  post: DiscussionPostNestedSchema
  setEditorOpen: (options: ContentEditorOptions | null) => void
  disabled: boolean
}

const PostThread = (props: PostThreadProps) => {
  const { t } = useTranslation()

  const [session] = useSession()
  const s = () => session.data!

  const question = s().attempt!.question
  const postBodyMinLength = question.postMinCharacters!
  const replyBodyMinLength = question.replyMinCharacters!

  const post = props.post
  const displayName = (learner: typeof post.learner) => learner.nickname || learner.name

  return (
    <div class="p-8 space-y-16 min-h-150">
      <article>
        <div class="flex items-center gap-3 mb-8">
          <Avatar user={post.learner} size="lg" />
          <div>
            <div class="font-semibold text-base">{displayName(post.learner)}</div>
            <div class="text-sm text-base-content/50">
              {formatDistanceToNow(props.post.modified, { addSuffix: true })}
            </div>
          </div>
          <Show when={post.learner.id === accountStore.user?.id}>
            <div class="badge badge-sm badge-primary badge-soft">{t('Me')}</div>
            <div class="flex-1" />
            <Show when={!props.disabled}>
              <button
                type="button"
                class="mr-4 btn btn-square btn-ghost rounded-full"
                onClick={() =>
                  props.setEditorOpen({
                    postId: post.id,
                    title: props.post.title,
                    body: props.post.body,
                    bodyMinLength: postBodyMinLength,
                  })
                }
              >
                <IconEdit />
              </button>
            </Show>
          </Show>
        </div>

        <h2 class="font-bold mb-8 leading-tight">{props.post.title}</h2>
        <ContentViewer content={props.post.body} />
      </article>

      <Show when={!props.disabled}>
        <div class="my-12 text-center">
          <button
            type="button"
            class="btn btn-primary"
            onClick={() =>
              props.setEditorOpen({
                parentId: props.post.id,
                bodyMinLength: replyBodyMinLength,
              })
            }
          >
            <IconPlus />
            {t('Write Reply')}
          </button>
        </div>
      </Show>

      <div class="border-t border-base-300 pt-12 px-6">
        <div class="flex items-center gap-2 mb-8 text-base-content/60">
          <IconMessage class="w-5 h-5" />
          <span class="text-sm font-medium">
            {t('Replies')} {props.post.children.length}
          </span>
        </div>

        <div class="space-y-8">
          <For each={props.post.children}>
            {(reply, index) => (
              <>
                <Show when={index() > 0}>
                  <div class="border-t border-base-200" />
                </Show>
                <article class="space-y-4">
                  <div class="flex items-center gap-3">
                    <Avatar user={reply.learner} size="md" />
                    <div>
                      <div class="font-medium text-sm">{displayName(reply.learner)}</div>
                      <div class="text-xs text-base-content/50">
                        {formatDistanceToNow(reply.modified, { addSuffix: true })}
                      </div>
                    </div>
                    <Show when={reply.learner.id === accountStore.user?.id}>
                      <div class="badge badge-xs badge-primary badge-soft">{t('Me')}</div>
                      <div class="flex-1" />
                      <Show when={!props.disabled}>
                        <button
                          type="button"
                          class="mr-4 btn btn-square btn-ghost rounded-full"
                          onClick={() =>
                            props.setEditorOpen({
                              parentId: post.id,
                              postId: reply.id,
                              title: reply.title,
                              body: reply.body,
                              bodyMinLength: replyBodyMinLength,
                            })
                          }
                        >
                          <IconEdit />
                        </button>
                      </Show>
                    </Show>
                  </div>

                  <h3 class="font-semibold">{reply.title}</h3>
                  <ContentViewer content={reply.body} />
                </article>
              </>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}

interface ContentEditorOptions {
  parentId?: number
  postId?: number
  title?: string
  body?: string
  bodyMinLength?: number
}

interface ContentEditorProps extends ContentEditorOptions {
  discussionId: string
  onSuccess: () => void
  setStore: SetStoreFunction<{ items: DiscussionPostNestedSchema[] }>
}

const ContentEditor = (props: ContentEditorProps) => {
  const { t } = useTranslation()
  const [files, setFiles] = createSignal<File[]>([])

  // session
  const [, { setStore: setSessionStore }] = useSession()

  const [formState, { Form, Field }] = createForm<v.InferInput<typeof vDiscussionPostSaveSchema>>({
    initialValues: {
      title: props.title ?? '',
      body: props.body ?? '',
    },
    validate: valiForm(vDiscussionPostSaveSchema),
  })

  const onSubmit = async (values: v.InferInput<typeof vDiscussionPostSaveSchema>) => {
    if (!props.postId) {
      const { data } = await discussionV1CreatePost({
        path: { id: props.discussionId },
        body: { ...values, parentId: props.parentId, files: files() },
      })
      if (!props.parentId) {
        // create post
        props.setStore('items', (prev) => [{ ...data, children: [] }, ...prev])
        // post count
        setSessionStore('data', 'postCount', data.postCount)
      } else {
        // create reply
        props.setStore(
          'items',
          (item) => item.id === props.parentId,
          'children',
          (prev) => [...prev, data],
        )
        // post count
        setSessionStore('data', 'postCount', data.postCount)
      }
    } else {
      const { data } = await discussionV1UpdatePost({
        path: { id: props.discussionId, post_id: props.postId },
        body: { ...values, files: files() },
      })
      if (!props.parentId) {
        // update post
        props.setStore('items', (item) => item.id === props.postId, data)
      } else {
        // update reply
        props.setStore(
          'items',
          (item) => item.id === props.parentId,
          'children',
          (child) => child.id === props.postId,
          data,
        )
      }
    }
    props.onSuccess()
  }

  return (
    <div class="px-6 py-4">
      <h3>{props.parentId ? t('Write Reply') : t('Write Post')}</h3>
      <Form onSubmit={onSubmit}>
        <fieldset class="fieldset w-full space-y-5">
          <Field name="title">
            {(field, props) => (
              <FormInput error={field.error}>
                <input {...props} value={field.value} class="input w-full" placeholder={t('Title')} autofocus />
              </FormInput>
            )}
          </Field>

          <Field
            name="body"
            validate={(value) => {
              const minLength = props.bodyMinLength
              if (!minLength) return ''
              const length = extractText(value ?? '').length ?? 0
              return length < minLength
                ? t('Content must be at least {{num1}} characters. Current length: {{num2}}', {
                    num1: minLength,
                    num2: length,
                  })
                : ''
            }}
          >
            {(field, fieldProps) => (
              <FormInput error={field.error} help={t('Minimum {{num1}} characters', { num1: props.bodyMinLength })}>
                <FormTextEditor
                  {...fieldProps}
                  value={field.value ?? ''}
                  class="min-h-60 max-h-120"
                  placeholder={t('Write your content here...')}
                  setFiles={setFiles}
                />
              </FormInput>
            )}
          </Field>

          <SubmitButton
            label={t('Save')}
            isPending={formState.submitting}
            disabled={!formState.dirty}
            class="btn btn-neutral mt-4"
          />
        </fieldset>
      </Form>
    </div>
  )
}
