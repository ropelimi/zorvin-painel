// AS REGRAS DA BUSCA QUE NÃO PRECISAM DE TELA.
//
// Elas moram aqui por dois motivos: dá para prová-las sem navegador nenhum, e
// cada uma delas já foi, um dia, um defeito relatado pelo escritório.
//
// O RELATO DE 01/09, COM FOTO: "quando faço a busca no Zorvin, continua
// demorando. Agora na verdade nada está sendo encontrado, fica apenas
// 'Procurando…'". A caixa tinha RODRIGO ALVES SOUSA escrito, e a lista estava
// vazia com o "Procurando…" de pé.
//
// "Procurando…" para sempre não é lentidão: é uma espera que não tem fim
// previsto. Ela só acontece quando algum `await` nunca volta — e havia nove
// deles no caminho da busca, nenhum com prazo. Enquanto um pendurasse, o
// `setBuscando(false)` que apaga a frase ficava para trás dele.
//
// E havia o agravante de que ninguém vê: cada letra digitada dispara uma busca
// nova depois de 350ms de pausa. A anterior era IGNORADA — a variável
// `cancelado` fazia a resposta ser descartada —, mas a consulta continuava
// rodando no banco até o fim. Escrever "RODRIGO ALVES SOUSA" com as pausas
// normais de quem digita dispara três ou quatro varreduras da tabela de
// mensagens, todas vivas ao mesmo tempo, disputando as poucas conexões do
// plano. A ÚLTIMA — a única que interessa — é a que espera atrás de todas as
// outras. Quanto mais devagar a pessoa digita, pior fica.
//
// Daqui em diante: toda consulta tem prazo, e busca velha é ABORTADA, e não
// só ignorada.

/** Quanto o Zorvin espera antes de desistir e dizer que desistiu.
 *
 *  Nove segundos por um motivo, e não por gosto: a API do Supabase corta a
 *  consulta em oito. Esperar além disso é esperar por uma resposta que já não
 *  vem — o servidor desistiu primeiro. Um segundo de folga é para o caminho de
 *  volta pela rede. */
export const PRAZO_DA_BUSCA = 9000;

/** A consulta foi INTERROMPIDA por nós — não falhou.
 *
 *  A diferença importa na tela: uma consulta que falhou merece aviso; uma que
 *  nós mesmos cancelamos porque a pessoa digitou outra letra não merece nada.
 *  Avisar sobre ela encheria a tela de erro a cada tecla.
 *
 *  O `postgrest-js` não devolve código nenhum quando aborta (`code: ""`); o que
 *  ele deixa é a palavra "abort" na dica ou na mensagem. Por isso olhamos os
 *  três campos: o formato do erro é dele, e já mudou de versão para versão. */
export function foiAbortada(erro) {
  if (!erro) return false;
  if (erro.name === "AbortError" || erro.code === "ABORT_ERR") return true;
  const texto = `${erro.hint || ""} ${erro.message || ""} ${erro.details || ""}`;
  return /abort/i.test(texto);
}

/** A função `buscar_conversas` não existe nesta base — o SQL não foi rodado.
 *
 *  É o único erro PERMANENTE da lista: enquanto ninguém rodar o arquivo, ela
 *  vai continuar não existindo, e insistir a cada tecla é gastar uma ida ao
 *  banco para ouvir a mesma coisa. Qualquer outro tropeço é passageiro e não
 *  pode aposentar o caminho rápido pelo resto da sessão. */
export function funcaoNaoExiste(erro) {
  if (!erro) return false;
  return /PGRST202/.test(erro.code || "")
      || /Could not find the function/i.test(erro.message || "");
}

/** O termo, sem os caracteres que quebram o `or` do PostgREST.
 *
 *  A vírgula e os parênteses separam condições lá dentro. Deixá-los passar não
 *  devolve "nenhum resultado": devolve ERRO — e a busca inteira morria em
 *  silêncio quando alguém procurava por "(67) 9…", que é como todo mundo
 *  escreve um telefone. */
export function termoSeguro(termo) {
  return String(termo || "").replace(/[,()*]/g, " ").trim();
}

/** As condições do `or` para achar um contato pelos nomes e pelo número.
 *
 *  Uma pessoa tem até três nomes aqui — o que ela deixou no WhatsApp, o do
 *  cadastro do Vantoro e o que a equipe deu — e quem procura digita o que está
 *  lendo na tela. Os três entram.
 *
 *  Os pisos são de propósito: duas letras casam com meio escritório, e três
 *  dígitos de telefone casam com qualquer um. Uma condição inútil aqui não é
 *  só desperdício — ela devolve centenas de linhas que a pessoa vai ter de
 *  peneirar com os olhos. */
export function condicoesDeNome(termo, chave, comNomesDoCadastro = true) {
  const seguro = termoSeguro(termo);
  const digitos = String(chave || "");
  const p = [];
  if (seguro.length >= 3) {
    p.push(`nome.ilike.%${seguro}%`);
    if (comNomesDoCadastro) {
      p.push(`vantoro_nome.ilike.%${seguro}%`);
      p.push(`nome_zorvin.ilike.%${seguro}%`);
    }
  }
  if (digitos.length >= 4) p.push(`numero.ilike.%${digitos}%`);
  return p;
}

/** O que a tela diz quando a busca não veio inteira.
 *
 *  UMA FRASE PARA CADA CASO, porque a decisão de quem lê é diferente em cada
 *  um. "Não consegui completar a busca" dito para os quatro é mentira por
 *  omissão em três deles: os nomes vieram, a lista tem gente, e o aviso dizia
 *  que nada valia. Quem lê isso fecha a busca e vai procurar de outro jeito —
 *  tendo a resposta na tela.
 *
 *  O silêncio (string vazia) é a resposta certa quando nada faltou. */
export function recadoDaBusca({ falhouNome = false, falhouMensagem = false,
                                tempoEsgotado = false, achouAlgo = false } = {}) {
  if (tempoEsgotado) {
    return achouAlgo
      // JÁ HÁ O QUE VER, e o aviso explica só o que pode estar faltando.
      ? "A procura dentro das mensagens passou de 9 segundos e eu parei de esperar. "
        + "O que está aqui veio pelos nomes — pode faltar alguma conversa."
      // SEM CITAR A PALAVRA "Procurando", por mais natural que fosse escrevê-la
      // aqui: é ela que a tela mostra enquanto a busca corre, e é por ela que
      // as provas sabem se a espera acabou. Um aviso que a contém faz a tela
      // dizer "acabou" e "ainda estou procurando" ao mesmo tempo — e foi
      // exatamente isso que a primeira versão desta frase fez.
      : "A busca passou de 9 segundos e eu parei de esperar, para não deixar você "
        + "olhando uma tela que nunca responde. Tente de novo daqui a pouco.";
  }
  if (falhouNome && falhouMensagem) {
    return "Não consegui completar a busca agora. Tente de novo em alguns segundos.";
  }
  if (falhouNome) {
    return "Não consegui procurar pelos nomes agora — o que está aqui veio do texto das conversas.";
  }
  if (falhouMensagem) {
    return "Achei pelos nomes. A procura DENTRO das mensagens não respondeu — pode faltar alguma conversa aqui.";
  }
  return "";
}
