import { testOn } from './testOn.js'

export function consoleViewLog (src, func, msg) {
  if (!testOn) return
  console.log(`[LOG][${src}] ${func}: ${msg}`)
}

export function consoleViewError (src, func, err) {
  console.error(`[ERROR][${src}] ${func}: ${err}`)
}
