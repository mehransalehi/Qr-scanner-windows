export type ServerConfig = {
  host: string
  bank: string
}

export type CheckServerResult = {
  ok: boolean
  message: string
}

export function parseServerUrl(input: string): ServerConfig {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Server URL must be entered.')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Please enter a valid server URL.')
  }

  if (!url.hostname) throw new Error('Server URL must include a host.')

  const bank = url.pathname.split('/').filter(Boolean)[0]
  if (!bank) throw new Error('Server URL must include a bank parameter.')

  return {
    host: url.host,
    bank,
  }
}

export async function checkServer(input: string): Promise<CheckServerResult> {
  try {
    const { host } = parseServerUrl(input)
    const res = await fetch(`http://${host}/api/`)
    const data = await res.json().catch(() => null) as { success?: boolean; message?: string } | null

    if (res.ok && data?.success === true && data.message === 'QR API running') {
      return { ok: true, message: 'Server connected successfully' }
    }

    return { ok: false, message: 'Server check failed.' }
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export async function postQr(qr: string, data: string, input: string): Promise<string> {
  try {
    const { host, bank } = parseServerUrl(input)
    const res = await fetch(`http://${host}/api/qr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '5aLAHNvL8maN3byq9VsiGhR9qqZ9AULL',
      },
      body: JSON.stringify({
        image: data,
        decoded: qr,
        bank,
      }),
    })

    const text = await res.text()
    console.log(res.status)
    return `HTTP ${res.status}: ${text || 'OK'}`
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error))
    return `API Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
