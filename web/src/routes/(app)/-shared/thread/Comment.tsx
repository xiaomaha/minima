import { IconPinFilled } from '@tabler/icons-solidjs'
import { formatDistanceToNow } from 'date-fns'
import { Show } from 'solid-js'
import type { CommentSchema } from '@/api'
import { Avatar } from '@/shared/Avatar'
import { ContentViewer } from '@/shared/ContentViewer'
import { Rating } from './Rating'

interface Props {
  comment: CommentSchema
}

export const Comment = (props: Props) => {
  return (
    <div class="chat chat-start space-y-1">
      <Avatar class="chat-image" size={props.comment.parentId ? 'sm' : 'md'} user={props.comment.writer} />
      <div class="chat-header label text-sm space-x-1">
        <span class="font-semibold">{props.comment.writer.nickname || props.comment.writer.name}</span>
        <time>{formatDistanceToNow(props.comment.modified, { addSuffix: true })}</time>
        <Show when={props.comment.rating && !props.comment.parentId}>
          <Rating value={props.comment.rating!} />
        </Show>
        <Show when={props.comment.pinned}>
          <IconPinFilled size={20} class="text-accent" />
        </Show>
      </div>
      <div
        class="chat-bubble p-4 rounded-t-xl rounded-r-xl rounded-0 max-w-full"
        classList={{
          'bg-primary/10': !props.comment.parentId,
          'bg-base-content/5': !!props.comment.parentId,
        }}
      >
        <ContentViewer content={props.comment.comment} />
      </div>
    </div>
  )
}
