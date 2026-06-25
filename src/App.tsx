import { useEffect, useState } from 'react'
import { BarChart3, BookOpen, Brain, CalendarDays, Check, ChevronRight, Clock3, Flame, RotateCcw, Save } from 'lucide-react'
import rawCards from './data/vocabulary.json'
import { StudyCard } from './components/StudyCard'
import { useStudySession } from './hooks/useStudySession'
import { nextLabel } from './lib/scheduler'
import type { Rating, VocabularyCard } from './types'
import './styles.css'

const cards = rawCards as VocabularyCard[]
const ratings: { id: Rating; label: string; key: string }[] = [
  { id: 'again', label: '重来', key: '1' },
  { id: 'hard', label: '困难', key: '2' },
  { id: 'good', label: '良好', key: '3' },
  { id: 'easy', label: '简单', key: '4' },
]

export default function App() {
  const [flipped, setFlipped] = useState(false)
  const {
    current, record, rate, stats,
    daily, settings, todayTotal, updateLimits,
  } = useStudySession(cards)
  const [draftNew, setDraftNew] = useState(settings.newPerDay)

  const answer = (rating: Rating) => {
    if (!flipped) return
    rate(rating)
    setFlipped(false)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        event.preventDefault()
        setFlipped((value) => !value)
      }
      const rating = ratings.find((item) => item.key === event.key)
      if (rating && flipped) answer(rating.id)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Tango Anki 首页"><span>単</span> Tango Anki</a>
        <nav><a className="active" href="#study"><BookOpen size={18} /> 学习</a><a href="#stats"><BarChart3 size={18} /> 数据</a></nav>
        <div className="streak"><Flame size={18} /> 今日 {todayTotal}</div>
      </header>

      <main>
        <section className="stats-grid" id="stats">
          <article><span className="stat-icon blue"><BookOpen size={19} /></span><span><small>新词</small><strong>{stats.newCount}</strong></span></article>
          <article><span className="stat-icon amber"><Clock3 size={19} /></span><span><small>学习中</small><strong>{stats.learning}</strong></span></article>
          <article><span className="stat-icon purple"><RotateCcw size={19} /></span><span><small>待复习</small><strong>{stats.review}</strong></span></article>
          <article><span className="stat-icon green"><Check size={19} /></span><span><small>已掌握</small><strong>{stats.mastered}</strong></span></article>
        </section>

        <section className="daily-plan">
          <div className="plan-heading"><span><CalendarDays size={18} /></span><div><strong>每日学习计划</strong><small>每天零点自动开始新的累计</small></div></div>
          <div className="plan-progress">
            <span>今日新学 <strong>{daily.newCompleted}</strong> / {settings.newPerDay}</span>
            <span>今日复习 <strong>{daily.reviewCompleted}</strong></span>
          </div>
          <form onSubmit={(event) => { event.preventDefault(); updateLimits({ newPerDay: draftNew }) }}>
            <label>每日新学数量<input type="number" min="0" max="999" value={draftNew} onChange={(event) => setDraftNew(Number(event.target.value))} /></label>
            <button type="submit"><Save size={15} /> 保存</button>
          </form>
        </section>

        <section className="study-area" id="study">
          {current ? (
            <>
              <StudyCard card={current} flipped={flipped} onFlip={() => setFlipped((value) => !value)} />
              <div className={`rating-panel ${flipped ? 'visible' : ''}`} aria-hidden={!flipped}>
                <span className="rating-title"><Brain size={17} /> 你记得怎么样？</span>
                <div className="rating-buttons">
                  {ratings.map((item) => <button className={item.id} key={item.id} onClick={() => answer(item.id)}><small>{nextLabel(record, item.id)}</small><span>{item.label}</span><kbd>{item.key}</kbd></button>)}
                </div>
              </div>
              {!flipped && <button className="show-answer" onClick={() => setFlipped(true)}>显示答案 <ChevronRight size={18} /></button>}
            </>
          ) : (
            <div className="session-done"><span><Check size={34} /></span><h2>今日学习完成</h2><p>今日已完成 {todayTotal} 个词，其中新学 {daily.newCompleted}、复习 {daily.reviewCompleted}。</p></div>
          )}
          <p className="shortcut">空格翻面 · 数字 1—4 选择熟练度</p>
        </section>
      </main>
    </div>
  )
}
