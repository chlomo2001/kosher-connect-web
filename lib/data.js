import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const useSupabase = !!(process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY)

function getSupabase() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
}

const dataDir = path.join(process.cwd(), 'data')
function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

export async function loadData(name) {
  if (useSupabase) {
    const { data, error } = await getSupabase()
      .from('store')
      .select('value')
      .eq('key', name)
      .maybeSingle()
    if (error || !data) return []
    return data.value || []
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
    await getSupabase()
      .from('store')
      .upsert({ key: name, value: data }, { onConflict: 'key' })
    return
  }
  try {
    ensureDataDir()
    fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('saveData error:', e)
  }
}
