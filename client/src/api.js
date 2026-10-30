// Thin wrapper around fetch. Errors carry the server message and the response body in err.data.
//  - err.status is the HTTP status. It is missing when no response arrived at all.
//  - err.network is true when there was no response (offline, timeout, server asleep).
async function request(method, url, body, { timeout = 20000 } = {}) {
  // Give up after `timeout` ms so the UI never stays stuck on "Please wait"
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(method !== 'GET' ? { 'X-Tesoria-Request': '1' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    const e = new Error(
      err.name === 'AbortError'
        ? 'The server is taking too long. Please try again in a moment.'
        : 'Could not reach the server. Check your connection and try again.'
    );
    e.network = true;
    throw e;
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Server error');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Longer timeout: a sleeping free-tier server can take close to a minute to wake up
  me: () => request('GET', '/api/me', undefined, { timeout: 60000 }),
  register: (username, email, password) => request('POST', '/api/auth/register', { username, email, password }),
  verify: (email, code) => request('POST', '/api/auth/verify', { email, code }),
  resend: (email) => request('POST', '/api/auth/resend', { email }),
  // remember = keep the session for 30 days; otherwise it ends when the browser closes
  login: (identifier, password, remember = true) => request('POST', '/api/auth/login', { identifier, password, remember }),
  logout: () => request('POST', '/api/auth/logout'),
  // Needs the current password; the server answers with the new username
  changeUsername: (username, password) => request('PUT', '/api/me/username', { username, password }),
  forgot: (email) => request('POST', '/api/auth/forgot', { email }),
  reset: (email, code, password) => request('POST', '/api/auth/reset', { email, code, password }),
  getMonth: (period) => request('GET', `/api/months/${period}`),
  setIncome: (period, income) => request('PUT', `/api/months/${period}/income`, { income }),
  // Adds the previous month's income (if this one has none) and, if asked, its expenses. Never duplicates.
  copyPrevious: (period, expenses) => request('POST', `/api/months/${period}/copy-previous`, { expenses }),
  addTx: (period, body) => request('POST', `/api/months/${period}/transactions`, body),
  updateTx: (id, body) => request('PUT', `/api/transactions/${id}`, body),
  deleteTx: (id) => request('DELETE', `/api/transactions/${id}`),
  categories: () => request('GET', '/api/categories'),
  summary: () => request('GET', '/api/summary'),
};
