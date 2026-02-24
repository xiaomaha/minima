import {
  IconChevronDown,
  IconChevronUp,
  IconEdit,
  IconLink,
  IconMessage,
  IconPlus,
  IconQuestionMark,
} from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import {
  createContext,
  createRoot,
  createSignal,
  For,
  Match,
  onCleanup,
  onMount,
  Show,
  Switch,
  useContext,
} from 'solid-js'
import { createStore, type SetStoreFunction } from 'solid-js/store'
import type * as v from 'valibot'
import { type InquirySchema, operationV1CreateInquiry, operationV1GetInquiries, operationV1UpdateInquiry } from '@/api'
import { vInquiryCreateSchema } from '@/api/valibot.gen'
import { INQUIRY_MIN_CHARACTERS } from '@/config'
import { accountStore } from '@/routes/(app)/account/-store'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { Dialog } from '@/shared/Diaglog'
import { FormTextEditor } from '@/shared/editor/FormTextEditor'
import { FormInput } from '@/shared/FormInput'
import { NoContent } from '@/shared/NoContent'
import { SubmitButton } from '@/shared/SubmitButton'
import { createCachedInfiniteStore } from '@/shared/solid/cached-infinite-store'
import { createForm, valiForm } from '@/shared/solid/form'
import { useTranslation } from '@/shared/solid/i18n'
import { extractText } from '@/shared/utils'

interface Props {
  appLabel?: string
  model?: string
  contentId?: string | number
  disabled?: boolean
  setRefreshHandler: (handler?: () => void) => void
}

interface EditorOptions {
  inquiryId?: number
  title?: string
  question?: string
}

const InquiryContext = createContext<{
  appLabel: string
  model: string
  contentId: string | number
}>()

const useInquiryContext = () => {
  const ctx = useContext(InquiryContext)
  if (!ctx) throw new Error('InquiryContext must be used within Provider')
  return ctx
}

export const Inquiry = (props: Props) => {
  const { t } = useTranslation()
  const [editorOpen, setEditorOpen] = createSignal<EditorOptions | null>(null)

  const [inquiries, setObserverEl, { setStore, refetch }] = createCachedInfiniteStore(
    'operationV1GetInquiries',
    () => ({ query: { appLabel: props.appLabel, model: props.model, contentId: props.contentId } }),
    async (options, page) => {
      const { data } = await operationV1GetInquiries({ ...options, query: { ...options.query, page } })
      return data
    },
  )

  onMount(() => props.setRefreshHandler(() => refetch))
  onCleanup(() => props.setRefreshHandler(undefined))

  // This means if not content provided, use the account user as content
  const appLabel = props.appLabel || 'account'
  const model = props.model || 'user'
  const contentId = props.contentId || accountStore.user!.id

  return (
    <InquiryContext.Provider value={{ appLabel, model, contentId }}>
      <Show when={accountStore.user}>
        <button
          type="button"
          class="flex mx-auto btn btn-ghost my-8 rounded-full"
          onClick={() => setEditorOpen({})}
          disabled={props.disabled}
        >
          <IconPlus />
          {t('Write Inquiry')}
        </button>

        <Dialog boxClass="max-w-4xl" open={!!editorOpen()} onClose={() => setEditorOpen(null)}>
          <InquiryEditor
            inquiryId={editorOpen()?.inquiryId}
            title={editorOpen()?.title}
            question={editorOpen()?.question}
            setStore={setStore}
            onSuccess={() => setEditorOpen(null)}
          />
        </Dialog>

        <div class="max-w-4xl mx-auto space-y-12">
          <For each={inquiries.items}>
            {(item, i) => {
              if (i() === 0) setOpen(item.id, true)
              return <Item inquiry={item} numbering={inquiries.items.length - i()} onEdit={setEditorOpen} />
            }}
          </For>

          <Show when={inquiries.end && inquiries.count === 0}>
            <NoContent icon={IconQuestionMark} message={t('No inquiry created yet.')} />
          </Show>

          <Show when={!inquiries.end}>
            <div ref={setObserverEl} class="flex justify-center py-8">
              <span class="loading loading-spinner loading-lg" />
            </div>
          </Show>
        </div>
      </Show>
    </InquiryContext.Provider>
  )
}

type InquiryEditorProps = {
  inquiryId?: number
  title?: string
  question?: string
  setStore: SetStoreFunction<{ items: InquirySchema[] }>
  onSuccess: () => void
}

const InquiryEditor = (props: InquiryEditorProps) => {
  const { t } = useTranslation()
  const inquiryContext = useInquiryContext()
  const [files, setFiles] = createSignal<File[]>([])

  const [formState, { Form, Field }] = createForm<v.InferInput<typeof vInquiryCreateSchema>>({
    initialValues: {
      title: props.title ?? '',
      question: props.question ?? '',
      path: `${window.location.pathname}${window.location.search}`,
      ...inquiryContext,
    },
    validate: valiForm(vInquiryCreateSchema),
  })

  const onSubmit = async (values: v.InferInput<typeof vInquiryCreateSchema>) => {
    if (!props.inquiryId) {
      const { data } = await operationV1CreateInquiry({ body: { ...values, files: files() } })
      props.setStore('items', (prev) => [
        { ...data, contentId: inquiryContext.contentId, contentType: inquiryContext, responses: [] },
        ...prev,
      ])
    } else {
      const { data } = await operationV1UpdateInquiry({
        path: { id: props.inquiryId },
        body: { title: values.title, question: values.question, files: files() },
      })
      props.setStore('items', (item) => item.id === props.inquiryId, data)
    }
    props.onSuccess()
  }

  return (
    <div class="px-6 py-4">
      <h3>{t('Write Inquiry')}</h3>
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
            name="question"
            validate={(value) => {
              const length = extractText(value ?? '').length ?? 0
              return length < INQUIRY_MIN_CHARACTERS
                ? t('Question must be at least {{num1}} characters. Current length: {{num2}}', {
                    num1: INQUIRY_MIN_CHARACTERS,
                    num2: length,
                  })
                : ''
            }}
          >
            {(field, fieldProps) => (
              <FormInput error={field.error} help={t('Minimum {{num1}} characters', { num1: INQUIRY_MIN_CHARACTERS })}>
                <FormTextEditor
                  {...fieldProps}
                  value={field.value ?? ''}
                  class="min-h-60 max-h-96"
                  placeholder={t('Write your inquiry here...')}
                  setFiles={setFiles}
                />
              </FormInput>
            )}
          </Field>

          <Field name="appLabel">{() => null}</Field>
          <Field name="model">{() => null}</Field>
          <Field name="contentId">{() => null}</Field>

          <SubmitButton
            label={t('Submit inquiry')}
            isPending={formState.submitting}
            disabled={!formState.dirty}
            class="btn btn-neutral mt-4"
          />
        </fieldset>
      </Form>
    </div>
  )
}

interface ItemProps {
  inquiry: InquirySchema
  numbering: number
  onEdit: (options: EditorOptions) => void
}

const { open, setOpen } = createRoot(() => {
  const [open, setOpen] = createStore<Record<number, boolean>>({})
  return { open, setOpen: (inquiryId: number, value: boolean) => setOpen(inquiryId, value) }
})

const Item = (props: ItemProps) => {
  const { t } = useTranslation()
  const inquiryContext = useInquiryContext()
  const navigate = useNavigate()

  const inquiry = props.inquiry
  const solved = props.inquiry.responses.some((r) => r.solved)

  const link = () => {
    if (
      inquiryContext.appLabel === inquiry.contentType.appLabel &&
      inquiryContext.model === inquiry.contentType.model
    ) {
      return
    }

    switch (inquiry.contentType.model) {
      case 'course':
        return `/course/${inquiry.contentId}/session`
    }
  }

  return (
    <div class="relative outline-none">
      <div class="p-0 flex flex-col gap-4">
        <div class="flex items-center gap-4 text-sm label">
          <span class="text-sm opacity-40">#{props.numbering}</span>
          <time class="tooltip" data-tip={new Date(inquiry.modified).toLocaleString()}>
            {new Date(inquiry.modified).toLocaleString()}
          </time>

          <Show when={link()}>
            <button
              type="button"
              class="btn btn-sm btn-circle btn-ghost"
              onclick={(e) => {
                e.stopPropagation()
                e.preventDefault()
                navigate({ to: link() })
              }}
            >
              <IconLink size={16} />
            </button>
          </Show>

          <div class="flex-1" />
          <div class="relative h-4 w-4">
            <Switch>
              <Match when={solved}>
                <div class="tooltip tooltip-left" data-tip={t('Solved')}>
                  <span class="status status-success absolute inset-0 m-auto z-1" />
                </div>
              </Match>
              <Match when={!solved}>
                <div class="tooltip tooltip-left" data-tip={t('Waiting')}>
                  <span class="status status-warning absolute inset-0 m-auto z-1" />
                </div>
              </Match>
            </Switch>
          </div>
        </div>

        <h4 class="mt-0" classList={{ 'line-clamp-2': !open[props.inquiry.id] }}>
          {inquiry.title}
        </h4>

        <div onclick={() => setOpen(props.inquiry.id, !open[props.inquiry.id])} class="cursor-pointer">
          <Show
            when={open[props.inquiry.id]}
            fallback={<div class="line-clamp-2 text-sm text-base-content/80">{extractText(inquiry.question)}</div>}
          >
            <ContentViewer content={inquiry.question} class="text-sm" />
          </Show>
        </div>

        <div class="flex gap-4 items-center text-sm h-10">
          <div class="flex gap-2 items-center">
            <IconMessage size={20} />
            {inquiry.responses.length}
          </div>

          <Show when={inquiry.responses.length}>
            <label class="swap swap-rotate btn btn-ghost btn-circle btn-sm">
              <input
                type="checkbox"
                checked={!open[props.inquiry.id]}
                onChange={() => setOpen(props.inquiry.id, !open[props.inquiry.id])}
              />
              <IconChevronDown class="swap-on" />
              <IconChevronUp class="swap-off" />
            </label>
          </Show>

          <Show when={!inquiry.responses.length}>
            <div class="relative w-4 h-4">
              <button
                type="button"
                class="btn btn-square btn-sm btn-circle btn-ghost absolute inset-0 m-auto z-1"
                onClick={() => {
                  props.onEdit({
                    inquiryId: props.inquiry.id,
                    title: props.inquiry.title,
                    question: props.inquiry.question,
                  })
                }}
              >
                <IconEdit size={20} />
              </button>
            </div>
          </Show>
        </div>
      </div>

      <Show when={open[props.inquiry.id]}>
        <div class="mt-6  space-y-6">
          <For each={inquiry.responses}>
            {(response) => (
              <div class="flex gap-4 items-start">
                <Avatar user={response.writer} />
                <div class="space-y-2">
                  <div class="flex gap-4 items-center">
                    <div class="text-sm">
                      <div class="font-semibold">{response.writer.nickname || response.writer.name}</div>
                      <div class="text-base-content/60">{new Date(response.modified).toLocaleString()}</div>
                    </div>
                    <Show when={response.solved}>
                      <div class="badge badge-sm badge-success badge-soft">{t('Solved')}</div>
                    </Show>
                  </div>
                  <div class="">{response.answer}</div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  )
}
