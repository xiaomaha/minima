/**
 * force download
 */
export const forceDownload = (content: string, type: string, filename: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * generate fingerprint
 */
export const generateFingerprint = async () => {
  const isWebGLSupported = () => {
    try {
      const canvas = document.createElement('canvas')
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
      return !!gl
    } catch {
      return false
    }
  }

  const getCanvasFingerprint = () => {
    try {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) return ''
      canvas.width = 200
      canvas.height = 50
      ctx.textBaseline = 'top'
      ctx.font = '14px Arial'
      ctx.fillStyle = '#f60'
      ctx.fillRect(125, 1, 62, 20)
      ctx.fillStyle = '#069'
      ctx.fillText('Canvas fingerprint', 2, 15)
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)'
      ctx.fillText('Device test', 4, 35)
      return canvas.toDataURL().substring(0, 100)
    } catch {
      return ''
    }
  }

  const data = {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages?.join(',') ?? '',
    cookieEnabled: navigator.cookieEnabled,
    doNotTrack: navigator.doNotTrack || 'unspecified',
    hardwareConcurrency: navigator.hardwareConcurrency,
    maxTouchPoints: navigator.maxTouchPoints,
    screenWidth: screen.width,
    screenHeight: screen.height,
    screenColorDepth: screen.colorDepth,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: new Date().getTimezoneOffset(),
    webglSupported: isWebGLSupported(),
    canvasFingerprint: getCanvasFingerprint(),
    hasServiceWorker: 'serviceWorker' in navigator,
    hasWebRTC: 'RTCPeerConnection' in window,
    hasIndexedDB: 'indexedDB' in window,
    hasLocalStorage: 'localStorage' in window,
    hasSessionStorage: 'sessionStorage' in window,
  }

  const fingerprintString = Object.values(data).join('|')
  const encoder = new TextEncoder()
  const encodedData = encoder.encode(fingerprintString)
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * time string to seconds
 */
export const timeToSeconds = (time: string): number => {
  const [hh, mm, ss] = time.split(':').map(Number)
  return (hh ?? 0) * 3600 + (mm ?? 0) * 60 + (ss ?? 0)
}

/**
 * seconds to HH:MM:SS
 */
export const toHHMMSS = (time: number): string => {
  if (time === null || time === undefined || Number.isNaN(time) || time < 0) {
    return '00:00'
  }

  const days = Math.floor(time / 86400)
  const hours = Math.floor((time % 86400) / 3600)
  const minutes = Math.floor((time % 3600) / 60)
  const seconds = Math.floor(time % 60)

  const mm = minutes.toString().padStart(2, '0')
  const ss = seconds.toString().padStart(2, '0')

  if (days > 0) {
    const hh = hours.toString().padStart(2, '0')
    return `${days}d ${hh}:${mm}:${ss}`
  } else if (hours > 0) {
    const hh = hours.toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  } else {
    return `${mm}:${ss}`
  }
}

/**
 * capitalize first letter of string
 */
export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

/**
 * conver date to YYYY-MM-DD
 */
export const toYYYYMMDD = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * safe locale string
 */
export const safeLocaleString = (date: string | undefined | null) => {
  if (!date) return ''
  try {
    return new Date(date).toLocaleString()
  } catch {}
}

/**
 * extract filename from url
 */
export const filenameFromUrl = (url: string): string => {
  const urlObj = new URL(url)
  const pathname = urlObj.pathname
  const filename = pathname.split('/').pop()?.split('?')[0]
  if (!filename) throw new Error('Invalid filename')
  return filename
}

/**
 * check if file is image
 */
export const isImage = (filename: string): boolean => {
  const cleanFilename = filename.split('?')[0]
  const ext = cleanFilename?.split('.').pop()?.toLowerCase()
  return ext ? ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext) : false
}

/**
 * generate unique filename
 */
export const uniqueFilename = (filename: string): string => {
  const lastDotIndex = filename.lastIndexOf('.')
  const name = lastDotIndex > 0 ? filename.slice(0, lastDotIndex) : filename
  const ext = lastDotIndex > 0 ? filename.slice(lastDotIndex) : ''
  const randomStr = Math.random().toString(36).slice(2, 6)
  return `${name}.${randomStr}${ext}`
}

/**
 * extract inner text from html
 */
export const extractText = (html: string): string => {
  const withSpaces = html.replace(/<[^>]+>/g, ' ')
  const div = document.createElement('div')
  div.innerHTML = withSpaces
  const text = div.textContent ?? div.innerText ?? ''
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * format file size
 */

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / k ** i).toFixed(2)} ${sizes[i]}`
}

/**
 * decode url text
 */
export const decodeURLText = (text: string | null | undefined): string => {
  if (!text) return ''

  const decodeIfValid = (str: string) => {
    try {
      return decodeURIComponent(str)
    } catch {
      return str
    }
  }

  const convertUrlToLink = (url: string) => {
    const decodedUrl = decodeIfValid(url)
    const fullUrl = decodedUrl.startsWith('www.') ? `https://${decodedUrl}` : decodedUrl
    return `<a href="${fullUrl}" target="_blank" rel="noopener noreferrer" class="link text-blue-700">${decodedUrl}</a>`
  }

  const urlRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/g
  const tagRegex = /<[^>]+>/g

  const tags: Array<{ index: number; content: string }> = []
  const matches = text.matchAll(tagRegex)

  for (const match of matches) {
    tags.push({ index: match.index!, content: match[0] })
  }

  let result = ''
  let lastIndex = 0

  tags.forEach(({ index, content }) => {
    const textBeforeTag = text.slice(lastIndex, index)
    result += textBeforeTag.replace(urlRegex, convertUrlToLink)
    result += content
    lastIndex = index + content.length
  })

  const remainingText = text.slice(lastIndex)
  result += remainingText.replace(urlRegex, convertUrlToLink)

  return result
}

/**
 * get device name
 */
export const getDeviceName = (): string => {
  const ua = navigator.userAgent

  let browser = 'Unknown Browser'
  let os = 'Unknown OS'

  if (ua.includes('Chrome')) browser = 'Chrome'
  else if (ua.includes('Safari')) browser = 'Safari'
  else if (ua.includes('Firefox')) browser = 'Firefox'
  else if (ua.includes('Edge')) browser = 'Edge'

  if (ua.includes('Windows')) os = 'Windows'
  else if (ua.includes('Mac')) os = 'Mac OS'
  else if (ua.includes('Linux')) os = 'Linux'
  else if (ua.includes('Android')) os = 'Android'
  else if (ua.includes('iOS')) os = 'iOS'

  return `${browser} on ${os}`.substring(0, 100)
}
