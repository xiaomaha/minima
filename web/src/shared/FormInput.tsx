import { type JSX, Show } from 'solid-js'

export const FormInput = (props: { children: JSX.Element; help?: string; error?: string }) => {
  return (
    <div class="relative">
      {props.children}
      <Show when={props.error || props.help}>
        <div class="absolute mt-0.5">
          <Show when={props.error} fallback={<span class="label">{props.help}</span>}>
            <span class="text-error">{props.error}</span>
          </Show>
        </div>
      </Show>
    </div>
  )
}
