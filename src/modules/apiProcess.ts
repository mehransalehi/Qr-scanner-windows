export async function postQr(qr: string): Promise<string> {
  try {
    const res = await fetch('http://localhost:3000/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr }),
    })
    const text = await res.text()
    return `HTTP ${res.status}: ${text || 'OK'}`
  } catch (error) {
    return `API Error: ${error instanceof Error ? error.message : String(error)}`
  }
}
