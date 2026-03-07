import { createEffect, For, on, onMount } from 'solid-js'

export const PinInput = (props: {
  length: number
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  disabled?: boolean
}) => {
  const inputRefs: HTMLInputElement[] = []

  onMount(() => {
    queueMicrotask(() => inputRefs[0]?.focus())
  })

  createEffect(
    on(
      () => props.value,
      (value, prevValue) => {
        if (value === '' && prevValue !== undefined) {
          queueMicrotask(() => inputRefs[0]?.focus())
        }
      },
    ),
  )

  createEffect(
    on(
      () => props.disabled,
      (disabled, prevDisabled) => {
        if (prevDisabled && !disabled) {
          queueMicrotask(() => inputRefs[0]?.focus())
        }
      },
    ),
  )

  const handleInput = (index: number, e: InputEvent) => {
    const target = e.target as HTMLInputElement
    const digit = target.value.replace(/[^0-9]/g, '').slice(0, 1)

    const values = props.value.split('')
    values[index] = digit
    const newValue = values.join('').slice(0, props.length)

    props.onChange(newValue)

    if (digit && index < props.length - 1) {
      inputRefs[index + 1]?.focus()
    }

    if (newValue.length === props.length) {
      props.onComplete?.(newValue)
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent) => {
    if (e.key === 'Backspace' && !props.value[index] && index > 0) {
      inputRefs[index - 1]?.focus()
    }
  }

  const handlePaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const paste = e.clipboardData
      ?.getData('text')
      .replace(/[^0-9]/g, '')
      .slice(0, props.length)

    if (paste) {
      props.onChange(paste)
      inputRefs[Math.min(paste.length, props.length - 1)]?.focus()

      if (paste.length === props.length) {
        props.onComplete?.(paste)
      }
    }
  }

  return (
    <div class="flex gap-2 justify-center">
      <For each={Array.from({ length: props.length }, (_, i) => i)}>
        {(index) => (
          <input
            ref={(el) => {
              inputRefs[index] = el
            }}
            type="text"
            inputmode="numeric"
            maxlength={1}
            value={props.value[index] ?? ''}
            class="input input-bordered w-12 h-12 text-center text-lg placeholder:text-gray-300 focus:placeholder:opacity-0"
            disabled={props.disabled}
            onInput={(e) => handleInput(index, e)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            onPaste={handlePaste}
            placeholder="○"
          />
        )}
      </For>
    </div>
  )
}
