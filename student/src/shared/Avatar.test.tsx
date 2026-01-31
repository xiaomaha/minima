import { cleanup, render } from '@solidjs/testing-library'
import { describe, expect, it } from 'vitest'
import { Avatar } from './Avatar'

afterEach(cleanup)

describe('Avatar', () => {
  it('shows first letter of name when no avatar', () => {
    const { container } = render(() => <Avatar user={{ avatar: null, name: 'John' }} />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('J')
  })

  it('renders img when avatar is provided', () => {
    const { container } = render(() => <Avatar user={{ avatar: 'https://example.com/avatar.png', name: 'John' }} />)
    const img = container.querySelector('img')
    expect(img).toBeTruthy()
    expect(img?.getAttribute('src')).toBe('https://example.com/avatar.png')
    expect(img?.getAttribute('alt')).toBe('John')
  })

  it('applies size class', () => {
    const { container } = render(() => <Avatar user={{ avatar: null, name: 'John' }} size="lg" />)
    const inner = container.querySelector('.w-14')
    expect(inner).toBeTruthy()
  })

  it('uses nickname when provided', () => {
    const { container } = render(() => <Avatar user={{ avatar: null, name: 'John', nickname: 'JD' }} />)
    const span = container.querySelector('span')
    expect(span?.textContent).toBe('J')

    // img alt should use nickname
    const { container: c2 } = render(() => (
      <Avatar user={{ avatar: 'https://example.com/a.png', name: 'John', nickname: 'JD' }} />
    ))
    const img = c2.querySelector('img')
    expect(img?.getAttribute('alt')).toBe('JD')
  })
})
