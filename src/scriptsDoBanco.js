import { chamarPonte } from "./ponte.js";

// ============================================================
//  AS ATUALIZAÇÕES DO BANCO — o que a ponte fez ao subir
//
//  Desde 08/10 a ponte aplica sozinha os scripts de `sql/automaticos/` quando
//  sobe (ver "Os scripts que se aplicam sozinhos" no CLAUDE.md da ponte). Até
//  ali, todo script era colado à mão pelo Rodrigo, e a resposta de "deu
//  certo?" era a última linha que ele via no editor da Supabase. Agora ninguém
//  vê o script rodar — e o log da ponte é o lugar onde este projeto já perdeu
//  dois avisos importantes.
//
//  Então quem administra lê aqui: numa aba própria de "Departamentos e
//  acessos", e numa linha da faixa vermelha quando há algo a fazer.
//
//  ------------------------------------------------------------
//  QUEM RESPONDE É A PONTE (`GET /scripts/estado`), e não o banco
//
//  Os defeitos mais prováveis aqui — a senha do banco errada, o endereço
//  errado — acontecem ANTES de a ponte alcançar o banco. O banco não tem como
//  contar o que nunca chegou a ele.
//
//  ------------------------------------------------------------
//  NÃO CONSEGUIR PERGUNTAR NÃO É "ESTÁ TUDO BEM"
//
//  É a armadilha nº 2 com outra roupa. A falha da pergunta vira uma frase na
//  aba, e nunca "em dia" nem "desligada" — e a faixa não acende por ela: a
//  ponte fora do ar já tem os avisos dela, e esta é uma pergunta de
//  administração, não de atendimento.
// ============================================================

/** Pergunta à ponte. Nunca lança: devolve `{ estado }` ou `{ erro, semARota }`. */
export async function perguntarOsScripts() {
  try {
    // Vinte segundos, e não os trinta de sempre: é uma pergunta de fundo, e
    // não pode segurar nada. A ponte que hiberna acorda com o `/ping` da tela.
    const corpo = await chamarPonte("/scripts/estado", { espera: 20000 });
    // RESPONDEU, MAS NÃO ISTO: uma ponte de antes desta tela, atrás de algo
    // que devolve a própria página para endereço que não conhece. Sem
    // `situacao` não há estado nenhum para desenhar — e desenhar um vazio
    // seria a tela dizendo coisa que ninguém disse.
    if (!corpo || typeof corpo.situacao !== "string") {
      return { erro: "a ponte não respondeu com o estado das atualizações", semARota: true };
    }
    // A VERSÃO DA PONTE, CONFERIDA NO GITHUB — ver "QUAL PONTE ESTÁ NO AR",
    // mais abaixo. Ponte sem a versão nem pergunta. E o `.catch` é guarda: um
    // tropeço ali, subindo, cairia no `catch` de baixo e viraria "não consegui
    // perguntar à ponte" — uma frase sobre a pergunta que deu certo.
    const noGitHub = await conferirNoGitHub(corpo.versao)
      .catch(() => ({ situacao: "erro", erro: "a conferência no GitHub tropeçou" }));
    return { estado: noGitHub ? { ...corpo, noGitHub } : corpo };
  } catch (e) {
    // 404 é a ponte de ANTES desta tela — uma publicação no meio do caminho,
    // com o painel novo e a ponte velha. Não é falha de nada: só não há o
    // que perguntar ainda.
    return { erro: (e && e.message) || String(e), semARota: Boolean(e && e.status === 404) };
  }
}

// O RÓTULO E O TOM DE CADA SITUAÇÃO. Uma tabela só, porque a aba e a faixa
// falam das mesmas situações — e duas escritas divergiriam na primeira
// situação nova.
const SITUACOES = {
  desligado:      { rotulo: "Desligada", tom: "neutro" },
  rodando:        { rotulo: "Conferindo agora", tom: "neutro" },
  em_dia:         { rotulo: "Em dia", tom: "bom" },
  pendentes:      { rotulo: "Esperando", tom: "atencao" },
  outra_ponte:    { rotulo: "Esperando a outra ponte", tom: "neutro" },
  falhou:         { rotulo: "Falhou", tom: "ruim" },
  mudou:          { rotulo: "Parada", tom: "ruim" },
  sem_marco:      { rotulo: "Esperando configuração", tom: "ruim" },
  marco_invalido: { rotulo: "Configuração errada", tom: "ruim" },
  nao_conectou:   { rotulo: "Sem falar com o banco", tom: "ruim" },
  sem_pg:         { rotulo: "Sem a biblioteca do banco", tom: "ruim" },
};

export function comoDizerASituacao(situacao) {
  return SITUACOES[situacao] || { rotulo: String(situacao || "?"), tom: "neutro" };
}

// "021-o-que-faz.sql" → "021". Para a faixa e para a aba, que precisam ser curtas.
export function numeroDe(nome) {
  const m = /^(\d+)/.exec(String(nome || ""));
  return m ? m[1] : String(nome || "");
}

/** Os scripts que entraram NESTA subida e cuja conferência não fechou. */
export function conferenciasQueNaoFecharamAgora(estado) {
  if (!estado) return [];
  const nesta = new Set(estado.nesta_subida || []);
  return (estado.alertas || []).filter((n) => nesta.has(n));
}

// ============================================================
//  A LINHA DA FAIXA VERMELHA — só para quem administra, e só quando há o que
//  fazer.
//
//  "Em dia", "desligada", "conferindo" e "esperando a outra ponte" não acendem
//  nada: alarme que não pede ação se aprende a ignorar, e aí o próximo passa
//  batido junto. A conferência que não fechou acende só pelo script que
//  entrou NESTA subida — o de antes já foi dito, e continua marcado na aba.
// ============================================================
export function fraseDosScriptsParaAFaixa(estado) {
  if (!estado || !estado.situacao) return null;
  // A PONTE DESATUALIZADA VEM PRIMEIRO: com ela, o resto da aba fala de uma
  // ponte velha — "em dia" é em dia com ELA —, e publicar pode resolver o resto.
  const atraso = fraseDaPublicacao(estado.noGitHub);
  if (atraso) return atraso;
  const pendentes = estado.pendentes || [];
  switch (estado.situacao) {
    case "falhou":
      return pendentes.length
        ? `A atualização ${numeroDe(pendentes[0])} do banco falhou e não entrou. O resto do Zorvin segue funcionando.`
        : "A rodada das atualizações do banco falhou. O resto do Zorvin segue funcionando.";
    case "mudou":
      return "As atualizações do banco pararam: um script que já tinha entrado foi alterado depois.";
    case "sem_marco":
      return "As atualizações automáticas do banco estão esperando uma configuração na Render (SCRIPTS_RODADOS_A_MAO).";
    case "marco_invalido":
      return "SCRIPTS_RODADOS_A_MAO, na Render, está com um valor que a ponte não reconhece — nenhuma atualização do banco entrou.";
    case "nao_conectou":
      return estado.proxima_tentativa
        ? "A ponte não conseguiu falar com o banco para aplicar as atualizações. Ela tenta de novo sozinha."
        : "A ponte não conseguiu falar com o banco para aplicar as atualizações.";
    case "sem_pg":
      return "A ponte desta publicação não tem como falar com o banco: falta a biblioteca dele.";
    case "pendentes":
      return pendentes.length === 1
        ? `A atualização ${numeroDe(pendentes[0])} do banco está esperando: a ponte só está conferindo.`
        : `${pendentes.length} atualizações do banco estão esperando: a ponte só está conferindo.`;
    default: {
      const preocupam = conferenciasQueNaoFecharamAgora(estado);
      if (!preocupam.length) return null;
      return preocupam.length === 1
        ? `A atualização ${numeroDe(preocupam[0])} do banco entrou, mas a conferência dela diz que algo não ficou como devia.`
        : `${preocupam.length} atualizações do banco entraram, mas a conferência delas diz que algo não ficou como devia.`;
    }
  }
}

// O QUE NUMA CONFERÊNCIA QUER DIZER "NÃO FICOU COMO DEVIA" — a mesma régua da
// ponte (`conferenciaPreocupa`), aplicada a UM valor, para a aba pintar a
// célula certa. A lista de quais scripts preocupam vem pronta da ponte.
export function valorPreocupa(v) {
  if (v === false) return true;
  if (typeof v !== "string") return false;
  return /^\s*false\s*$/i.test(v) || /^\s*n[ãaÃA]o\b/i.test(v) || /^\s*rode o script/i.test(v);
}

// "08/10 às 14:32", no relógio de quem lê. A ponte e o GitHub mandam a hora em
// ISO de propósito: escrita lá, sairia no fuso da Render. Uma escrita só, para
// a aba e para a faixa.
export function quandoLegivel(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(d.getDate())}/${dois(d.getMonth() + 1)} às ${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

// ============================================================
//  QUAL PONTE ESTÁ NO AR — conferida no GitHub (15/10)
//
//  Em 14/10 três PRs da ponte foram mesclados e a Render não publicou nenhum.
//  Esta aba dizia "Em dia", e estava certa para a ponte que estava no ar, que
//  não conhecia script nenhum depois do 024. O Rodrigo só descobriu na manhã
//  seguinte, pela lista do "Já tratei" na ordem antiga. Já tinha acontecido
//  em 20/08.
//
//  A ponte diz qual versão ela é (`versao`, em `GET /scripts/estado`), e o
//  PAINEL pergunta ao GitHub quais são as mais novas do ramo dela. O
//  repositório é público. Quem pergunta é o navegador de quem administra, e
//  não a ponte: o GitHub limita as perguntas sem senha POR ENDEREÇO, e a
//  Render sai para a internet por endereços que muitos serviços dividem.
//
//  UMA PERGUNTA SÓ, e pequena: as últimas versões do ramo, sem os arquivos.
//  É nela que se acha a versão no ar, o que veio depois dela, e quando.
//
//  O GITHUB QUE NÃO RESPONDE NÃO VIRA "A MAIS NOVA" — a armadilha nº 2 com
//  outra roupa. A aba diz que não conseguiu conferir; a faixa não acende por
//  isso, nem apaga o que já sabia (`manterOQueSeSabia`).
// ============================================================

// VINTE MINUTOS DEPOIS DO MERGE. A ponte leva poucos minutos para publicar
// (instalar e subir); antes disso, estar atrás do GitHub é o normal de toda
// entrega, e acender a faixa ali seria o alarme que se aprende a ignorar.
export const MINUTOS_PARA_PUBLICAR = 20;
const VERSOES_OLHADAS = 20;

/**
 * Acha a versão da ponte entre as últimas do GitHub. Nunca lança. Devolve
 * `null` quando não há o que comparar (a ponte de antes desta linha, ou fora
 * da Render), ou `{ situacao }`: "a_mais_nova", "atras" (com `novas`, da mais
 * nova para a mais velha), "fora_da_lista" (mais velha que todas as olhadas)
 * ou "erro" (com a frase).
 */
export async function conferirNoGitHub(versao) {
  const commit = versao && typeof versao.commit === "string" ? versao.commit.trim().toLowerCase() : "";
  const repositorio = versao && typeof versao.repositorio === "string" ? versao.repositorio.trim() : "";
  if (!/^[0-9a-f]{7,40}$/.test(commit) || !/^[\w.-]+\/[\w.-]+$/.test(repositorio)) return null;
  const ramo = versao.ramo ? `&sha=${encodeURIComponent(versao.ramo)}` : "";
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), 10000);
  let resp;
  try {
    resp = await fetch(`https://api.github.com/repos/${repositorio}/commits?per_page=${VERSOES_OLHADAS}${ramo}`,
      { signal: parar.signal });
  } catch (_e) {
    return { situacao: "erro", erro: "não consegui falar com o GitHub" };
  } finally {
    clearTimeout(relogio);
  }
  if (!resp.ok) {
    const limitado = (resp.status === 403 || resp.status === 429)
      && resp.headers.get("x-ratelimit-remaining") === "0";
    return { situacao: "erro", erro: limitado
      ? "o GitHub limitou as perguntas deste endereço por agora"
      : resp.status === 404
        ? "o GitHub não achou o repositório (ele pode ser privado)"
        : `o GitHub respondeu ${resp.status}` };
  }
  const lista = await resp.json().catch(() => null);
  if (!Array.isArray(lista) || !lista.length) {
    return { situacao: "erro", erro: "o GitHub respondeu sem a lista de versões" };
  }
  const versoes = lista.map((c) => {
    const dados = (c && c.commit) || {};
    return {
      sha: String((c && c.sha) || "").toLowerCase(),
      titulo: String(dados.message || "").split("\n")[0].trim(),
      // A HORA EM QUE ENTROU NO RAMO: no merge pelo GitHub, quem assina como
      // "committer" é ele, na hora do merge. A do autor é a de quando a
      // mudança foi escrita, que pode ser dias antes.
      quando: (dados.committer && dados.committer.date) || (dados.author && dados.author.date) || null,
    };
  });
  // O commit vem INTEIRO da Render; o começo só vale para quem o mande curto.
  const i = versoes.findIndex((v) => v.sha === commit || (commit.length < 40 && v.sha.startsWith(commit)));
  if (i === 0) return { situacao: "a_mais_nova", no_ar: versoes[0] };
  if (i > 0) return { situacao: "atras", no_ar: versoes[i], novas: versoes.slice(0, i) };
  return { situacao: "fora_da_lista", novas: versoes };
}

/** A primeira versão que não está no ar — a mais velha das novas. */
export function primeiraQueFalta(noGitHub) {
  const novas = (noGitHub && noGitHub.novas) || [];
  return novas.length ? novas[novas.length - 1] : null;
}

/** Há versão mais nova no GitHub há mais de MINUTOS_PARA_PUBLICAR? */
export function publicacaoAtrasada(noGitHub, agora = Date.now()) {
  if (!noGitHub || (noGitHub.situacao !== "atras" && noGitHub.situacao !== "fora_da_lista")) return false;
  const primeira = primeiraQueFalta(noGitHub);
  const t = primeira ? Date.parse(primeira.quando) : NaN;
  // SEM A HORA, NÃO SE ACUSA: atrás do GitHub sem saber desde quando pode ser
  // a entrega de agora, que a Render ainda está publicando.
  if (isNaN(t)) return false;
  // A PRIMEIRA que falta, e não a mais nova: com duas entregas seguidas, a
  // segunda recém-mesclada esconderia a primeira, que já devia estar no ar.
  return agora - t > MINUTOS_PARA_PUBLICAR * 60 * 1000;
}

/** A linha da faixa vermelha, ou `null`. */
export function fraseDaPublicacao(noGitHub, agora = Date.now()) {
  if (!publicacaoAtrasada(noGitHub, agora)) return null;
  const novas = noGitHub.novas || [];
  if (noGitHub.situacao === "fora_da_lista") {
    return `A ponte no ar é mais antiga que as ${novas.length} últimas versões do GitHub: a Render não publicou as novas.`;
  }
  const quando = quandoLegivel(primeiraQueFalta(noGitHub).quando);
  return novas.length === 1
    ? `A versão nova da ponte, mesclada em ${quando}, não está no ar: a Render não publicou.`
    : `${novas.length} versões novas da ponte não estão no ar — a primeira foi mesclada em ${quando}, e a Render não publicou.`;
}

/**
 * O GITHUB QUE FALHA NÃO APAGA O QUE JÁ SE SABIA — da MESMA ponte. A régua da
 * faixa: ela não acende por uma pergunta que falhou, nem apaga por uma. Com a
 * ponte trocada (publicou!), o que se sabia era da outra, e não serve mais.
 */
export function manterOQueSeSabia(antes, agora) {
  if (!antes || !agora) return agora;
  const g = agora.noGitHub;
  const g0 = antes.noGitHub;
  const mesmaPonte = Boolean(antes.versao && agora.versao && antes.versao.commit
    && antes.versao.commit === agora.versao.commit);
  if (g && g.situacao === "erro" && g0 && g0.situacao !== "erro" && mesmaPonte) {
    return { ...agora, noGitHub: g0 };
  }
  return agora;
}
