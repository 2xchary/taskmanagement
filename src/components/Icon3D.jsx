// An extruded, slightly turned icon block for the Nostalgic Menu shelf: a stack of thin slices of the same rounded shape
// (the sides), a front face holding the icon and a back plate. Light on the GPU: about 7 slices, no filters, and only the
// open or focused one turns (see styles.css).
const SLICES = Array.from({ length: 7 }, (_, k) => k)

export default function Icon3D({ children }) {
  return (
    <span className="i3d" aria-hidden="true">
      <span className="i3d-in">
        <i className="i3d-back" />
        {SLICES.map(k => <i key={k} className="i3d-slice" style={{ '--k': k }} />)}
        <span className="i3d-front">{children}</span>
      </span>
    </span>
  )
}
