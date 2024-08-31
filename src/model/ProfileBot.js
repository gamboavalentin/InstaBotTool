import { startBrowser } from '../config/browser.js'
import { consoleViewError, consoleViewLog } from '../utils/consoleView.js'
import waitForTimeout from '../utils/waitForTimeout.js'

export default class ProfileBot {
  username
  #context
  #cookies
  test

  constructor ({ username, test = false }) {
    this.username = username
    this.test = test
  }

  async login ({ cookies }) {
    if (!this.username) {
      consoleViewError('src/model/ProfileBot.js', 'login', 'Username is required')
      return { success: false, error: 'Username is required' }
    }

    consoleViewLog('src/model/ProfileBot.js', 'login', 'login process started.')

    const browser = await startBrowser({ headless: !this.test })

    this.#context = await browser.newContext()

    if (cookies) {
      this.#cookies = cookies
      await this.#context.addCookies(this.#cookies)
    }

    const page = await this.#context.newPage()
    await page.setViewportSize({
      width: 1920,
      height: 1080
    })

    await page.setExtraHTTPHeaders({
      'Accept-Language': 'es-AR,es'
    })

    try {
      await page.goto(`https://www.instagram.com/${this.username}`)
    } catch (err) {
      consoleViewError('src/model/ProfileBot.js', 'login', 'ig no load. Error =', err)
      return { success: false, error: err }
    }

    await waitForTimeout(5000)

    if (!cookies) return { success: true, username: this.username }

    const loginSuccess = await page.getByText('Iniciar sesión', { exact: true }).isVisible()

    if (!loginSuccess) {
      consoleViewError('src/model/ProfileBot.js', 'login', 'login failed, cookie invalid.')
      return { success: false, error: 'login failed' }
    }

    const { cookies: newCookies } = await this.getCookies()

    consoleViewLog('src/model/ProfileBot.js', 'login', 'login with cookie success.')
    return { success: true, username: this.username, newCookies }
  }

  async getCookies () {
    if (!this.#context) {
      consoleViewError('src/model/ProfileBot.js', 'getCookies', 'Login is required')
      return { success: false, error: 'Login is required' }
    }
    // Save cookies
    this.#cookies = await this.#context.cookies()
    return { success: true, cookies: this.#cookies }
  }

  async post () {

  }
}
