const BASE = (import.meta.env.VITE_API_URL ?? '') + '/api'

async function request(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`
    try {
      const err = await res.json()
      msg = err.message || err.error || msg
    } catch (_) {}
    throw Object.assign(new Error(msg), { status: res.status })
  }

  if (res.status === 204) return null
  return res.json()
}

export function decodeJwt(token) {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

// ── Auth ────────────────────────────────────────────────────────────────────

export async function login(username, password) {
  return request('POST', '/auth/login', null, { username, password })
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export async function getAccounts(token) {
  return request('GET', '/accounts', token)
}

export async function getAccount(token, accountNumber) {
  return request('GET', `/accounts/${accountNumber}`, token)
}

// ── Ledger ───────────────────────────────────────────────────────────────────

export async function getLedger(token) {
  return request('GET', '/ledger', token)
}

export async function getTransfers(token) {
  return request('GET', '/transfers', token)
}

// ── Transfers ────────────────────────────────────────────────────────────────

export async function postTransfer(token, idempotencyKey, fromAccount, toAccount, amount) {
  const res = await fetch(`${BASE}/transfers`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey,
    },
    body: JSON.stringify({ from_account: fromAccount, to_account: toAccount, amount }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.message || `${res.status}`), { status: res.status, data })
  return { data, status: res.status }
}

// ── Audit ────────────────────────────────────────────────────────────────────

export async function verifyChain(token) {
  return request('GET', '/audit/verify', token)
}

export async function getAuditEvents(token) {
  return request('GET', '/audit/events', token)
}

export async function anchorCheck(token, id, hash) {
  return request('GET', `/audit/anchor-check?id=${id}&hash=${encodeURIComponent(hash)}`, token)
}

// ── Security Lab ──────────────────────────────────────────────────────────────

export async function labSqliVuln(name) {
  const res = await fetch(`${BASE}/lab/profile/vuln?name=${encodeURIComponent(name)}`)
  return { status: res.status, data: await res.json().catch(() => []) }
}

export async function labSqliFixed(token, name) {
  const res = await fetch(`${BASE}/lab/profile?name=${encodeURIComponent(name)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: res.status, data: await res.json().catch(() => []) }
}

export async function labBolaVuln(token, targetId) {
  const res = await fetch(`${BASE}/lab/customer/${targetId}/vuln`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: res.status, data: await res.json().catch(() => []) }
}

export async function labBolaFixed(token) {
  const res = await fetch(`${BASE}/lab/customer`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  return { status: res.status, data: await res.json().catch(() => []) }
}

export async function labJwtTamper(tamperedToken) {
  const res = await fetch(`${BASE}/accounts`, {
    headers: { Authorization: `Bearer ${tamperedToken}` },
  })
  return { status: res.status, data: await res.json().catch(() => ({})) }
}
