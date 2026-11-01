import { Link, useNavigate } from 'react-router-dom'
import { TOS, PRIVACY, LEGAL_UPDATED } from '../lib/legal.js'

// Terms of Service and Privacy Policy: two small public pages (open signed in or not, like the community rules).
const PAGES = {
  tos: { title: 'Terms of Service', sections: TOS },
  privacy: { title: 'Privacy Policy', sections: PRIVACY },
}

export default function Legal({ page }) {
  const navigate = useNavigate()
  const { title, sections } = PAGES[page]
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  return (
    <div className="narrow terms-page">
      <div className="row between terms-top">
        <button type="button" className="secondary" onClick={back}>← Back</button>
        <Link to="/" className="small">Home</Link>
      </div>
      <h1>{title}</h1>
      <p className="muted small">Last updated {LEGAL_UPDATED}. Written in plain language for our group. It is not legal advice.</p>
      {sections.map(s => (
        <section key={s.title} className="card terms-section">
          <h2>{s.title}</h2>
          {s.body.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
      <p className="small legal-links">
        <Link to="/terms-of-service">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Community rules</Link>
      </p>
    </div>
  )
}
