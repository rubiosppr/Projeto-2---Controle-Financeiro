export function mascararCpf(v) {
  const d = String(v).replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

// Digita-se só números; o campo mostra "1.234,56"
export function mascararValor(v) {
  const d = String(v).replace(/\D/g, '');
  if (!d) return '';
  return (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function valorParaNumero(campo) {
  const n = Number(String(campo).replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

export const numeroParaCampo = (n) => mascararValor(String(Math.round(Number(n) * 100)));
