export const paraCentavos = (v) => Math.round(Number(v) * 100);
export const deCentavos = (c) => c / 100;
export const arredondar = (n) => Math.round(Number(n) * 100) / 100;

export const somarValores = (valores) =>
  deCentavos(valores.reduce((soma, v) => soma + paraCentavos(v), 0));

export const percentual = (parte, total) =>
  total === 0 ? 0 : Math.round((parte / total) * 10000) / 100;

// Divide em centavos; a diferença de arredondamento vai para a primeira parcela.
export function dividirParcelas(valor, n) {
  const total = paraCentavos(valor);
  const base = Math.floor(total / n);
  const resto = total - base * n;
  return Array.from({ length: n }, (_, i) => deCentavos(i === 0 ? base + resto : base));
}
