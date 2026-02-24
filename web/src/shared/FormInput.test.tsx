import { cleanup, render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { FormInput } from './FormInput'

afterEach(cleanup)

describe('FormInput', () => {
  it('renders children', () => {
    const { getByPlaceholderText } = render(() => (
      <FormInput>
        <input placeholder="Name" />
      </FormInput>
    ))
    expect(getByPlaceholderText('Name')).toBeTruthy()
  })

  it('displays error message', () => {
    const { container } = render(() => (
      <FormInput error="Required">
        <input />
      </FormInput>
    ))
    const errorEl = container.querySelector('.text-error')
    expect(errorEl).toBeTruthy()
    expect(errorEl?.textContent).toBe('Required')
  })

  it('displays help text', () => {
    const { container } = render(() => (
      <FormInput help="Enter your name">
        <input />
      </FormInput>
    ))
    const helpEl = container.querySelector('.label')
    expect(helpEl).toBeTruthy()
    expect(helpEl?.textContent).toBe('Enter your name')
  })

  it('shows error over help when both provided', () => {
    const { container } = render(() => (
      <FormInput error="Required" help="Enter your name">
        <input />
      </FormInput>
    ))
    const errorEl = container.querySelector('.text-error')
    expect(errorEl).toBeTruthy()
    expect(errorEl?.textContent).toBe('Required')

    const helpEl = container.querySelector('.label')
    expect(helpEl).toBeFalsy()
  })
})
