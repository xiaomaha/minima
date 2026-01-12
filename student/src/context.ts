interface AccessContextSchema {
  course?: string
}

export const accessContextParam = () => {
  const params = new URLSearchParams(window.location.search)
  const context: AccessContextSchema = {}

  if (params.has('course')) {
    context.course = params.get('course')!
  } else {
    return {}
  }

  return context as Record<string, string>
}

export const accessContext = () => {
  return new URLSearchParams(accessContextParam()).toString()
}
