import fs from 'fs'
import path from 'path'

const dataDir = path.join(process.cwd(), 'data')

function ensureDataDir() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true })
}

export function loadData(name) {
  ensureDataDir()
  const file = path.join(dataDir, `${name}.json`)
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, '[]')
    return []
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch {
    return []
  }
}

export function saveData(name, data) {
  ensureDataDir()
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(data, null, 2))
}
