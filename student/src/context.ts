interface AccessContextSchema {
  course?: string
}

export const accessContextParam = () => {
  const search = new URLSearchParams(window.location.search)
  const context: AccessContextSchema = {}

  if (search.has('course')) {
    context.course = search.get('course')!
  } else {
    return {}
  }

  return context as Record<string, string>
}

export const accessContext = () => {
  return new URLSearchParams(accessContextParam()).toString()
}
