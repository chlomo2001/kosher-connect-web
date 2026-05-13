import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')
const useKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

export async function loadData(name) {
  if (useKV) {
    try {
      const { kv } = await import('@vercel/kv')
      const data = await kv.get(name)
      return data || []
    } catch {
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
  if (useKV) {
    const { kv } = await import('@vercel/kv')
    await kv.set(name, data)
    return
  }
  try {
    ensureDataDir()
    fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2))
  } catch (e) {
    console.error('saveData error:', e)
  }
}
