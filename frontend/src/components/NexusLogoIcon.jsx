import React from 'react'

export default function NexusLogoIcon({ size = 28 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="6" fill="#d9e6df" />
      <g stroke="#5a8a7a" strokeWidth="1.3" strokeLinecap="round" fill="none">
        <line x1="10" y1="10" x2="16" y2="17" />
        <line x1="22" y1="10" x2="16" y2="17" />
        <line x1="11" y1="22" x2="16" y2="17" />
        <line x1="21" y1="22" x2="16" y2="17" />
      </g>
      <g stroke="#89b5a6" strokeWidth="0.9" strokeLinecap="round" fill="none">
        <line x1="10" y1="10" x2="22" y2="10" />
        <line x1="11" y1="22" x2="21" y2="22" />
      </g>
      <circle cx="10" cy="10" r="3" fill="#5a8a7a" />
      <circle cx="10" cy="10" r="1.3" fill="#eef3f1" />
      <circle cx="22" cy="10" r="3" fill="#5a8a7a" />
      <circle cx="22" cy="10" r="1.3" fill="#eef3f1" />
      <circle cx="11" cy="22" r="2" fill="#6b9d8c" />
      <circle cx="21" cy="22" r="2" fill="#6b9d8c" />
      <circle cx="16" cy="17" r="4" fill="#5a8a7a" />
      <circle cx="16" cy="17" r="1.8" fill="#eef3f1" />
    </svg>
  )
}
