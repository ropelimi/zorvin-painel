// O SELO DA BLINDAGEM NA FICHA DO VANTORO (25/11)
//
// Pedido do Rodrigo: "Preciso de alguma forma saber qual cliente já está
// blindado ou não." A regra é do VANTORO (core/blindagem.py, a tela Blindagem):
// cada ação distribuída do cliente com a procuração específica assinada há
// menos de um ano e JUNTADA no processo. A ficha (`GET /clientes/<id>`) manda a
// aba que a tela de lá mostraria e os números que a explicam; aqui só se
// escreve. Uma segunda conta no Zorvin divergiria da de lá no primeiro ajuste.
//
// Sem `blindagem` na resposta (um Vantoro de antes), nenhum selo: a ausência do
// selo não pode se ler como "não blindado".

const ESTADOS = {
  completa: { tom: "verde", titulo: "Blindagem completa" },
  parcial: { tom: "ambar", titulo: "Blindagem parcial" },
  pendente: { tom: "vermelho", titulo: "Blindagem pendente" },
  sem_acao: { tom: "neutro", titulo: "Sem ação distribuída" },
};

const inteiro = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

/** O que o selo escreve, ou null quando não há o que dizer. */
export function seloDaBlindagem(b) {
  if (!b || typeof b !== "object") return null;
  const estado = ESTADOS[b.estado];
  if (!estado) return null;
  const total = inteiro(b.total), blindadas = inteiro(b.blindadas);
  const faltaJuntar = inteiro(b.falta_juntar), vencidas = inteiro(b.vencidas);
  const semProcuracao = inteiro(b.sem_procuracao);
  let resumo;
  if (b.estado === "completa") {
    resumo = total === 1 ? "a ação com a procuração juntada" : `as ${total} ações com a procuração juntada`;
  } else if (b.estado === "parcial") {
    resumo = `${blindadas} de ${plural(total, "ação blindada", "ações blindadas")}`;
  } else if (b.estado === "pendente") {
    resumo = total === 1 ? "nenhuma procuração na ação" : `nenhuma procuração nas ${total} ações`;
  } else {
    resumo = "nada a blindar por enquanto";
  }
  // O que falta, em partes: é o que diz a quem atende o que pedir ao cliente.
  const partes = [];
  if (b.estado !== "completa" && b.estado !== "sem_acao") {
    if (blindadas) partes.push(plural(blindadas, "blindada", "blindadas"));
    if (faltaJuntar) partes.push(`${plural(faltaJuntar, "assinada", "assinadas")}, falta juntar`);
    if (vencidas) partes.push(`${plural(vencidas, "vencida", "vencidas")} (mais de 1 ano)`);
    if (semProcuracao && b.estado !== "pendente") {
      partes.push(plural(semProcuracao, "sem procuração", "sem procuração"));
    }
  }
  return { estado: b.estado, tom: estado.tom, titulo: estado.titulo, resumo, partes };
}
