export async function postQr(qr: string, data: string): Promise<string> {
  try {
    const res = await fetch('http://62.238.46.7/api/qr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '5aLAHNvL8maN3byq9VsiGhR9qqZ9AULL', // 🔐 add this
      },
      body: JSON.stringify({
        image: data,        // ✅ match API
        decoded: qr,    // ✅ match API
      }),
    })

    const text = await res.text()
    console.log(res.status);
    return `HTTP ${res.status}: ${text || 'OK'}`
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
    return `API Error: ${error instanceof Error ? error.message : String(error)}`
  }
}