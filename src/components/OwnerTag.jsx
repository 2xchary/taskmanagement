import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'

// A small "OWNER" tag next to the name of whoever runs the site. The list of owner ids comes from the database
// (owner_ids(), supabase/050_owner_tag.sql), is fetched once, and is shared by every tag on the page.
let owners = null          // Set of ids once loaded
let loading = null
const listeners = new Set()

function load() {
  if (owners || loading || !supabase) return
  loading = supabase.rpc('owner_ids').then(({ data, error }) => {
    owners = new Set(error ? [] : (data ?? []).map(r => (typeof r === 'string' ? r : r?.owner_ids)))
    listeners.forEach(fn => fn())
  }).catch(() => { owners = new Set() })
}

export function useIsOwner(userId) {
  const [, tick] = useState(0)
  useEffect(() => {
    const fn = () => tick(n => n + 1)
    listeners.add(fn); load()
    return () => { listeners.delete(fn) }
  }, [])
  return !!userId && !!owners?.has(userId)
}

export default function OwnerTag({ userId }) {
  return useIsOwner(userId) ? <span className="owner-tag" title="Owner of LOCK IN">OWNER</span> : null
}
