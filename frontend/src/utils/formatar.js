const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const pad = (n) => String(n).padStart(2, '0');

export const moeda = (v) => brl.format(Number(v ?? 0));

export function dataBR(iso) {
  if (!iso) return '';
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

export function hojeISO() {
  const h = new Date();
  return `${h.getFullYear()}-${pad(h.getMonth() + 1)}-${pad(h.getDate())}`;
}

export function mesAtual() {
  const h = new Date();
  const a = h.getFullYear();
  const m = h.getMonth();
  const ultimo = new Date(a, m + 1, 0).getDate();
  return { inicio: `${a}-${pad(m + 1)}-01`, fim: `${a}-${pad(m + 1)}-${pad(ultimo)}` };
}

export const percentual = (v) => `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;

export function mesExtenso(anoMes) {
  const [a, m] = anoMes.split('-').map(Number);
  return new Date(a, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}
