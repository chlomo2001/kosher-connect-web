import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim()
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || '').trim()
const useSupabase = !!(SUPABASE_URL.startsWith('https://') && SUPABASE_ANON_KEY)

let _supabase = null
function getSupabase() {
  if (!_supabase) _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  return _supabase
}

const dataDir = path.join(process.cwd(), 'data')
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

export async function loadData(name) {
  if (useSupabase) {
    try {
      const { data, error } = await getSupabase()
        .from('store')
        .select('value')
        .eq('key', name)
        .maybeSingle()
      if (error) console.error(`[loadData] Supabase error for "${name}":`, error.message)
      return data?.value || []
    } catch (e) {
      console.error(`[loadData] Exception for "${name}":`, e.message)
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
      const { error } = await getSupabase()
        .from('store')
        .upsert({ key: name, value: data }, { onConflict: 'key' })
      if (error) console.error(`[saveData] Supabase error for "${name}":`, error.message)
    } catch (e) {
      console.error(`[saveData] Exception for "${name}":`, e.message)
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
