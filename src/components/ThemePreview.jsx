// A theme's colour palette with a small picture of what the page looks like in it. The pictures are screenshots of
// the real page, one per theme, kept in src/assets/theme-previews/<theme id>.jpg (or .png). A theme without a picture
// still shows its palette.
const pictures = import.meta.glob('../assets/theme-previews/*.{jpg,png}', { eager: true, query: '?url', import: 'default' })

const STYLE_PACKS = ['clay', 'brutal', 'wabi', 'cyber', 'scrap', 'phantom', 'nostalgic']

// A Style pack is more than colours, so it gets a miniature of the app drawn with its real box, button and field styles.
function StylePackPreview({ id, colors }) {
  return (
    <span className="theme-preview" aria-hidden="true">
      <span className="sp" data-pack={id}>
        <span className="sp-bar"><i /><i /><b>LOCK IN</b><em>Lv 7</em></span>
        <span className="card">
          <h3>Today</h3>
          <span className="muted small">3 of 5 tasks done</span>
          <span className="sp-prog"><i /></span>
          <input readOnly tabIndex={-1} placeholder="Add a task…" />
          <span className="row"><button type="button" tabIndex={-1}>Add</button><button type="button" className="secondary" tabIndex={-1}>Later</button></span>
        </span>
        <span className="card">
          <span className="sp-task done"><input type="checkbox" checked readOnly tabIndex={-1} /><span>Read chapter 4</span></span>
          <span className="sp-task"><input type="checkbox" readOnly tabIndex={-1} /><span>Lab report, due Fri</span></span>
          <span className="sp-chips"><span>25:00 focus</span><span>🔥 4 day streak</span></span>
        </span>
      </span>
      <span className="theme-swatch">
        {colors.map((c, i) => <i key={i} style={{ background: c }} />)}
      </span>
    </span>
  )
}

export default function ThemePreview({ id, colors = [] }) {
  if (STYLE_PACKS.includes(id)) return <StylePackPreview id={id} colors={colors} />
  const src = pictures[`../assets/theme-previews/${id}.jpg`] ?? pictures[`../assets/theme-previews/${id}.png`]
  return (
    <span className="theme-preview" aria-hidden="true">
      {src && <img className="theme-shot" src={src} alt="" loading="lazy" draggable="false" />}
      <span className="theme-swatch">
        {colors.map((c, i) => <i key={i} style={{ background: c }} />)}
      </span>
    </span>
  )
}
