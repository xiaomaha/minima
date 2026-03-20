import { formatDistanceToNow } from 'date-fns'
import { For } from 'solid-js'
import { ContentViewer } from '@/shared/ContentViewer'
import type { DetailFieldType } from './types'

export const renderValue = (v: unknown, type?: DetailFieldType) => {
  if (v === '' || v === null || v === undefined) return undefined

  switch (type) {
    case 'boolean':
      return <span class="status" classList={{ 'status-success': !!v, 'status-error': !v }} />
    case 'number':
      return <>{(v as number).toLocaleString()}</>
    case 'date':
      return <span title={new Date(v as string).toLocaleString()}>{new Date(v as string).toLocaleDateString()}</span>
    case 'datetime':
      return (
        <span class="text-nowrap" title={new Date(v as string).toLocaleString()}>
          {new Date(v as string).toLocaleString()}
        </span>
      )
    case 'distanceToNow':
      return (
        <span class="text-nowrap" title={new Date(v as string).toLocaleString()}>
          {formatDistanceToNow(v as Date, { addSuffix: true })}
        </span>
      )
    case 'badge':
      return <span class="badge badge-sm badge-soft p-1">{String(v)}</span>
    case 'badgeList':
      return (
        <div class="flex gap-1 flex-wrap">
          <For
            each={
              typeof v === 'object' && !Array.isArray(v)
                ? Object.entries(v as Record<string, unknown>).filter(([_, val]) => val)
                : (v as [])
            }
          >
            {(item) => (
              <span class="badge badge-sm badge-soft">
                {Array.isArray(item) ? `${item[0]} ${item[1]}` : String(item)}
              </span>
            )}
          </For>
        </div>
      )
    case 'thumbnail':
      return <img class="object-cover w-9 h-9 rounded" src={v as string} alt="" />
    case 'content':
      return <ContentViewer content={v as string} />
    default:
      return <>{String(v)}</>
  }
}
