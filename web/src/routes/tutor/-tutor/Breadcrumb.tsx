import { IconExternalLink, IconHome } from '@tabler/icons-solidjs'
import { Link, useNavigate } from '@tanstack/solid-router'
import { Show } from 'solid-js'
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
    if (props.app === 'exam') {
      return '/student/exam/$id/session'
    } else if (props.app === 'assignment') {
      return '/student/assignment/$id/session'
    } else if (props.app === 'discussion') {
      return '/student/discussion/$id/session'
    } else {
      throw new Error('Invalid app')
    }
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
          <span onclick={() => navigate({ to: '/tutor' })}>
            <IconHome size={20} />
          </span>
        </li>
        <li>{t(capitalize(props.app))}</li>
        <li>
          <Link to={toContent()} params={{ id: props.id }} class="link link-hover" target="_blank" rel="noreferrer">
            {props.title}
            <IconExternalLink size={20} />
          </Link>
        </li>
        <Show when={props.title}>
          <li class="space-x-2">
            <span class="badge badge-sm badge-primary pointer-events-none">{t(capitalize(props.kind))}</span>
            <span onclick={goToSibling} class="badge badge-sm badge-outline">
              {props.kind === 'grading' ? t('Appeal') : t('Grading')}
            </span>
          </li>
        </Show>
      </ul>
    </div>
  )
}
