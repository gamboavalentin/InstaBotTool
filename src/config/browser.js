import { firefox } from 'playwright'
import { consoleViewLog } from '../utils/consoleView.js'

export async function startBrowser ({ headless = true }) {
  consoleViewLog('src/config/browser.js', 'startBrowser', 'RUN.')
  return await firefox.launch({ headless })
}
