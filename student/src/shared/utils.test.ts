import { describe, expect, it } from 'vitest'
import {
  capitalize,
  decodeURLText,
  filenameFromUrl,
  formatFileSize,
  isImage,
  safeLocaleString,
  timeToSeconds,
  toHHMMSS,
  toYYYYMMDD,
  uniqueFilename,
} from './utils'

describe('timeToSeconds', () => {
  it('converts HH:MM:SS to seconds', () => {
    expect(timeToSeconds('01:30:00')).toBe(5400)
  })

  it('converts MM:SS to seconds', () => {
    expect(timeToSeconds('00:05:30')).toBe(330)
  })

  it('handles zero', () => {
    expect(timeToSeconds('00:00:00')).toBe(0)
  })

  it('handles single segment as hours', () => {
    // single value maps to hh position: 45 * 3600
    expect(timeToSeconds('45')).toBe(162000)
  })
})

describe('toHHMMSS', () => {
  it('returns 00:00 for zero', () => {
    expect(toHHMMSS(0)).toBe('00:00')
  })

  it('formats minutes and seconds', () => {
    expect(toHHMMSS(90)).toBe('01:30')
  })

  it('formats hours, minutes, seconds', () => {
    expect(toHHMMSS(3661)).toBe('01:01:01')
  })

  it('returns 00:00 for negative', () => {
    expect(toHHMMSS(-1)).toBe('00:00')
  })

  it('returns 00:00 for NaN', () => {
    expect(toHHMMSS(NaN)).toBe('00:00')
  })

  it('includes days when applicable', () => {
    expect(toHHMMSS(90061)).toBe('1d 01:01:01')
  })
})

describe('capitalize', () => {
  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('handles empty string', () => {
    expect(capitalize('')).toBe('')
  })

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A')
  })
})

describe('toYYYYMMDD', () => {
  it('formats date correctly', () => {
    const date = new Date(2024, 0, 5) // Jan 5, 2024
    expect(toYYYYMMDD(date)).toBe('2024-01-05')
  })

  it('pads single-digit month and day', () => {
    const date = new Date(2024, 11, 25) // Dec 25, 2024
    expect(toYYYYMMDD(date)).toBe('2024-12-25')
  })
})

describe('safeLocaleString', () => {
  it('converts valid date string', () => {
    const result = safeLocaleString('2024-01-05T12:00:00Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns empty string for null', () => {
    expect(safeLocaleString(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(safeLocaleString(undefined)).toBe('')
  })

  it('returns empty string for empty string', () => {
    expect(safeLocaleString('')).toBe('')
  })
})

describe('filenameFromUrl', () => {
  it('extracts filename from URL', () => {
    expect(filenameFromUrl('https://example.com/path/to/file.pdf')).toBe('file.pdf')
  })

  it('strips query string', () => {
    expect(filenameFromUrl('https://example.com/file.pdf?v=1')).toBe('file.pdf')
  })
})

describe('isImage', () => {
  it('returns true for image extensions', () => {
    expect(isImage('photo.jpg')).toBe(true)
    expect(isImage('photo.jpeg')).toBe(true)
    expect(isImage('photo.png')).toBe(true)
    expect(isImage('photo.gif')).toBe(true)
    expect(isImage('photo.webp')).toBe(true)
    expect(isImage('photo.svg')).toBe(true)
  })

  it('returns false for non-image extensions', () => {
    expect(isImage('doc.pdf')).toBe(false)
    expect(isImage('file.txt')).toBe(false)
  })

  it('handles query strings', () => {
    expect(isImage('photo.png?w=100')).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(isImage('photo.JPG')).toBe(true)
  })
})

describe('uniqueFilename', () => {
  it('preserves original extension', () => {
    const result = uniqueFilename('test.pdf')
    expect(result).toMatch(/^test\.\w+\.pdf$/)
  })

  it('includes random string', () => {
    const a = uniqueFilename('test.pdf')
    const b = uniqueFilename('test.pdf')
    // Very unlikely to collide
    expect(a).not.toBe(b)
  })

  it('handles files without extension', () => {
    const result = uniqueFilename('README')
    expect(result).toMatch(/^README\.\w+$/)
  })
})

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500.00 B')
  })

  it('formats KB', () => {
    expect(formatFileSize(1024)).toBe('1.00 KB')
  })

  it('formats MB', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1.00 MB')
  })

  it('formats GB', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1.00 GB')
  })
})

describe('decodeURLText', () => {
  it('returns empty string for null', () => {
    expect(decodeURLText(null)).toBe('')
  })

  it('returns empty string for undefined', () => {
    expect(decodeURLText(undefined)).toBe('')
  })

  it('converts URL to link', () => {
    const result = decodeURLText('Visit https://example.com for more')
    expect(result).toContain('<a href="https://example.com"')
    expect(result).toContain('target="_blank"')
  })

  it('handles www. prefix', () => {
    const result = decodeURLText('Visit www.example.com for more')
    expect(result).toContain('href="https://www.example.com"')
  })

  it('preserves HTML tags', () => {
    const result = decodeURLText('<p>Hello</p>')
    expect(result).toContain('<p>Hello</p>')
  })

  it('returns plain text unchanged', () => {
    expect(decodeURLText('Hello world')).toBe('Hello world')
  })
})
