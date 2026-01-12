import { Show } from 'solid-js'
import { getProgress } from './record'

interface Props {
  contentId: string
  accessContext?: string
  passingPoint?: number
  class?: string
}

export const ProgressBar = (props: Props) => {
  const progress = () => getProgress(props.contentId, props.accessContext ?? '')

  return (
    <Show when={progress()}>
      {(s) => (
        <progress
          class={
            'progress [&::-webkit-progress-value]:rounded-none [&::-moz-progress-bar]:rounded-none ' +
            `${props.class ?? ''}`
          }
          classList={{
            '[&::-webkit-progress-value]:bg-green-600! [&::-moz-progress-bar]:bg-green-600!':
              s() > (props.passingPoint ?? 0),
            '[&::-webkit-progress-value]:bg-red-500! [&::-moz-progress-bar]:bg-red-500!':
              s() <= (props.passingPoint ?? 0),
          }}
          value={progress()}
          max="100"
        />
      )}
    </Show>
  )
}
