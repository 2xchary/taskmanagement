import { useEffect, useState } from 'react'

// The clock and date in the middle of the Nostalgic Menu shelf bar. It only exists in that look.
export default function ShelfClock() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="shelf-clock" aria-label="Time and date">
      <strong>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong>
      <small>{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</small>
    </span>
  )
}
