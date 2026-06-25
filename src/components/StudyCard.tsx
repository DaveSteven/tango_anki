import { BookOpenText, Lightbulb, RotateCcw } from 'lucide-react'
import type { VocabularyCard } from '../types'

type Props = {
  card: VocabularyCard
  flipped: boolean
  onFlip: () => void
}

export function StudyCard({ card, flipped, onFlip }: Props) {
  return (
    <button className={`study-card ${flipped ? 'is-flipped' : ''}`} onClick={onFlip} type="button" aria-label="翻转单词卡">
      <span className="card-side card-front">
        <strong className="word">{card.word}</strong>
        <span className="flip-hint"><RotateCcw size={17} /> 点击卡片查看答案</span>
      </span>
      <span className="card-side card-back">
        <span className="answer-head">
          <span><strong>{card.word}</strong><small>{card.reading}</small></span>
          <span className="tag">{card.partOfSpeech}</span>
        </span>
        <span className="meaning">{card.meaning}</span>
        <span className="detail-block">
          <span className="detail-title"><BookOpenText size={16} /> 例句</span>
          <span className="japanese">{card.example}</span>
        </span>
        <span className="detail-block related">
          <span className="detail-title"><Lightbulb size={16} /> 相关词汇</span>
          <span>{card.relatedWords.length ? card.relatedWords.join(' · ') : '暂无关联词汇'}</span>
        </span>
      </span>
    </button>
  )
}
