import { IconExternalLink, IconHome } from '@tabler/icons-solidjs'
import { useNavigate } from '@tanstack/solid-router'
import { Show } from 'solid-js'

interface Props {
  id: string
  path: string[]
  link?: string
}

export const Breadcrumb = (props: Props) => {
  const navigate = useNavigate()

  return (
    <div class="breadcrumbs mb-8">
      <ul>
        <li>
          <span onclick={() => navigate({ to: '/tutor' })}>
            <IconHome size={20} />
          </span>
        </li>
        <Show when={props.path.length > 0}>
          <li>{props.path[0]}</li>
          <Show when={props.path.length > 1}>
            <li>{props.path[1]}</li>
            <Show when={props.path.length > 2 && props.link}>
              <li>
                <a class="link link-hover" href={props.link} target="_blank" rel="noreferrer">
                  {props.path[2]}
                  <IconExternalLink size={20} />
                </a>
              </li>
            </Show>
          </Show>
        </Show>
      </ul>
    </div>
  )
}
