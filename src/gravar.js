// GRAVAR NUM BANCO QUE PODE NÃO TER TODAS AS COLUNAS.
//
// O painel é escrito para não quebrar quando um SQL ainda não foi rodado: se a
// coluna não existe, grava sem ela e segue. A intenção é boa e o jeito como
// isso vinha sendo feito custou um recurso inteiro, em silêncio, por semanas.
//
// COMO ERA, no `enviarNota`:
//
//     insert({ conversa_id, texto, autor, autor_foto, autor_id, ...processo })
//     if (erro fala de processo_reu)          insert(... sem o réu)
//     if (erro fala de processo_id/numero)    insert(... sem o processo)
//     if (erro fala de autor_id)              insert({ conversa_id, texto, autor, autor_foto })
//     if (erro fala de autor_foto)            insert({ conversa_id, texto, autor })
//
// Cada queda REMONTA a linha do zero. A última foi escrita para resolver a
// falta de UMA coluna e joga fora QUATRO — o `autor_foto` que falta, o
// `autor_id` que existe, e as três do processo.
//
// O QUE ISSO CUSTOU, medido no banco do escritório em 01/09/2026: a coluna
// `notas.autor_foto` nunca existiu ali. Logo, TODA nota caía na última queda.
// De 289 notas, ZERO tinham processo vinculado — e a equipe escolhia o
// processo, via o seletor ficar âmbar, e a escolha era descartada sem uma
// palavra. O recurso existia, era usado, e nunca funcionou uma vez sequer.
//
// A DIFERENÇA AQUI É DE PRINCÍPIO: tira-se do pedido EXATAMENTE a coluna que o
// banco disse que não tem, e tudo o mais continua. E quem chamou fica sabendo o
// que foi tirado, para poder avisar a pessoa quando o que se perdeu importava.

/** O nome da coluna que o banco disse não existir — ou `null`.
 *
 *  Duas formas, porque há dois mensageiros:
 *
 *    PostgREST  Could not find the 'autor_foto' column of 'notas' in the
 *               schema cache                                    (PGRST204)
 *    Postgres   column "autor_foto" of relation "notas" does not exist  (42703)
 *
 *  Ler o NOME, e não só reconhecer que houve um erro, é o que permite tirar uma
 *  coluna em vez de desistir de todas. */
export function colunaQueFalta(erro) {
  if (!erro) return null;
  const msg = String(erro.message || "") + " " + String(erro.details || "");
  const aspaSimples = /'([A-Za-z0-9_]+)'\s+column/.exec(msg);
  if (aspaSimples) return aspaSimples[1];
  const aspaDupla = /column\s+"([A-Za-z0-9_]+)"/.exec(msg);
  if (aspaDupla) return aspaDupla[1];
  return null;
}

/** Grava tentando de novo SEM a coluna que faltar, uma de cada vez.
 *
 *  `gravar` recebe a linha e devolve `{ data, error }` — é uma função para o
 *  chamador poder decidir o que pedir de volta (`.select("id").single()` e
 *  afins) sem este módulo precisar conhecer o cliente do banco.
 *
 *  `opcionais` é a lista do que PODE faltar. O que não estiver nela é
 *  essencial: se o banco disser que `texto` não existe, isto NÃO grava uma nota
 *  sem texto — devolve o erro. Uma tolerância sem lista vira um gravador que
 *  aceita salvar qualquer coisa, inclusive nada.
 *
 *  Devolve `{ data, error, perdidas }`. `perdidas` é o que foi tirado, e existe
 *  para quem chamou poder AVISAR: uma escolha da pessoa que não coube no banco
 *  não pode sumir calada — foi assim que o vínculo com o processo passou
 *  semanas sendo descartado sem ninguém saber. */
export async function gravarSemAsQueFaltam(gravar, linha, opcionais = [], lembrete = null) {
  const restante = { ...linha };
  const perdidas = [];
  const podeSair = new Set(opcionais);
  // O QUE JÁ SE SABE QUE NÃO EXISTE não é pedido de novo.
  //
  // Sem isto, a primeira gravação SEMPRE falha e a segunda sempre passa: duas
  // idas ao banco por nota, para sempre, e uma linha de erro no registro do
  // Postgres a cada uma. Um dia de escritório são centenas delas — no mesmo
  // lugar onde um erro DE VERDADE precisaria ser visto.
  //
  // O lembrete vale só para esta sessão: quem rodar o SQL que falta e apertar
  // F5 volta a ter a coluna, sem ninguém precisar mexer em nada.
  if (lembrete) {
    for (const coluna of lembrete) {
      if (coluna in restante) { delete restante[coluna]; perdidas.push(coluna); }
    }
  }
  // No máximo uma volta por coluna opcional, mais a primeira tentativa. Um
  // `while (true)` aqui rodaria para sempre no dia em que o banco devolvesse
  // sempre o mesmo nome — e um laço infinito dentro de "enviar uma nota"
  // trava a aba de quem só queria anotar um recado.
  for (let tentativa = 0; tentativa <= opcionais.length; tentativa++) {
    const r = await gravar(restante);
    if (!r || !r.error) return { ...(r || {}), perdidas };
    const coluna = colunaQueFalta(r.error);
    // Erro que não é "falta coluna", ou coluna que NÃO pode sair, ou que já
    // não está no pedido: não há o que tentar de novo. Devolve o erro como
    // veio, para quem chamou tratá-lo.
    if (!coluna || !podeSair.has(coluna) || !(coluna in restante)) {
      return { ...r, perdidas };
    }
    delete restante[coluna];
    perdidas.push(coluna);
    if (lembrete) lembrete.add(coluna);
  }
  return { data: null, perdidas,
           error: { message: `Não consegui gravar mesmo depois de tirar ${perdidas.join(", ")}.` } };
}

// ============================================================
//  GRAVOU MESMO? — a pergunta que o Supabase não responde sozinho
//
//  RELATO DO ESCRITÓRIO, 24/09: "quando salvo o nome do cliente não fica
//  salvo", "não estão sendo salvos novos contatos", "aperto em fazer
//  pré-cadastro e a ficha não aparece". Três sintomas, uma forma só.
//
//  ------------------------------------------------------------
//  UM `UPDATE` BARRADO PELA RLS NÃO DEVOLVE ERRO
//
//  Ele não é recusado: é FILTRADO. A regra de acesso entra como um `where` a
//  mais, nenhuma linha casa, e o banco responde "pronto, atualizei zero
//  linhas" — com `error` nulo. Quem só olha o `error` conclui que deu certo.
//
//  No `insert` é diferente: ali a RLS levanta erro (42501). Por isso o defeito
//  aparece justamente em quem EDITA, e não em quem cria — e por isso ele passa
//  despercebido em revisão de código, onde os dois se parecem.
//
//  ------------------------------------------------------------
//  O CUSTO DISSO, MEDIDO NO RELATO
//
//  As três telas seguiam em frente como se tivessem gravado: uma mostrava o
//  nome novo (e ele sumia no F5), outra escrevia "Contato salvo!", e a terceira
//  dava o pré-cadastro por ligado ao contato. A tela AFIRMAVA o contrário do
//  que estava no banco — que é pior do que não dizer nada, porque ninguém vai
//  conferir o que a tela acabou de garantir.
//
//  ------------------------------------------------------------
//  COMO SE PERGUNTA
//
//  Pedindo `.select("id")` junto da gravação, a resposta traz as linhas que
//  ELA mexeu. Não é uma ida a mais à rede — é a mesma, dizendo o que fez.
//
//    const r = await supabase.from("contatos")
//      .update({ nome }).eq("id", id).select("id");
//    if (naoGravouNada(r)) { ...a tela diz que não conseguiu... }
//
//  SEM `.single()`, de propósito: ele transforma "zero linhas" num ERRO
//  (PGRST116), misturando "o banco recusou" com "a rede caiu" — e as duas
//  pedem frases diferentes de quem lê. Aqui o `error` continua sendo só erro,
//  e a lista vazia é só recusa.
//
//  ------------------------------------------------------------
//  E O `DELETE` FALHA EXATAMENTE DO MESMO JEITO
//
//  A regra de acesso entra como um `where` a mais no DELETE também: nenhuma
//  linha casa, zero linhas saem, `error` nulo. A diferença é o que a pessoa
//  vê — o que ela mandou apagar VOLTA na releitura seguinte, sem uma palavra.
//  Apagar uma etiqueta, uma resposta pronta ou uma nota cai aqui, e por isso
//  esta pergunta vale para as duas gravações, e não só para o `update`.
// ============================================================

/** A gravação voltou sem erro e sem ter mexido em nenhuma linha?
 *
 *  `true` quer dizer: o banco atendeu o pedido e não alterou nada — quase
 *  sempre a RLS filtrando. Quem chama não deve seguir como se tivesse gravado.
 *
 *  Só responde `true` no caso EXATO. Havendo erro, quem chama já o trata; não
 *  tendo `data` (quem esqueceu o `.select`), esta função não inventa uma
 *  recusa que não sabe se houve. */
export function naoGravouNada(resposta) {
  if (!resposta || resposta.error) return false;
  return Array.isArray(resposta.data) && resposta.data.length === 0;
}
