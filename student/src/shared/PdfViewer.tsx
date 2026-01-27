import { type PDFSlickState, usePDFSlick } from '@pdfslick/solid'
import '@pdfslick/solid/dist/pdf_viewer.css'
import {
  IconChevronLeft,
  IconChevronRight,
  IconMinus,
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconPlus,
} from '@tabler/icons-solidjs'
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { useTranslation } from '@/shared/solid/i18n'
import { toHHMMSS } from '@/shared/utils'
import type { MediaPlayerAPI } from './MediaPlayerAPI'

interface PdfViewerProps {
  src: string
  duration: number
  onReady?: (api: MediaPlayerAPI) => void
}

export function PdfViewer(props: PdfViewerProps) {
  const {
    isDocumentLoaded,
    viewerRef,
    pdfSlickStore: store,
    PDFSlickViewer,
  } = usePDFSlick(props.src, {
    scaleValue: 'page-width',
  })

  const [autoPlay, setAutoPlay] = createSignal(true)
  const [position, setPosition] = createSignal(-1)
  const [isSeeking, setIsSeeking] = createSignal(false)
  let timeUpdateCallback: ((time: number) => void) | undefined

  const positionPerPage = () => props.duration / (store.numPages || 1)

  const pageToPosition = (page: number) => {
    return (page - 1) * positionPerPage()
  }

  const positionToPage = (pos: number) => {
    const total = store.numPages || 1
    if (total === 0) return 1
    return Math.max(1, Math.min(Math.ceil(pos / positionPerPage()), total))
  }

  onMount(() => {
    const container = document.querySelector('.pdfSlickContainer')
    if (!container) return

    let scrollTimeout: ReturnType<typeof setTimeout> | undefined

    const handleWheel = () => {
      if (!autoPlay()) return

      setAutoPlay(false)

      if (scrollTimeout) clearTimeout(scrollTimeout)

      scrollTimeout = setTimeout(() => {
        const currentPage = store.pageNumber
        if (currentPage) {
          setPosition(pageToPosition(currentPage))
        }
        setAutoPlay(true)
      }, 150)
    }

    container.addEventListener('wheel', handleWheel, { passive: true })

    onCleanup(() => {
      container.removeEventListener('wheel', handleWheel)
      if (scrollTimeout) clearTimeout(scrollTimeout)
    })
  })

  createEffect(() => {
    if (!isDocumentLoaded() || isSeeking()) return
    const currentPage = store.pageNumber
    if (currentPage) {
      const expectedPage = positionToPage(position())
      if (currentPage !== expectedPage) {
        setPosition(pageToPosition(currentPage))
      }
    }
  })

  createEffect(() => {
    if (!isDocumentLoaded() || !autoPlay()) return
    const interval = setInterval(() => {
      setPosition((prev) => {
        const next = prev + 1
        if (next >= props.duration) {
          setAutoPlay(false)
          return props.duration
        }
        const currentPage = positionToPage(prev)
        const nextPage = positionToPage(next)
        if (currentPage !== nextPage) {
          setIsSeeking(true)
          smoothGotoPage(nextPage)
          setTimeout(() => setIsSeeking(false), 500)
        }
        timeUpdateCallback?.(next)
        return next
      })
    }, 1000)
    onCleanup(() => clearInterval(interval))
  })

  const smoothGotoPage = (page: number) => {
    const container = document.querySelector('.pdfSlickContainer')
    const targetPage = document.querySelector(`.page[data-page-number="${page}"]`)

    if (container && targetPage) {
      const containerRect = container.getBoundingClientRect()
      const targetRect = targetPage.getBoundingClientRect()
      const scrollTop = container.scrollTop + (targetRect.top - containerRect.top)

      container.scrollTo({
        top: scrollTop,
        behavior: 'smooth',
      })
    }
  }

  createEffect(() => {
    timeUpdateCallback?.(position())
  })

  createEffect(() => {
    if (isDocumentLoaded()) {
      const api: MediaPlayerAPI = {
        duration: () => props.duration,
        jumpToTime: (time: number) => {
          const page = positionToPage(time)
          store.pdfSlick?.gotoPage(page)
          setPosition(time - 1)
        },
        onTimeUpdate: (callback: (time: number) => void) => {
          timeUpdateCallback = callback
          queueMicrotask(() => callback(position()))
        },
        play: () => setAutoPlay(true),
        pause: () => setAutoPlay(false),
        isPlaying: () => autoPlay(),
      }
      props.onReady?.(api)
    }
  })

  return (
    <div class="absolute inset-0 bg-slate-200/70 flex flex-col pdfSlick">
      <Toolbar store={store} />
      <div
        class={`flex-1 relative overflow-auto transition-opacity duration-300 ${isDocumentLoaded() ? 'opacity-100' : 'opacity-0'}`}
      >
        <style>
          {`
            .pdfSlickContainer {
              scroll-behavior: auto;
            }
          `}
        </style>
        <PDFSlickViewer {...{ store, viewerRef }} />
      </div>
      <div class="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4 transition-colors bg-base-content/40 hover:bg-base-content/80 p-4 rounded-lg z-50 whitespace-nowrap">
        <label class="swap text-base-100">
          <input type="checkbox" checked={autoPlay()} onClick={() => setAutoPlay((p) => !p)} />
          <IconPlayerPauseFilled size={16} class="swap-on" />
          <IconPlayerPlayFilled size={16} class="swap-off" />
        </label>
        <span class="text-white text-sm font-mono">
          {toHHMMSS(position())} / {toHHMMSS(props.duration)}
        </span>
      </div>
    </div>
  )
}

function Toolbar(props: { store: PDFSlickState }) {
  const { t } = useTranslation()
  const [pageInput, setPageInput] = createSignal('')

  const handlePageSubmit = (e: Event) => {
    e.preventDefault()
    const page = parseInt(pageInput(), 10)
    if (page >= 1 && page <= props.store.numPages) {
      props.store.pdfSlick?.gotoPage(page)
      setPageInput('')
    }
  }

  return (
    <div class="w-full h-8 flex items-center justify-between bg-slate-50 border-b border-b-slate-300 shadow-sm px-4 text-sm select-none">
      <div class="flex items-center gap-3">
        <button
          type="button"
          disabled={props.store.pageNumber <= 1}
          class="btn btn-sm btn-ghost btn-square"
          onClick={() => props.store.pdfSlick?.viewer?.previousPage()}
        >
          <IconChevronLeft size={16} />
        </button>

        <button
          type="button"
          disabled={props.store.pageNumber >= props.store.numPages}
          class="btn btn-sm btn-ghost btn-square"
          onClick={() => props.store.pdfSlick?.viewer?.nextPage()}
        >
          <IconChevronRight size={16} />
        </button>

        <div class="flex items-center gap-2">
          <form onSubmit={handlePageSubmit} class="flex items-center gap-1">
            <input
              type="number"
              min="1"
              max={props.store.numPages}
              placeholder={String(props.store.pageNumber)}
              value={pageInput()}
              onInput={(e) => setPageInput(e.currentTarget.value)}
              class="input input-xs input-bordered w-16 text-center"
            />
          </form>
          <span class="text-sm">/ {props.store.numPages}</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <button
          type="button"
          disabled={props.store.scale <= 0.25}
          class="btn btn-sm btn-ghost btn-square"
          onClick={() => props.store.pdfSlick?.viewer?.decreaseScale()}
        >
          <IconMinus size={16} />
        </button>

        <span class="text-sm min-w-16 text-center">{Math.round(props.store.scale * 100)}%</span>

        <button
          type="button"
          disabled={props.store.scale >= 5}
          class="btn btn-sm btn-ghost btn-square"
          onClick={() => props.store.pdfSlick?.viewer?.increaseScale()}
        >
          <IconPlus size={16} />
        </button>

        <select
          class="select select-xs select-bordered"
          value={props.store.scaleValue || 'auto'}
          onChange={(e) => {
            props.store.pdfSlick!.currentScaleValue = e.currentTarget.value
          }}
        >
          <option value="auto">{t('Auto')}</option>
          <option value="page-actual">{t('Actual size')}</option>
          <option value="page-fit">{t('Fit page')}</option>
          <option value="page-width">{t('Fit width')}</option>
        </select>
      </div>
    </div>
  )
}
