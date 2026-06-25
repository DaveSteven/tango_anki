import type { DailyProgress, DailySettings, ReviewRecord, ReviewStore } from '../types'

const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'tango-anki-auth-token-v1'
const USER_KEY = 'tango-anki-auth-user-v1'

export type RemoteStudyState = {
  reviews: ReviewStore
  daily: DailyProgress | null
  settings: DailySettings
}

export type AuthSession = {
  token: string
  username: string
}

export const getAuthSession = (): AuthSession | null => {
  const token = localStorage.getItem(TOKEN_KEY)
  const username = localStorage.getItem(USER_KEY)
  return token && username ? { token, username } : null
}

const setAuthSession = (session: AuthSession) => {
  localStorage.setItem(TOKEN_KEY, session.token)
  localStorage.setItem(USER_KEY, session.username)
  window.dispatchEvent(new Event('tango-anki-auth-change'))
}

export const clearAuthSession = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
  window.dispatchEvent(new Event('tango-anki-auth-change'))
}

async function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('Content-Type', 'application/json')
  const session = getAuthSession()
  if (session) headers.set('Authorization', `Bearer ${session.token}`)
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
  })
  if (response.status === 401) clearAuthSession()
  if (!response.ok) throw new Error(`API request failed: ${response.status}`)
  return response
}

export async function login(username: string, password: string): Promise<AuthSession> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!response.ok) throw new Error('用户名或密码不正确')
  const session = await response.json() as AuthSession
  setAuthSession(session)
  return session
}

export async function logout() {
  await request('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined)
  clearAuthSession()
}

export async function getStudyState(): Promise<RemoteStudyState> {
  const response = await request('/api/v1/study-state/me')
  return response.json() as Promise<RemoteStudyState>
}

export async function saveReview(cardId: string, review: ReviewRecord) {
  await request(`/api/v1/study-state/me/reviews/${encodeURIComponent(cardId)}`, {
    method: 'PUT',
    body: JSON.stringify(review),
  })
}

export async function saveDaily(daily: DailyProgress) {
  await request('/api/v1/study-state/me/daily', {
    method: 'PUT',
    body: JSON.stringify(daily),
  })
}

export async function saveSettings(settings: DailySettings) {
  await request('/api/v1/study-state/me/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}
