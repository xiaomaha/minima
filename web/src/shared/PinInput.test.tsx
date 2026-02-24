import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { describe, expect, it, vi } from 'vitest'
import { PinInput } from './PinInput'

afterEach(cleanup)

describe('PinInput', () => {
  it('renders correct number of inputs', () => {
    const { container } = render(() => <PinInput length={6} value="" onChange={() => {}} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBe(6)
  })

  it('renders 4 inputs for length=4', () => {
    const { container } = render(() => <PinInput length={4} value="" onChange={() => {}} />)
    const inputs = container.querySelectorAll('input')
    expect(inputs.length).toBe(4)
  })

  it('only allows numeric input', () => {
    const onChange = vi.fn()
    const { container } = render(() => <PinInput length={4} value="" onChange={onChange} />)
    const input = container.querySelectorAll('input')[0]!

    // Simulate typing a letter - the component strips non-digits
    fireEvent.input(input, { target: { value: 'a' } })
    // onChange should be called with empty (digit stripped)
    expect(onChange).toHaveBeenCalledWith('')
  })

  it('calls onComplete when all digits entered', () => {
    const onComplete = vi.fn()
    const onChange = vi.fn()
    const { container } = render(() => <PinInput length={4} value="123" onChange={onChange} onComplete={onComplete} />)
    const inputs = container.querySelectorAll('input')

    // Type the 4th digit
    fireEvent.input(inputs[3]!, { target: { value: '4' } })
    expect(onComplete).toHaveBeenCalled()
  })

  it('disables all inputs when disabled', () => {
    const { container } = render(() => <PinInput length={4} value="" onChange={() => {}} disabled={true} />)
    const inputs = container.querySelectorAll('input')
    for (const input of inputs) {
      expect(input.disabled).toBe(true)
    }
  })
})
