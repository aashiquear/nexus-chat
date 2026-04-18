import React from 'react'
import { ArrowRight } from 'lucide-react'

export default function SplashScreen({ onStart }) {
  return (
    <div className="splash-screen">
      <div className="splash-content">
        <div className="splash-logo-shine">
          <svg
            className="splash-logo-svg"
            viewBox="0 0 680 490"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="Nexus Chat animated logo"
          >
            <title>Nexus Chat animated logo</title>
            <desc>Animated logo with tighter spacing between icon and text.</desc>

            <g transform="translate(340, 155)">
              {/* Bubble */}
              <path
                className="bubble-bg"
                d="
                  M-100,-95
                  L80,-95
                  Q100,-95 100,-75
                  L100,55
                  Q100,75 80,75
                  L-15,75
                  L-48,112
                  L-36,75
                  L-80,75
                  Q-100,75 -100,55
                  L-100,-75
                  Q-100,-95 -80,-95
                  Z
                "
                fill="#5a8a7a"
              />

              {/* Connection lines */}
              <g>
                <line className="conn-line" x1="-60" y1="-50" x2="0" y2="10" stroke="#89b5a6" strokeWidth="2.8" strokeLinecap="round" />
                <line className="conn-line" x1="60" y1="-50" x2="0" y2="10" stroke="#89b5a6" strokeWidth="2.8" strokeLinecap="round" />
                <line className="conn-line" x1="-50" y1="50" x2="0" y2="10" stroke="#89b5a6" strokeWidth="2.8" strokeLinecap="round" />
                <line className="conn-line" x1="50" y1="50" x2="0" y2="10" stroke="#89b5a6" strokeWidth="2.8" strokeLinecap="round" />
                <line className="conn-line" x1="-60" y1="-50" x2="60" y2="-50" stroke="#96c0b2" strokeWidth="2.2" strokeLinecap="round" />
                <line className="conn-line" x1="-60" y1="-50" x2="-50" y2="50" stroke="#96c0b2" strokeWidth="2.2" strokeLinecap="round" />
                <line className="conn-line" x1="60" y1="-50" x2="50" y2="50" stroke="#96c0b2" strokeWidth="2.2" strokeLinecap="round" />
                <line className="conn-line" x1="-50" y1="50" x2="50" y2="50" stroke="#96c0b2" strokeWidth="2.2" strokeLinecap="round" />
              </g>

              {/* Outer four nodes */}
              <g>
                <g className="outer-node" style={{ transformOrigin: '-60px -50px' }}>
                  <circle cx="-60" cy="-50" r="20" fill="#5a8a7a" />
                  <circle cx="-60" cy="-50" r="9" fill="#eef3f1" />
                  <circle cx="-60" cy="-50" r="4.5" fill="#5a8a7a" opacity="0.4" />
                </g>
                <g className="outer-node" style={{ transformOrigin: '60px -50px' }}>
                  <circle cx="60" cy="-50" r="20" fill="#5a8a7a" />
                  <circle cx="60" cy="-50" r="9" fill="#eef3f1" />
                  <circle cx="60" cy="-50" r="4.5" fill="#5a8a7a" opacity="0.4" />
                </g>
                <g className="outer-node" style={{ transformOrigin: '-50px 50px' }}>
                  <circle cx="-50" cy="50" r="15" fill="#6b9d8c" />
                </g>
                <g className="outer-node" style={{ transformOrigin: '50px 50px' }}>
                  <circle cx="50" cy="50" r="15" fill="#6b9d8c" />
                </g>
              </g>

              {/* Center donut */}
              <g className="center-node" style={{ transformOrigin: '0px 10px' }}>
                <circle cx="0" cy="10" r="26" fill="#5a8a7a" />
                <circle cx="0" cy="10" r="12" fill="#eef3f1" />
                <circle cx="0" cy="10" r="6" fill="#5a8a7a" opacity="0.4" />
              </g>

              {/* Crescents */}
              <path className="crescent" d="M-74,-64 A20,20 0 0,1 -60,-70" stroke="#7aab9c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path className="crescent" d="M46,-64 A20,20 0 0,1 60,-70" stroke="#7aab9c" strokeWidth="1.8" fill="none" strokeLinecap="round" />
              <path className="crescent" d="M-16,-4 A26,26 0 0,1 0,-16" stroke="#7aab9c" strokeWidth="2" fill="none" strokeLinecap="round" />
            </g>

            {/* NEXUS */}
            <text className="logo-text" x="340" y="340" textAnchor="middle" fontFamily="'DM Sans', system-ui, -apple-system, sans-serif" fontSize="44" fontWeight="600" letterSpacing="8" fill="#3a675a">NEXUS</text>

            {/* CHAT */}
            <text className="logo-sub" x="340" y="374" textAnchor="middle" fontFamily="'DM Sans', system-ui, -apple-system, sans-serif" fontSize="16" fontWeight="400" letterSpacing="13" fill="#5a8a7a">CHAT</text>

            {/* Divider */}
            <line className="logo-div" x1="300" y1="390" x2="380" y2="390" stroke="#5a8a7a" strokeWidth="1.5" strokeLinecap="round" opacity="0.3" />

            {/* Tagline */}
            <text className="logo-tag" x="340" y="416" textAnchor="middle" fontFamily="'DM Sans', system-ui, -apple-system, sans-serif" fontSize="11" fontWeight="500" letterSpacing="4" fill="#6b9d8c">AGENTIC · RAG · MCP · MULTI-LLM</text>
          </svg>
        </div>

        <button className="splash-start-btn" onClick={onStart}>
          <span>Start Chat</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
