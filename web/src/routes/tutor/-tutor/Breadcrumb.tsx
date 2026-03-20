import { IconChevronRight, IconHome } from '@tabler/icons-solidjs'
import { type NavigateOptions, useNavigate } from '@tanstack/solid-router'
import { Show } from 'solid-js'
import { PreviewButton } from '@/routes/preview/-PreviewButton'
import { useTranslation } from '@/shared/solid/i18n'
import { capitalize } from '@/shared/utils'

interface Props {
  app: string
  id: string
  title: string
  kind: 'grading' | 'appeal'
}

export const Breadcrumb = (props: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const toContent = () => {
    let to: NavigateOptions['to']

    if (props.app === 'exam') {
      to = '/student/exam/$id/session'
    } else if (props.app === 'assignment') {
      to = '/student/assignment/$id/session'
    } else if (props.app === 'discussion') {
      to = '/student/discussion/$id/session'
    } else {
      throw new Error('Invalid app')
    }
    return { to, params: { id: props.id } }
  }

  const goToSibling = () => {
    if (props.kind === 'grading') {
      navigate({ to: '/tutor/$app/$id/appeal', params: { app: props.app, id: props.id } })
    } else {
      if (props.app === 'exam') {
        navigate({ to: '/tutor/exam/$id/grading', params: { id: props.id } })
      } else if (props.app === 'assignment') {
        navigate({ to: '/tutor/assignment/$id/grading', params: { id: props.id } })
      } else if (props.app === 'discussion') {
        navigate({ to: '/tutor/discussion/$id/grading', params: { id: props.id } })
      }
    }
  }

  return (
    <div class="breadcrumbs mb-8">
      <ul>
        <li>
          <span class="flex items-center gap-2" onclick={() => navigate({ to: '/tutor' })}>
            <IconHome size={20} />
            {t('Tutor')}
          </span>
        </li>
        <li>{t(capitalize(props.app))}</li>
        <li>
          <PreviewButton link={toContent()} title={props.title} class="mr-auto text-base/tight h-auto" />
        </li>
        <Show when={props.title}>
          <li class="space-x-4">
            <span class="pointer-events-none">{t(capitalize(props.kind))}</span>
            <span onclick={goToSibling} class="badge badge-sm badge-soft">
              <IconChevronRight size={12} />
              {props.kind === 'grading' ? t('Appeal') : t('Grading')}
            </span>
          </li>
        </Show>
      </ul>
    </div>
  )
}
