import { startBrowser } from '../config/browser.js'
import { consoleViewError, consoleViewLog } from '../utils/consoleView.js'
import waitForTimeout from '../utils/waitForTimeout.js'

export default class ProfileBot {
  username
  profileUrl
  #context
  #page
  #cookies
  test
  postCount

  constructor ({ username, test = false }) {
    if (!username) {
      consoleViewError('src/model/ProfileBot.js', 'constructor', 'Username is required')
      throw new Error('Username is required')
    }

    this.username = username
    this.profileUrl = `https://www.instagram.com/${username}`
    this.test = test
  }

  async goToProfile () {
    try {
      await this.#page.goto(this.profileUrl)
      return { success: true, url: this.profileUrl }
    } catch (err) {
      consoleViewError('src/model/ProfileBot.js', 'login', 'ig no load. Error =', err)
      return { success: false, error: err }
    }
  }

  async login ({ cookies = [] }) {
    if (!this.username) {
      consoleViewError('src/model/ProfileBot.js', 'login', 'Username is required')
      return { success: false, error: 'Username is required' }
    }

    consoleViewLog('src/model/ProfileBot.js', 'login', 'login process started.')

    const browser = await startBrowser({ headless: !this.test })

    this.#context = await browser.newContext()

    if (cookies.length > 0) {
      this.#cookies = cookies
      await this.#context.addCookies(this.#cookies)
    }

    this.#page = await this.#context.newPage()
    await this.#page.setViewportSize({
      width: 1920,
      height: 1080
    })

    await this.#page.setExtraHTTPHeaders({
      'Accept-Language': 'es-AR,es'
    })

    const { success: successGoToProfile } = await this.goToProfile()
    if (!successGoToProfile) return { success: false, error: 'ig no load' }

    await waitForTimeout(5000)

    if (!cookies) return { success: true, username: this.username }

    const loginSuccess = await this.#page.getByText('Iniciar sesión', { exact: true }).isVisible()

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

  async post ({ fileUrls = [], descriptionMessage = '', config = { hideLike: false, disableComments: false } }) {
    if (!this.#page) {
      consoleViewError('src/model/ProfileBot.js', 'post', 'Login is required')
      return { success: false, error: 'Login is required' }
    }

    if (!fileUrls.length) {
      consoleViewError('src/model/ProfileBot.js', 'post', 'fileUrls is required')
      return { success: false, error: 'fileUrls is required' }
    }

    try {
      await this.#page.getByLabel('Nueva publicación', { exact: true }).click()

      // await page.getByLabel('Publicación', { exact: true }).click()

      const upload = await this.#page.getByRole('button', { name: 'Seleccionar de la computadora' })
      const fileChooserPromise = this.#page.waitForEvent('filechooser')
      await upload.click()
      const fileChooser = await fileChooserPromise
      await fileChooser.setFiles(fileUrls)

      await this.#page.getByRole('button', { name: 'Siguiente' }).click()

      await this.#page.getByRole('button', { name: 'Siguiente' }).click()

      await this.#page.locator('div[contenteditable="true"]').fill(descriptionMessage)

      await waitForTimeout(5000)

      if (config.hideLike || config.disableComments) {
        await this.#page.locator('span', { hasText: 'Configuración avanzada' }).click()

        const [likeButton, comentarioButton] = await this.#page.locator('input[role="switch"][type="checkbox"]').all()

        if (config.hideLike) await likeButton.click()
        if (config.disableComments) await comentarioButton.click()
      }

      await waitForTimeout(5000)

      await this.#page.getByText('Compartir', { exact: true }).click()

      await this.#page.getByAltText('Marca de verificación animada', { exact: true }).waitFor()
      consoleViewLog('src/controllers/post.js', 'postAction', 'post success.')

      await this.#page.getByLabel('Cerrar', { exact: true }).click()

      await waitForTimeout(5000)

      return { success: true, fileUrls, descriptionMessage, username: this.username }
    } catch (error) {
      consoleViewError('src/controllers/post.js', 'postAction', `Error al Publicar [Error = ${error}]`)
      return { success: false, error }
    }
  }

  async #getPostsList () {
    if (!this.#page) {
      consoleViewError('src/model/ProfileBot.js', 'getPostsList', 'Login is required')
      return { success: false, error: 'Login is required' }
    }

    try {
      const { success: successGoToProfile } = await this.goToProfile()
      if (!successGoToProfile) return { success: false, error: 'ig no load' }

      await waitForTimeout(5000)

      let countPostLast = -1
      let $$post = await this.#page.locator('a[href^="/p/"]').all()
      let countPostNew = $$post.length

      if (countPostNew === 0) {
        consoleViewLog('src/utils/getAllPost.js', 'default', 'No scroll [countPostNew=0].')
        return { success: true, $$post }
      }

      do {
        consoleViewLog('src/utils/getAllPost.js', 'default', `scroll [countPostLast=${countPostLast}, countPostNew=${countPostNew}].`)
        countPostLast = countPostNew
        await this.#page.mouse.wheel(0, 10000)
        await waitForTimeout(5000)
        $$post = await this.#page.locator('a[href^="/p/"]').all()
        countPostNew = $$post.length
      } while (countPostLast !== countPostNew)

      return { success: true, $$post }
    } catch (error) {
      consoleViewError('src/utils/getAllPost.js', 'default', `Error al obtener los post [Error = ${error}].`)
      return { success: false, error }
    }
  }

  async getPostCount () {
    const { success: successGetPostList, $$post, error } = await this.#getPostsList()
    if (!successGetPostList) return { success: false, error }

    this.postCount = $$post.length
    return { success: true, postCount: this.postCount }
  }

  async deletePost (postIndex) {
    if (!postIndex) {
      consoleViewError('src/controllers/delete.js', 'deleteAction', 'index is required.')
      return { success: false, error: 'index is required.' }
    }

    try {
      const $$post = await this.#getPostsList()

      if (!$$post[postIndex]) {
        consoleViewError('src/controllers/delete.js', 'deleteAction', 'index is invalid.')
        return { success: false, error: 'index is invalid.' }
      }

      const $post = $$post[postIndex]
      await waitForTimeout(5000)
      // Click Publicacion
      await $post.click()

      await this.#page.getByLabel('Más opciones', { exact: true }).click()

      // Click en el Boton Eliminar
      await this.#page.getByText('Eliminar', { exact: true }).click()
      await waitForTimeout(5000)
      await this.#page.getByText('Eliminar', { exact: true }).click()
      await waitForTimeout(5000)

      consoleViewLog('src/controllers/delete.js', 'deleteAction', 'delete success.')
      return { success: true, postIndex }
    } catch (error) {
      consoleViewError('src/controllers/delete.js', 'deleteAction', `delete ERROR [error = ${error}].`)
      return { success: false, error }
    }
  }
}
