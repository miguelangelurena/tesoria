// Thin wrapper around fetch. Errors carry the server message and the response body in err.data.
async function request(method, url, body) {
  // Give up after 20 seconds so the UI never stays stuck on "Please wait"
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let res;
  try {
    res = await fetch(url, {
      method,
      signal: controller.signal,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The server is taking too long. Please try again in a moment.');
    }
    throw new Error('Could not reach the server. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || 'Server error');
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  me: () => request('GET', '/api/me'),
  register: (username, email, password) => request('POST', '/api/auth/register', { username, email, password }),
  verify: (email, code) => request('POST', '/api/auth/verify', { email, code }),
  resend: (email) => request('POST', '/api/auth/resend', { email }),
  login: (identifier, password) => request('POST', '/api/auth/login', { identifier, password }),
  logout: () => request('POST', '/api/auth/logout'),
  forgot: (email) => request('POST', '/api/auth/forgot', { email }),
  reset: (email, code, password) => request('POST', '/api/auth/reset', { email, code, password }),
  getMonth: (period) => request('GET', `/api/months/${period}`),
  setIncome: (period, income) => request('PUT', `/api/months/${period}/income`, { income }),
  addTx: (period, body) => request('POST', `/api/months/${period}/transactions`, body),
  updateTx: (id, body) => request('PUT', `/api/transactions/${id}`, body),
  deleteTx: (id) => request('DELETE', `/api/transactions/${id}`),
  categories: () => request('GET', '/api/categories'),
  summary: () => request('GET', '/api/summary'),
};
