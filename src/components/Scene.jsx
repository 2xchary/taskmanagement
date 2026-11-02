import { useTheme } from '../lib/theme.jsx'
// The animated backdrop that shows through the glass. It's just empty shapes: each theme in
// styles.css decides what they look like and how they move (pollen, stars, petals, fireflies...).
// It sits behind everything, ignores the mouse, and stops moving for people who prefer less motion.
const PARTICLES = Array.from({ length: 14 }, (_, i) => i)
const SOLIDS = Array.from({ length: 24 }, (_, i) => i)   // Nostalgic Menu: more shapes, each a small 3D stack of three layers

export default function Scene() {
  const { theme } = useTheme()
  const solid = theme === 'nostalgic'
  return (
    <div className="scene" aria-hidden="true">
      <i className="g1" />
      <i className="g2" />
      {(solid ? SOLIDS : PARTICLES).map(i => (
        <span key={i} style={{ '--i': i }}>{solid && <><i /><i /><i /></>}</span>
      ))}
    </div>
  )
}
