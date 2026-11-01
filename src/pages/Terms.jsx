import { Link, useNavigate } from 'react-router-dom'
import { TERMS, TERMS_UPDATED } from '../lib/terms.js'

// The community rules. Open to everyone, signed in or not (the sign-up form links here).
export default function Terms() {
  const navigate = useNavigate()
  // go back to wherever you came from (the admin page, Settings, the sign-up form), or home if this was opened directly
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  return (
    <div className="narrow terms-page">
      <div className="row between terms-top">
        <button type="button" className="secondary" onClick={back}>← Back</button>
        <Link to="/" className="small">Home</Link>
      </div>
      <h1>Community rules</h1>
      <p className="muted small">Last updated {TERMS_UPDATED}. These are the house rules for our group. They are written in plain language and are not legal advice.</p>
      {TERMS.map(s => (
        <section key={s.title} className="card terms-section">
          <h2>{s.title}</h2>
          {s.body.map((p, i) => <p key={i}>{p}</p>)}
        </section>
      ))}
      <div className="row between">
        <button type="button" className="secondary" onClick={back}>← Back</button>
        <Link to="/" className="small">Back to LOCK IN</Link>
      </div>
      <p className="small legal-links"><Link to="/terms-of-service">Terms of Service</Link> · <Link to="/privacy">Privacy Policy</Link></p>
    </div>
  )
}
