import type { Rating, ReviewRecord } from '../types'

const DAY = 86_400_000

export const newRecord = (): ReviewRecord => ({
  state: 'new',
  due: 0,
  interval: 0,
  ease: 2.5,
  reps: 0,
  lapses: 0,
  step: 0,
})

export function schedule(current: ReviewRecord, rating: Rating, now = Date.now()): ReviewRecord {
  const next = { ...current, reps: current.reps + 1, lastReviewed: now }

  if (rating === 'again') {
    return {
      ...next,
      state: current.state === 'new' || current.state === 'learning' ? 'learning' : 'relearning',
      step: 0,
      lapses: current.state === 'review' ? current.lapses + 1 : current.lapses,
      due: now,
    }
  }

  if (rating === 'hard') {
    return {
      ...next,
      state: current.state === 'new' || current.state === 'learning' ? 'learning' : 'relearning',
      step: 1,
      due: now,
    }
  }

  const interval = rating === 'easy' ? 3 : 1
  return { ...next, state: 'review', step: 0, interval, due: now + interval * DAY }
}

export const nextLabel = (_record: ReviewRecord, rating: Rating) => {
  if (rating === 'again') return '3 个词后'
  if (rating === 'hard') return '10 个词后'
  return rating === 'easy' ? '3 天后' : '1 天后'
}
