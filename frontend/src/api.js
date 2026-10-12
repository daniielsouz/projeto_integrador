export async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { ...(options.body && { 'Content-Type': 'application/json' }), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.');
  }
  if (response.status === 204) return null;
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('O servidor está indisponível. Tente novamente em instantes.');
  }
  if (!response.ok) {
    const error = new Error(data.error ?? 'Não foi possível concluir a operação.');
    error.fields = data.fields;
    throw error;
  }
  return data;
}
