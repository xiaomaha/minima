import DOMPurify from 'dompurify'
import { decodeURLText } from './utils'

interface Props {
  content: string
  class?: string
}

export const ContentViewer = (props: Props) => {
  const content = () => DOMPurify.sanitize(props.content, {})

  return (
    <div
      innerHTML={decodeURLText(content())}
      class={`prose max-w-none text-base whitespace-pre-wrap break-all ${props.class ?? ''}`}
    />
  )
}
