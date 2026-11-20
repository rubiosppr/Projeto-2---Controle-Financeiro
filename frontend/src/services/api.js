const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api';
const CHAVE = 'token';

let aoExpirar = () => {};
export const definirAoExpirar = (fn) => { aoExpirar = fn; };

export function lerToken() {
  try { return localStorage.getItem(CHAVE); } catch { return null; }
}
export function salvarToken(token) {
  try { localStorage.setItem(CHAVE, token); } catch { /* sessão só em memória */ }
}
export function limparToken() {
  try { localStorage.removeItem(CHAVE); } catch { /* ignora */ }
}

export class ApiErro extends Error {
  constructor(status, mensagem, campos = {}) {
    super(mensagem);
    this.status = status;
    this.campos = campos;
  }
}

async function requisitar(metodo, caminho, corpo) {
  const token = lerToken();
  const headers = {};
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(BASE + caminho, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
  } catch {
    throw new ApiErro(0, 'Não foi possível conectar ao servidor.');
  }

  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => null);

  // 401 com token enviado = sessão expirada/inválida: faz logout e volta ao login.
  if (resposta.status === 401 && token) {
    aoExpirar();
    throw new ApiErro(401, dados?.erro ?? 'Sessão expirada.');
  }
  if (!resposta.ok) throw new ApiErro(resposta.status, dados?.erro ?? 'Erro inesperado.', dados?.campos ?? {});
  return dados;
}

export const api = {
  get: (caminho) => requisitar('GET', caminho),
  post: (caminho, corpo) => requisitar('POST', caminho, corpo ?? {}),
  put: (caminho, corpo) => requisitar('PUT', caminho, corpo ?? {}),
  delete: (caminho) => requisitar('DELETE', caminho),
};
