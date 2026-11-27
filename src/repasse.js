// ============================================================
//  O REPASSE DO CLIENTE (27/11)
//
//  Pedido do Rodrigo: "Todos os clientes que tiverem repasse precisa aparecer
//  ao abrir a conversa, informando que tem repasse pendente e o valor do
//  repasse." O repasse é a DESPESA EM ABERTO da aba Andon do Vantoro, e a
//  ficha completa do cliente (`GET /vantoro/cliente/:id`, a `_ficha` de lá)
//  manda `repasse: { estado, aberto, pago }` desde o Vantoro 598.
//
//  Sem o Andon configurado, ou com ele fora do ar, `repasse` vem nulo: a
//  faixa não aparece. A falta do aviso não pode ser lida como "não tem
//  repasse", e por isso a faixa só fala do que o Vantoro afirmou.
//
//  UMA IDA POR CLIENTE A CADA CINCO MINUTOS, como a ficha: quem atende volta
//  à mesma conversa várias vezes, e o Vantoro fica atrás da ponte, que
//  hiberna. E duas aberturas juntas esperam a mesma ida.
// ============================================================
// Quem pergunta é o Painel (`chamarPonte`): este arquivo não importa a ponte,
// e por isso a prova lê as contas daqui sem montar o cliente do Supabase.

const VALIDADE_MS = 5 * 60 * 1000;
const guardados = new Map();   // id do cliente → { quando, repasse }
const emVoo = new Map();       // id do cliente → promessa

export function lerRepasse(clienteId, perguntar) {
  const chave = String(clienteId);
  const linha = guardados.get(chave);
  if (linha && Date.now() - linha.quando <= VALIDADE_MS) return Promise.resolve(linha.repasse);
  if (emVoo.has(chave)) return emVoo.get(chave);
  const promessa = perguntar(chave)
    .then((r) => {
      const repasse = (r && r.cliente && r.cliente.repasse) || null;
      guardados.set(chave, { quando: Date.now(), repasse });
      return repasse;
    })
    .finally(() => emVoo.delete(chave));
  emVoo.set(chave, promessa);
  return promessa;
}

export function esquecerRepasses() { guardados.clear(); emVoo.clear(); }

// O valor em reais, como o escritório escreve: "R$ 1.234,56".
export function valorEmReais(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// O que a faixa diz, ou nulo quando ela não aparece: só com o repasse EM
// ABERTO e um valor de verdade. O pago não ganha faixa (é a etiqueta "Repasse
// pago" que diz isso), e o nulo é "não sei", e não "não tem".
export function avisoDoRepasse(repasse) {
  if (!repasse || repasse.estado !== "aberto") return null;
  const valor = Number(repasse.aberto);
  if (!Number.isFinite(valor) || valor <= 0.005) return null;
  return { valor: valorEmReais(valor) };
}
