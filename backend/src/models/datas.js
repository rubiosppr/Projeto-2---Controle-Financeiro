const pad = (n) => String(n).padStart(2, '0');
const paraUTC = (s) => {
  const [a, m, d] = s.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
};
const deUTC = (ms) => new Date(ms).toISOString().slice(0, 10);

export function dataValida(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [a, m, d] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d));
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

export const somarDias = (s, n) => deUTC(paraUTC(s) + n * 86400000);
export const diasEntre = (a, b) => Math.round((paraUTC(b) - paraUTC(a)) / 86400000);

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Primeiro e último dia do mês da data informada (padrão: hoje)
export function mesCorrente(data = hojeISO()) {
  const [a, m] = data.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return { inicio: `${a}-${pad(m)}-01`, fim: `${a}-${pad(m)}-${pad(ultimo)}` };
}

export function somarMeses(anoMes, n) {
  const [a, m] = anoMes.split('-').map(Number);
  const total = a * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

// Mês inteiro -> mês anterior inteiro; intervalo livre -> mesmo tamanho imediatamente antes.
export function periodoAnterior(inicio, fim) {
  const [a, m, d] = inicio.split('-').map(Number);
  if (d === 1 && fim === mesCorrente(inicio).fim) {
    return mesCorrente(`${somarMeses(`${a}-${pad(m)}`, -1)}-01`);
  }
  const dias = diasEntre(inicio, fim) + 1;
  const anteriorFim = somarDias(inicio, -1);
  return { inicio: somarDias(anteriorFim, -(dias - 1)), fim: anteriorFim };
}
