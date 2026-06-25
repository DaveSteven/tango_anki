import type { DailyProgress, DailySettings, ReviewRecord, ReviewStore } from '../types'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const DEVICE_KEY = 'tango-anki-device-id-v1'
const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'david-local'

export type RemoteStudyState = {
  reviews: ReviewStore
  daily: DailyProgress | null
  settings: DailySettings
}

const getDeviceId = () => {
  localStorage.setItem(DEVICE_KEY, DEVICE_ID)
  return DEVICE_ID
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response
}

export async function migrateLocalState(
  reviews: ReviewStore,
  daily: DailyProgress,
  settings: DailySettings,
): Promise<RemoteStudyState> {
  const response = await request(`/api/v1/study-state/${getDeviceId()}/migrate`, {
    method: 'POST',
    body: JSON.stringify({ reviews, daily, settings }),
  })
  return response.json() as Promise<RemoteStudyState>
}

export async function saveReview(cardId: string, review: ReviewRecord) {
  await request(`/api/v1/study-state/${getDeviceId()}/reviews/${encodeURIComponent(cardId)}`, {
    method: 'PUT',
    body: JSON.stringify(review),
  })
}

export async function saveDaily(daily: DailyProgress) {
  await request(`/api/v1/study-state/${getDeviceId()}/daily`, {
    method: 'PUT',
    body: JSON.stringify(daily),
  })
}

export async function saveSettings(settings: DailySettings) {
  await request(`/api/v1/study-state/${getDeviceId()}/settings`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
