import fs from 'fs'
import path from 'path'

const SB_URL = (process.env.SUPABASE_URL || 'https://rcpqgujtutvpfzfsgzql.supabase.co').trim()
const SB_KEY = (process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJjcHFndWp0dXR2cGZ6ZnNnenFsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MjE5MjAsImV4cCI6MjA5NDA5NzkyMH0.ehkEWg8bd11eH07Li4fXwyeDoj_c5yq5i0gk8eKHSOA').trim()
const useSupabase = SB_URL.startsWith('https://')

const headers = {
  'apikey': SB_KEY,
  'Authorization': `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
}

const dataDir = path.join(process.cwd(), 'data')
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

export async function loadData(name) {
  if (useSupabase) {
    try {
      const res = await fetch(
        `${SB_URL}/rest/v1/store?select=value&key=eq.${name}`,
        { headers }
      )
      if (!res.ok) {
        console.error(`[loadData] ${name}: HTTP ${res.status}`, await res.text())
        return []
      }
      const rows = await res.json()
      return rows[0]?.value || []
    } catch (e) {
      console.error(`[loadData] ${name} exception:`, e.message)
      return []
    }
  }
  try {
    ensureDataDir()
    const file = path.join(dataDir, `${name}.json`)
    if (!fs.existsSync(file)) return []
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return []
  }
}

export async function saveData(name, data) {
  if (useSupabase) {
    try {
      const res = await fetch(`${SB_URL}/rest/v1/store`, {
        method: 'POST',
        headers: {
          ...headers,
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify({ key: name, value: data }),
      })
      if (!res.ok) {
        console.error(`[saveData] ${name}: HTTP ${res.status}`, await res.text())
      }
    } catch (e) {
      console.error(`[saveData] ${name} exception:`, e.message)
    }
    return
  }
  try {
    ensureDataDir()
    fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('saveData filesystem error:', e)
  }
}
