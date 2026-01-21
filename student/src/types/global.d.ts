export {}

declare global {
  interface Error {
    status?: number
  }
}

declare module '@tanstack/solid-router' {
  interface HistoryState {
    email?: string
  }
}

declare module 'solid-js' {
  namespace JSX {
    interface IntrinsicElements {
      'cropper-canvas': HTMLAttributes<HTMLElement> & {
        background?: boolean
      }
      'cropper-image': HTMLAttributes<HTMLElement> & {
        src?: string
        alt?: string
      }
      'cropper-shade': HTMLAttributes<HTMLElement> & {
        hidden?: boolean
      }
      'cropper-handle': HTMLAttributes<HTMLElement> & {
        action?: string
        plain?: boolean
        'theme-color'?: string
      }
      'cropper-selection': HTMLAttributes<HTMLElement> & {
        ref?: HTMLElement | ((el: HTMLElement) => void)
        'initial-coverage'?: string
        'aspect-ratio'?: string
        movable?: boolean
        resizable?: boolean
      }
      'cropper-grid': HTMLAttributes<HTMLElement> & {
        role?: string
        bordered?: boolean
        covered?: boolean
      }
      'cropper-crosshair': HTMLAttributes<HTMLElement> & {
        centered?: boolean
      }
    }
  }
}
