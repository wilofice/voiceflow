export const SUPPORTED_AUDIO_FORMATS = ['mp3', 'wav', 'm4a', 'ogg', 'opus', 'mov', 'mp4'] as const

export const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024 // 2GB

export const LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
} as const

export const SUBSCRIPTION_LIMITS = {
  FREE: {
    maxMinutesPerMonth: 60,
    maxFileSize: 100 * 1024 * 1024, // 100MB
    maxConcurrentTranscriptions: 1,
  },
  PRO: {
    maxMinutesPerMonth: 600,
    maxFileSize: 500 * 1024 * 1024, // 500MB
    maxConcurrentTranscriptions: 5,
  },
  ENTERPRISE: {
    maxMinutesPerMonth: Infinity,
    maxFileSize: MAX_FILE_SIZE,
    maxConcurrentTranscriptions: 20,
  },
} as const