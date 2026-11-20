import { randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { pool, transacao } from '../src/config/db.js';
import * as Usuario from '../src/models/usuario.js';
import * as Categoria from '../src/models/categoria.js';
import * as FonteDestino from '../src/models/fonteDestino.js';
import { arredondar, dividirParcelas } from '../src/models/dinheiro.js';

const SENHA = 'Senha1234';
const USUARIOS = [
  { nome: 'Ana Souza', email: 'ana@exemplo.com', cpf: '12345678909', fator: 1 },
  { nome: 'Bruno Lima', email: 'bruno@exemplo.com', cpf: '98765432100', fator: 0.7 },
];
const MESES_ATRAS = [3, 2, 1, 0];

const hoje = new Date();
const pad = (n) => String(n).padStart(2, '0');

// Data `meses` meses atrás; no mês corrente nunca passa de hoje.
function data(meses, dia) {
  const ref = new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1);
  const ultimo = new Date(ref.getFullYear(), ref.getMonth() + 1, 0).getDate();
  const limite = meses === 0 ? Math.min(ultimo, hoje.getDate()) : ultimo;
  return `${ref.getFullYear()}-${pad(ref.getMonth() + 1)}-${pad(Math.min(dia, limite))}`;
}

// [diaDoMes, tipo, descrição, valor, categoria, fonte]
const MENSAIS = [
  [5, 'entrada', 'Salário', 5000, 'Salário', 'Salário'],
  [10, 'saida', 'Aluguel', 1500, 'Moradia', 'Conta corrente'],
  [8, 'saida', 'Mercado', 420.75, 'Alimentação', 'Nubank'],
  [22, 'saida', 'Mercado', 380.1, 'Alimentação', 'Nubank'],
  [12, 'saida', 'Uber', 85.9, 'Mobilidade', 'Nubank'],
  [18, 'saida', 'Cinema', 64, 'Lazer', 'Visa'],
  [25, 'saida', 'Farmácia', 129.9, 'Saúde', 'Conta corrente'],
  [3, 'saida', 'Streaming (dia do fechamento)', 39.9, 'Lazer', 'Nubank'],
  [25, 'saida', 'Combustível (dia do fechamento)', 200, 'Mobilidade', 'Visa'],
];

async function semear(client, u) {
  await client.query('DELETE FROM usuarios WHERE email = $1', [u.email]);
  const senhaHash = await bcrypt.hash(SENHA, 10);
  const usuario = await Usuario.criar({ nome: u.nome, email: u.email, cpf: u.cpf, senhaHash }, client);
  await Categoria.criarPadrao(usuario.id, client);
  await FonteDestino.criarPadrao(usuario.id, client);

  const novaFonte = (nome, tipo, extra = {}) => client.query(
    `INSERT INTO fontes_destinos (usuario_id, nome, tipo, dia_fechamento, dia_vencimento, limite, reserva)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [usuario.id, nome, tipo, extra.fecha ?? null, extra.vence ?? null, extra.limite ?? null, extra.reserva ?? false]);
  await novaFonte('Salário', 'renda');
  await novaFonte('Poupança', 'conta', { reserva: true });
  await novaFonte('Nubank', 'cartao_credito', { fecha: 3, vence: 10, limite: 5000 });
  await novaFonte('Visa', 'cartao_credito', { fecha: 25, vence: 5, limite: 3000 });

  const { rows: cats } = await client.query('SELECT id, nome, tipo FROM categorias WHERE usuario_id = $1', [usuario.id]);
  const { rows: fontes } = await client.query('SELECT id, nome FROM fontes_destinos WHERE usuario_id = $1', [usuario.id]);
  const cat = (nome, tipo) => cats.find((c) => c.nome === nome && c.tipo === tipo).id;
  const fonte = (nome) => fontes.find((f) => f.nome === nome).id;

  const inserir = (tipo, descricao, valor, dataLanc, categoria, nomeFonte, parcela = 1, total = 1, grupo = null) =>
    client.query(
      `INSERT INTO lancamentos (usuario_id, tipo, descricao, valor, data, categoria_id, fonte_destino_id,
                                parcela_atual, total_parcelas, grupo_parcelamento)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [usuario.id, tipo, descricao, valor, dataLanc, cat(categoria, tipo), fonte(nomeFonte), parcela, total, grupo]);

  for (const meses of MESES_ATRAS) {
    for (const [dia, tipo, descricao, valor, categoria, nomeFonte] of MENSAIS) {
      await inserir(tipo, descricao, arredondar(valor * u.fator), data(meses, dia), categoria, nomeFonte);
    }
  }
  await inserir('entrada', 'Freelance', arredondar(800 * u.fator), data(1, 15), 'Outros', 'Salário');

  // Compras parceladas no cartão (data da compra repetida em todas as parcelas)
  const parcelado = async (descricao, valor, meses, dia, categoria, nomeFonte, n) => {
    const grupo = randomUUID();
    const valores = dividirParcelas(arredondar(valor * u.fator), n);
    for (let i = 0; i < n; i += 1) {
      await inserir('saida', descricao, valores[i], data(meses, dia), categoria, nomeFonte, i + 1, n, grupo);
    }
  };
  await parcelado('Notebook', 3600, 2, 12, 'Educação', 'Nubank', 10);
  await parcelado('Geladeira', 2400, 1, 20, 'Moradia', 'Visa', 6);
}

try {
  await transacao(async (client) => {
    for (const u of USUARIOS) await semear(client, u);
  });
  console.log('Seed concluído. Usuários de demonstração:');
  for (const u of USUARIOS) console.log(`  ${u.email} / ${SENHA}`);
} finally {
  await pool.end();
}
