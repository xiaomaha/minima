import { createMemo, createSignal, type JSX, onCleanup } from 'solid-js'
import { createStore, produce, reconcile } from 'solid-js/store'
import * as v from 'valibot'

export type FieldValues = Record<string, FieldValue>

type FieldValue = string | number | boolean | null | string[] | number[]
type FieldErrors = Partial<Record<string, string>>
type FieldTouched = Partial<Record<string, boolean>>

type ValidateFn<T> = (value: T) => string | Promise<string>
type TransformFn<T> = (value: T) => T
type ValidateOn = 'input' | 'blur' | 'submit'

type FieldProps<T = FieldValue> = {
  name: string
  value: T
  error?: string
}

type FormConfig<T extends FieldValues> = {
  initialValues: T
  validate?: (values: T) => Promise<FieldErrors> | FieldErrors
  validateOn?: ValidateOn
  revalidateOn?: ValidateOn
}

export const createForm = <T extends FieldValues>(config: FormConfig<T>) => {
  const validateOn = config.validateOn ?? 'submit'

  const [initialValues, setInitialValues] = createSignal(config.initialValues)
  const [values, setValues] = createStore<T>({ ...initialValues() })
  const [errors, setErrors] = createStore<FieldErrors>({})
  const [touched, setTouched] = createStore<FieldTouched>({})
  const [isSubmitting, setIsSubmitting] = createSignal(false)

  const fieldValidators = new Map<string, ValidateFn<FieldValue>>()
  let hasSubmitted = false

  const dirty = createMemo(() => JSON.stringify(values) !== JSON.stringify(initialValues()))
  const invalid = createMemo(() => Object.values(errors).some(Boolean))

  const validateField = async <K extends keyof T>(name: K, value: T[K], validator?: ValidateFn<T[K]>) => {
    if (!validator) return
    const error = await validator(value)
    setErrors(String(name), error || undefined)
  }

  const validateForm = async () => {
    if (!config.validate) return

    const plainValues = JSON.parse(JSON.stringify(values)) as T
    const result = await config.validate(plainValues)

    Object.entries(result).forEach(([key, error]) => {
      setErrors(key, error as string)
    })
  }

  const handleSubmit = async (onSubmit: (values: T) => void | Promise<void>) => {
    Object.keys(values).forEach((k) => {
      setTouched(k, true)
    })

    await Promise.all(
      Array.from(fieldValidators.entries()).map(([name, validator]) =>
        validateField(name as keyof T, values[name as keyof T], validator as ValidateFn<T[keyof T]>),
      ),
    )

    await validateForm()

    hasSubmitted = true

    if (invalid()) return

    setIsSubmitting(true)
    try {
      await onSubmit(values)
    } finally {
      setIsSubmitting(false)
    }
  }

  const Form = (props: {
    onSubmit: (values: T) => void | Promise<void>
    onChange?: () => void
    children: JSX.Element
  }) => (
    <form
      novalidate
      onSubmit={async (e) => {
        e.preventDefault()
        await handleSubmit(props.onSubmit)
      }}
      onChange={() => props.onChange?.()}
      class="contents"
    >
      {props.children}
    </form>
  )

  const Field = <K extends keyof T>(props: {
    name: K
    validate?: ValidateFn<T[K]>
    transform?: { fn: TransformFn<T[K]>; on: 'blur' | 'input' }
    children: (field: FieldProps<T[K]>, props: Record<string, unknown>) => JSX.Element
  }) => {
    const name = String(props.name)

    if (props.validate) {
      fieldValidators.set(name, props.validate as ValidateFn<FieldValue>)
    }

    onCleanup(() => fieldValidators.delete(name))

    const handleInput = async (e: InputEvent) => {
      const target = e.target as HTMLInputElement
      if (target.type === 'checkbox' || target.type === 'radio') return

      let next = target.value as T[K]

      if (props.transform?.on === 'input') {
        next = props.transform.fn(next)
      }

      setValues(
        produce((draft) => {
          draft[props.name] = next
        }),
      )

      if (config.revalidateOn === 'input' || hasSubmitted || (validateOn === 'input' && touched[name])) {
        setErrors(name, undefined)

        if (props.validate) {
          await validateField(props.name, next, props.validate)
        } else if (config.validate) {
          queueMicrotask(() => validateForm())
        }
      }
    }

    const handleBlur = async () => {
      setTouched(name, true)

      let next = values[props.name]
      if (props.transform?.on === 'blur') {
        next = props.transform.fn(next)
        setValues(
          produce((draft) => {
            draft[props.name] = next
          }),
        )
      }

      if (config.revalidateOn === 'blur' || validateOn === 'blur' || hasSubmitted) {
        setErrors(name, undefined)

        if (props.validate) {
          await validateField(props.name, next, props.validate)
        } else if (config.validate) {
          queueMicrotask(() => validateForm())
        }
      }
    }

    const handleChange = async (e: Event) => {
      const target = e.target as HTMLInputElement

      let next: T[K]
      if (target.type === 'checkbox') {
        next = target.checked as T[K]
      } else if (target.type === 'radio') {
        next = target.value as T[K]
      } else {
        return
      }

      setValues(
        produce((draft) => {
          draft[props.name] = next
        }),
      )

      if (config.revalidateOn === 'input' || hasSubmitted || (validateOn === 'input' && touched[name])) {
        setErrors(name, undefined)

        if (props.validate) {
          await validateField(props.name, next, props.validate)
        } else if (config.validate) {
          queueMicrotask(() => validateForm())
        }
      }
    }

    const inputProps = {
      name,
      value: values[props.name],
      onInput: handleInput,
      onBlur: handleBlur,
      onChange: handleChange,
    }

    return props.children(
      {
        name,
        get value() {
          return values[props.name]
        },
        get error() {
          if (hasSubmitted || touched[name]) {
            return errors[name]
          }
          return undefined
        },
      },
      inputProps,
    )
  }

  const reset = (opts?: { initialValues?: T }) => {
    const next = opts?.initialValues ?? initialValues()
    setInitialValues(() => next)
    setValues(reconcile(next))
    setErrors(reconcile({}))
    setTouched(reconcile({}))
    hasSubmitted = false
  }

  const setValue = <K extends keyof T>(name: K, value: T[K]) => {
    setValues(
      produce((draft) => {
        draft[name] = value
      }),
    )
  }

  const setMultipleValues = (updates: Partial<T>) => {
    setValues(
      produce((draft) => {
        Object.assign(draft, updates)
      }),
    )
  }

  const getValue = <K extends keyof T>(name: K): T[K] => values[name]

  const setError = (name: string, error: string) => setErrors(name, error)

  return [
    {
      values,
      errors,
      touched,
      get dirty() {
        return dirty()
      },
      get invalid() {
        return invalid()
      },
      get submitting() {
        return isSubmitting()
      },
    },
    {
      Form,
      Field,
      reset,
      validate: validateForm,
      setValue,
      getValue,
      setValues: setMultipleValues,
      setError,
    },
  ] as const
}

export const valiForm = <TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(schema: TSchema) => {
  return async (values: v.InferInput<TSchema>): Promise<FieldErrors> => {
    const result = await v.safeParseAsync(schema, values)
    if (result.success) return {}

    const errors: FieldErrors = {}
    if (result.issues) {
      for (const issue of result.issues) {
        const path = issue.path?.map((p) => p.key).join('.') ?? 'root'
        errors[path] = issue.message
      }
    }
    return errors
  }
}

export const toCustom = <T,>(fn: TransformFn<T>, opts: { on: 'blur' | 'input' }) => ({
  fn,
  on: opts.on,
})
