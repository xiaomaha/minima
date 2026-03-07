interface Props {
  class?: string
  small?: boolean
}

export const LoadingOverlay = (props: Props) => (
  <div class={`fixed inset-0 z-50 flex items-center justify-center h-full ${props.class ?? ''}`}>
    <span
      class="loading loading-spinner text-primary"
      classList={{ 'loading-sm': props.small, 'loading-lg': !props.small }}
    />
  </div>
)
