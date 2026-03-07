import { Show } from 'solid-js'

export const SubmitButton = (props: { label: string; isPending: boolean; disabled: boolean; class?: string }) => {
  return (
    <button type="submit" class={props.class} disabled={props.isPending || props.disabled}>
      <Show when={!props.isPending} fallback={<span class="loading loading-spinner"></span>}>
        {props.label}
      </Show>
    </button>
  )
}
