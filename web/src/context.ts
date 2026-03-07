interface AccessContextSchema {
  course?: string
  mode?: string
}

export const accessContextParam = () => {
  const search = new URLSearchParams(window.location.search)
  const context: AccessContextSchema = {}

  if (search.has('course')) {
    context.course = search.get('course')!
  }

  if (search.has('mode')) {
    context.mode = search.get('mode')!
  }

  return context as Record<string, string>
}

export const accessContext = () => {
  return new URLSearchParams(accessContextParam()).toString()
}
