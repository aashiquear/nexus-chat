import React from 'react'
import { X, MessageSquare, Bot, Hash, Type, Zap, TrendingUp, Clock } from 'lucide-react'

function StatRow({ icon: Icon, label, value, sub }) {
  return (
    <div className="stat-row">
      <div className="stat-row-left">
        <Icon size={13} className="stat-row-icon" />
        <span className="stat-row-label">{label}</span>
      </div>
      <div className="stat-row-right">
        <span className="stat-row-value">{value}</span>
        {sub && <span className="stat-row-sub">{sub}</span>}
      </div>
    </div>
  )
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}

export default function StatsPopup({ stats, onClose }) {
  const {
    userMessages = 0,
    assistantMessages = 0,
    totalUserWords = 0,
    totalAssistantWords = 0,
    totalPromptTokens = 0,
    totalCompletionTokens = 0,
    totalTokens = 0,
    maxResponseWords = 0,
    maxResponseTokens = 0,
    lastResponseWords = 0,
    lastResponseTokens = 0,
    avgResponseWords = 0,
    avgResponseTokens = 0,
  } = stats

  return (
    <div className="stats-popup">
      <div className="stats-popup-header">
        <span className="stats-popup-title">Conversation Stats</span>
        <button className="stats-popup-close" onClick={onClose}>
          <X size={14} />
        </button>
      </div>

      <div className="stats-popup-body">
        <div className="stats-section">
          <div className="stats-section-label">Messages</div>
          <StatRow icon={MessageSquare} label="User requests" value={userMessages} />
          <StatRow icon={Bot} label="LLM responses" value={assistantMessages} />
        </div>

        <div className="stats-section">
          <div className="stats-section-label">Words</div>
          <StatRow icon={Type} label="User total" value={formatNum(totalUserWords)} />
          <StatRow icon={Type} label="LLM total" value={formatNum(totalAssistantWords)} />
          <StatRow icon={TrendingUp} label="LLM avg / response" value={avgResponseWords} sub="words" />
          <StatRow icon={Zap} label="LLM max response" value={maxResponseWords} sub="words" />
        </div>

        <div className="stats-section">
          <div className="stats-section-label">Tokens</div>
          <StatRow icon={Hash} label="Prompt tokens" value={formatNum(totalPromptTokens)} />
          <StatRow icon={Hash} label="Completion tokens" value={formatNum(totalCompletionTokens)} />
          <StatRow icon={Hash} label="Total tokens" value={formatNum(totalTokens)} />
          <StatRow icon={TrendingUp} label="Avg / response" value={avgResponseTokens} sub="tokens" />
          <StatRow icon={Zap} label="Max response" value={maxResponseTokens} sub="tokens" />
        </div>

        {lastResponseWords > 0 && (
          <div className="stats-section">
            <div className="stats-section-label">Last Response</div>
            <StatRow icon={Clock} label="Words" value={lastResponseWords} />
            <StatRow icon={Clock} label="Tokens" value={lastResponseTokens} />
          </div>
        )}
      </div>
    </div>
  )
}
