import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { DailyProgress, DailySettings, Rating, ReviewStore, VocabularyCard } from '../types'
import { newRecord, schedule } from '../lib/scheduler'
import { getStudyState, saveDaily, saveReview, saveSettings } from '../lib/api'

const STORE_KEY = 'tango-anki-review-v1'
const DAILY_KEY = 'tango-anki-daily-v1'
const SETTINGS_KEY = 'tango-anki-settings-v1'

const parseStored = <T,>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback
  try {
    let value: unknown = JSON.parse(raw)
    if (typeof value === 'string') value = JSON.parse(value)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as T : fallback
  } catch {
    return fallback
  }
}

const storageFingerprint = () => [STORE_KEY, DAILY_KEY, SETTINGS_KEY]
  .map((key) => localStorage.getItem(key) ?? '')
  .join('\u0000')

const todayKey = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const loadStore = (): ReviewStore => {
  const raw = localStorage.getItem(STORE_KEY)
  if (!raw) return {}

  try {
    let value: unknown = JSON.parse(raw)
    if (typeof value === 'string') value = JSON.parse(value)
    return value && typeof value === 'object' && !Array.isArray(value) ? value as ReviewStore : {}
  } catch {
    const recovered: ReviewStore = {}
    const entries = raw.matchAll(/"([^"\\]+)":(\{[^{}]*\})/g)
    for (const match of entries) {
      try {
        const record = JSON.parse(match[2]) as ReviewStore[string]
        if (record && typeof record.due === 'number' && typeof record.state === 'string') {
          recovered[match[1]] = record
        }
      } catch {
        // Skip the final partial record in a truncated localStorage value.
      }
    }
    if (Object.keys(recovered).length) {
      localStorage.setItem(`${STORE_KEY}-corrupt-backup`, raw)
      localStorage.setItem(STORE_KEY, JSON.stringify(recovered))
    }
    return recovered
  }
}

const loadSettings = (): DailySettings => {
  const value = parseStored<Partial<DailySettings> & { newLimit?: number }>(
    localStorage.getItem(SETTINGS_KEY),
    {},
  )
  return {
    newPerDay: Math.max(0, value.newPerDay ?? value.newLimit ?? 20),
  }
}

const loadDaily = (): DailyProgress => {
  const empty: DailyProgress = { date: todayKey(), newCompleted: 0, reviewCompleted: 0, completedIds: [] }
  const value = parseStored<Partial<DailyProgress>>(localStorage.getItem(DAILY_KEY), {})
  return value.date === empty.date
    ? {
        ...empty,
        newCompleted: value.newCompleted ?? 0,
        reviewCompleted: value.reviewCompleted ?? 0,
        completedIds: value.completedIds ?? [],
      }
    : empty
}

const shuffle = <T,>(items: T[]) => {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function useStudySession(cards: VocabularyCard[]) {
  const [store, setStore] = useState<ReviewStore>(loadStore)
  const [settings, setSettings] = useState<DailySettings>(loadSettings)
  const [daily, setDaily] = useState<DailyProgress>(loadDaily)

  const createSession = useCallback((reviewData: ReviewStore, progress: DailyProgress, limits: DailySettings) => {
    const now = Date.now()
    const newRemaining = Math.max(0, limits.newPerDay - progress.newCompleted)
    const completedToday = new Set(progress.completedIds)
    const newCards = shuffle(cards.filter((card) => !reviewData[card.id] && !completedToday.has(card.id))).slice(0, newRemaining)
    const reviews = shuffle(cards.filter((card) => reviewData[card.id] && reviewData[card.id].due <= now))
    return shuffle([...reviews, ...newCards]).map((card) => card.id)
  }, [cards])

  const [sessionIds, setSessionIds] = useState(() => {
    const reviewData = loadStore()
    return createSession(reviewData, loadDaily(), loadSettings())
  })
  const [index, setIndex] = useState(0)
  const fingerprintRef = useRef(storageFingerprint())
  const statePromiseRef = useRef<ReturnType<typeof getStudyState> | null>(null)

  useEffect(() => {
    statePromiseRef.current ??= getStudyState()
    let cancelled = false

    void statePromiseRef.current.then((remote) => {
      if (cancelled) return
      const remoteDaily = remote.daily ?? daily
      localStorage.setItem(STORE_KEY, JSON.stringify(remote.reviews))
      localStorage.setItem(DAILY_KEY, JSON.stringify(remoteDaily))
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(remote.settings))
      setStore(remote.reviews)
      setDaily(remoteDaily)
      setSettings(remote.settings)
      setSessionIds(createSession(remote.reviews, remoteDaily, remote.settings))
      setIndex(0)
    }).catch(() => {
      // The local cache remains usable while the API is offline.
    })

    return () => { cancelled = true }
  }, [createSession])

  const syncFromStorage = useCallback(() => {
    const fingerprint = storageFingerprint()
    if (fingerprint === fingerprintRef.current) return
    const reviewData = loadStore()
    const progress = loadDaily()
    const limits = loadSettings()
    fingerprintRef.current = fingerprint
    setStore(reviewData)
    setDaily(progress)
    setSettings(limits)
    setSessionIds(createSession(reviewData, progress, limits))
    setIndex(0)
  }, [createSession])

  useEffect(() => {
    window.addEventListener('storage', syncFromStorage)
    window.addEventListener('focus', syncFromStorage)
    return () => {
      window.removeEventListener('storage', syncFromStorage)
      window.removeEventListener('focus', syncFromStorage)
    }
  }, [syncFromStorage])

  useEffect(() => {
    fingerprintRef.current = storageFingerprint()
  }, [daily, settings, store])

  const cardMap = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards])
  const current = cardMap.get(sessionIds[index])
  const record = current ? store[current.id] ?? newRecord() : newRecord()

  const rate = useCallback((rating: Rating) => {
    if (!current) return
    const isNew = !store[current.id]
    setStore((previous) => {
      const updated = { ...previous, [current.id]: schedule(previous[current.id] ?? newRecord(), rating) }
      localStorage.setItem(STORE_KEY, JSON.stringify(updated))
      void saveReview(current.id, updated[current.id]).catch(() => undefined)
      return updated
    })
    setDaily((previous) => {
      const base = previous.date === todayKey() ? previous : loadDaily()
      if (base.completedIds.includes(current.id)) return base
      const updated = {
        ...base,
        newCompleted: base.newCompleted + (isNew ? 1 : 0),
        reviewCompleted: base.reviewCompleted + (isNew ? 0 : 1),
        completedIds: [...base.completedIds, current.id],
      }
      localStorage.setItem(DAILY_KEY, JSON.stringify(updated))
      void saveDaily(updated).catch(() => undefined)
      return updated
    })
    if (rating === 'again' || rating === 'hard') {
      const distance = rating === 'again' ? 3 : 10
      setSessionIds((previous) => {
        const updated = [...previous]
        updated.splice(Math.min(updated.length, index + distance + 1), 0, current.id)
        return updated
      })
    }
    setIndex((value) => value + 1)
  }, [current, index, store])

  const updateLimits = useCallback((limits: DailySettings) => {
    const normalized = {
      newPerDay: Math.max(0, Math.min(999, limits.newPerDay)),
    }
    setSettings(normalized)
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized))
    void saveSettings(normalized).catch(() => undefined)
    setSessionIds(createSession(store, daily, normalized))
    setIndex(0)
  }, [createSession, daily, store])

  const stats = useMemo(() => {
    const now = Date.now()
    let learning = 0
    let review = 0
    let mastered = 0
    const completedToday = new Set(daily.completedIds)
    cards.forEach((card) => {
      const item = store[card.id]
      if (!item) return
      if (item.state === 'learning' || item.state === 'relearning') learning += 1
      if (item.state === 'review' && item.due <= now) review += 1
      if (item.state === 'review' && item.interval >= 21) mastered += 1
    })
    const newCount = cards.filter((card) => !store[card.id] && !completedToday.has(card.id)).length
    return { newCount, learning, review, mastered }
  }, [cards, daily.completedIds, store])

  const todayTotal = daily.newCompleted + daily.reviewCompleted

  return {
    current, record, rate, stats,
    daily, settings, todayTotal, updateLimits,
  }
}
