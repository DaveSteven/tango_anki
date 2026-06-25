export type VocabularyCard = {
  id: string
  word: string
  reading: string
  partOfSpeech: string
  level: 'N2'
  meaning: string
  example: string
  relatedWords: string[]
  lesson: number
}

export type Rating = 'again' | 'hard' | 'good' | 'easy'
export type CardState = 'new' | 'learning' | 'review' | 'relearning'

export type ReviewRecord = {
  state: CardState
  due: number
  interval: number
  ease: number
  reps: number
  lapses: number
  step: number
  lastReviewed?: number
}

export type ReviewStore = Record<string, ReviewRecord>

export type DailySettings = {
  newPerDay: number
}

export type DailyProgress = {
  date: string
  newCompleted: number
  reviewCompleted: number
  completedIds: string[]
}
