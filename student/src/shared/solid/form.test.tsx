import { cleanup, fireEvent, render } from '@solidjs/testing-library'
import { createRoot } from 'solid-js'
import * as v from 'valibot'
import { describe, expect, it, vi } from 'vitest'
import { createForm, valiForm } from './form'

afterEach(cleanup)

describe('createForm', () => {
  it('initializes with provided values', () => {
    createRoot((dispose) => {
      const [state] = createForm({
        initialValues: { name: 'John', age: 25 },
      })
      expect(state.values.name).toBe('John')
      expect(state.values.age).toBe(25)
      dispose()
    })
  })

  it('tracks dirty state', () => {
    createRoot((dispose) => {
      const [state, { setValue }] = createForm({
        initialValues: { name: 'John' },
      })
      expect(state.dirty).toBe(false)
      setValue('name', 'Jane')
      expect(state.dirty).toBe(true)
      dispose()
    })
  })

  it('setValue and getValue work', () => {
    createRoot((dispose) => {
      const [, { setValue, getValue }] = createForm({
        initialValues: { name: 'John' },
      })
      setValue('name', 'Jane')
      expect(getValue('name')).toBe('Jane')
      dispose()
    })
  })

  it('reset clears values, errors, and touched', () => {
    createRoot((dispose) => {
      const [state, { setValue, setError, reset }] = createForm({
        initialValues: { name: 'John' },
      })
      setValue('name', 'Jane')
      setError('name', 'Required')
      reset()
      expect(state.values.name).toBe('John')
      expect(state.errors.name).toBeUndefined()
      dispose()
    })
  })

  it('reset with new initialValues', () => {
    createRoot((dispose) => {
      const [state, { reset }] = createForm({
        initialValues: { name: 'John' },
      })
      reset({ initialValues: { name: 'Bob' } })
      expect(state.values.name).toBe('Bob')
      expect(state.dirty).toBe(false)
      dispose()
    })
  })

  it('setError sets field error', () => {
    createRoot((dispose) => {
      const [state, { setError }] = createForm({
        initialValues: { name: '' },
      })
      setError('name', 'Required')
      expect(state.errors.name).toBe('Required')
      dispose()
    })
  })

  it('form-level validate produces errors', async () => {
    await createRoot(async (dispose) => {
      const [state, { validate }] = createForm({
        initialValues: { name: '' },
        validate: (values) => {
          const errors: Record<string, string> = {}
          if (!values.name) errors.name = 'Required'
          return errors
        },
      })
      await validate()
      expect(state.errors.name).toBe('Required')
      dispose()
    })
  })

  it('handleSubmit calls onSubmit when valid', async () => {
    const onSubmit = vi.fn()

    const { findByText } = render(() => {
      const [, { Form }] = createForm({
        initialValues: { name: 'John' },
      })
      return (
        <Form onSubmit={onSubmit}>
          <button type="submit">Submit</button>
        </Form>
      )
    })

    const button = await findByText('Submit')
    fireEvent.click(button)

    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: 'John' }))
    })
  })

  it('handleSubmit does not call onSubmit when invalid', async () => {
    const onSubmit = vi.fn()

    const { findByText } = render(() => {
      const [, { Form }] = createForm({
        initialValues: { name: '' },
        validate: (values) => {
          if (!values.name) return { name: 'Required' }
          return {}
        },
      })
      return (
        <Form onSubmit={onSubmit}>
          <button type="submit">Submit</button>
        </Form>
      )
    })

    const button = await findByText('Submit')
    fireEvent.click(button)

    await new Promise((r) => setTimeout(r, 50))
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('isSubmitting is true during submission', async () => {
    const submittingValues: boolean[] = []
    let resolveSubmit: () => void

    const submitPromise = new Promise<void>((resolve) => {
      resolveSubmit = resolve
    })

    const { findByText } = render(() => {
      const [state, { Form }] = createForm({
        initialValues: { name: 'John' },
      })

      return (
        <Form
          onSubmit={async () => {
            submittingValues.push(state.submitting)
            await submitPromise
          }}
        >
          <button type="submit">Submit</button>
        </Form>
      )
    })

    const button = await findByText('Submit')
    fireEvent.click(button)

    await vi.waitFor(() => {
      expect(submittingValues).toContain(true)
    })

    resolveSubmit!()
  })
})

describe('valiForm', () => {
  it('returns empty errors for valid data', async () => {
    const schema = v.object({
      name: v.pipe(v.string(), v.minLength(1, 'Required')),
    })
    const validate = valiForm(schema)
    const errors = await validate({ name: 'John' })
    expect(errors).toEqual({})
  })

  it('returns field errors for invalid data', async () => {
    const schema = v.object({
      name: v.pipe(v.string(), v.minLength(1, 'Required')),
    })
    const validate = valiForm(schema)
    const errors = await validate({ name: '' })
    expect(errors.name).toBe('Required')
  })
})
