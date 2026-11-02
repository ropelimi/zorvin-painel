// ============================================================
//  O CAMINHO DO CLIENTE NO FUNIL — a conta, fora da tela
//
//  O banco já guarda cada passo em `zorvin_movimentos` (script 017): de qual
//  etapa para qual, quem e quando. Aqui esses passos viram o que a seção do
//  histórico desenha: um caminho por FUNIL, do mais recente para o mais
//  antigo, e quanto tempo o cliente ficou em cada etapa que deixou.
//
//  POR FUNIL, e não mais por departamento (02/11): desde o script 043 um
//  telefone pode ter o funil dele, e o cliente que fala com o SAC e com as
//  Audiências tem dois caminhos no mesmo departamento. O passo de antes do
//  043 não tem telefone, e é do funil do departamento — que é o que ele era.
//
//  UMA CONTA SÓ, e num arquivo à parte: a tela e a prova leem a mesma. Duas
//  escritas da regra do "ficou N dias" divergiriam no primeiro conserto, e o
//  relatório do funil (script 019) já tem a dele — esta é a mesma régua,
//  aplicada a um cliente.
//
//  O TEMPO NUMA ETAPA é o da ÚLTIMA chegada a ela até a saída, no MESMO
//  funil. O cliente que volta a uma etapa conta só a última passagem
//  ali — e a anterior aparece no seu próprio passo do caminho. Sem chegada
//  conhecida (o caminho começou antes de alguém registrar), o tempo NÃO é
//  inventado: fica nulo, e a tela não diz nada sobre ele.
// ============================================================

export function montarCaminho(movimentos) {
  const porFunil = new Map();
  const crescentes = [...(movimentos || [])]
    .sort((a, b) => new Date(a.quando) - new Date(b.quando));
  for (const m of crescentes) {
    const telefoneId = m.advogado_id ?? null;
    const chave = `${m.departamento_id}|${telefoneId || ""}`;
    let g = porFunil.get(chave);
    if (!g) {
      g = { departamentoId: m.departamento_id, telefoneId, chave, passos: [], chegadas: new Map() };
      porFunil.set(chave, g);
    }
    const de = m.de_etapa == null ? null : String(m.de_etapa);
    const para = m.para_etapa == null ? null : String(m.para_etapa);
    const chegada = de ? g.chegadas.get(de) : null;
    g.passos.push({
      id: m.id,
      tipo: de == null ? "entrou" : (para == null ? "saiu" : "moveu"),
      de, para,
      quem: m.quem ?? null,
      quando: m.quando,
      ficouMs: chegada ? new Date(m.quando) - new Date(chegada) : null,
    });
    if (de) g.chegadas.delete(de);
    if (para) g.chegadas.set(para, m.quando);
  }
  const grupos = [];
  for (const g of porFunil.values()) {
    const ultimo = g.passos[g.passos.length - 1];
    grupos.push({
      departamentoId: g.departamentoId,
      telefoneId: g.telefoneId,
      chave: g.chave,
      // ONDE ESTÁ AGORA: a etapa do último passo, ou fora do funil se o
      // último passo foi uma saída.
      atual: ultimo && ultimo.para ? ultimo.para : null,
      desde: ultimo && ultimo.para ? ultimo.quando : null,
      ultimoEm: ultimo ? ultimo.quando : null,
      passos: g.passos.reverse(),
    });
  }
  // O funil com movimento mais recente primeiro: é onde o cliente está vivo,
  // e é o caminho que quase sempre se procura.
  grupos.sort((a, b) => new Date(b.ultimoEm) - new Date(a.ultimoEm));
  return grupos;
}

// "3 dias", "5 horas", "menos de 1 hora". Dias CHEIOS, e não de calendário:
// aqui a pergunta é quanto tempo ele ficou parado, e não "desde que dia".
export function duracaoLegivel(ms) {
  if (ms == null || !isFinite(ms) || ms < 0) return "";
  const horas = ms / 3600000;
  if (horas < 1) return "menos de 1 hora";
  if (horas < 24) {
    const h = Math.floor(horas);
    return h === 1 ? "1 hora" : `${h} horas`;
  }
  const d = Math.floor(horas / 24);
  return d === 1 ? "1 dia" : `${d} dias`;
}
