const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

type TokenClientConfig = {
  client_id: string
  scope: string
  prompt?: '' | 'none' | 'consent' | 'select_account'
  callback: (resp: {
    access_token?: string
    error?: string
    error_description?: string
  }) => void
}

type TokenClient = {
  requestAccessToken: (overrideConfig?: { prompt?: string }) => void
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient
          revoke?: (token: string, done?: () => void) => void
        }
      }
    }
  }
}

let gisScriptPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('No window'))
  if (window.google?.accounts?.oauth2) return Promise.resolve()
  if (gisScriptPromise) return gisScriptPromise
  gisScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GIS_SCRIPT_SRC}"]`)
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Google script failed')), {
        once: true,
      })
      return
    }
    const s = document.createElement('script')
    s.src = GIS_SCRIPT_SRC
    s.async = true
    s.defer = true
    s.onload = () => resolve()
    s.onerror = () => {
      gisScriptPromise = null
      reject(new Error('Could not load Google Sign-In script.'))
    }
    document.head.appendChild(s)
  })
  return gisScriptPromise
}

/**
 * Opens Google’s account picker, then returns the selected account’s email (OAuth userinfo).
 * Requires a Web application OAuth 2.0 Client ID (Google Cloud Console) with this app’s origin
 * listed under “Authorized JavaScript origins”.
 */
export async function pickGoogleAccountEmail(oauthWebClientId: string): Promise<string | null> {
  const clientId = oauthWebClientId.trim()
  if (!clientId) return null

  await loadGisScript()
  const oauth2 = window.google?.accounts?.oauth2
  if (!oauth2?.initTokenClient) {
    throw new Error('Google Sign-In is not available in this browser.')
  }

  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      fn()
    }

    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: 'openid email profile',
      prompt: 'select_account',
      callback: async (tokenResponse) => {
        if (tokenResponse.error) {
          const err = tokenResponse.error
          const benign =
            err === 'access_denied' ||
            err === 'user_closed' ||
            err === 'popup_closed_by_user' ||
            err === 'interaction_required'
          if (benign) {
            finish(() => resolve(null))
            return
          }
          finish(() =>
            reject(
              new Error(
                tokenResponse.error_description?.trim() ||
                  `Google sign-in: ${err}`,
              ),
            ),
          )
          return
        }

        const accessToken = tokenResponse.access_token
        if (!accessToken) {
          finish(() => resolve(null))
          return
        }

        try {
          const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
          if (!res.ok) {
            throw new Error('Could not read profile from Google.')
          }
          const data = (await res.json()) as { email?: string }
          const email = typeof data.email === 'string' ? data.email.trim() : ''
          try {
            oauth2.revoke?.(accessToken, () => {})
          } catch {
            /* ignore */
          }
          finish(() => resolve(email || null))
        } catch (e) {
          finish(() => reject(e instanceof Error ? e : new Error(String(e))))
        }
      },
    })

    try {
      client.requestAccessToken()
    } catch (e) {
      finish(() => reject(e instanceof Error ? e : new Error(String(e))))
    }
  })
}
