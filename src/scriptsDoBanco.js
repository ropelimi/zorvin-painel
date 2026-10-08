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
    return { estado: corpo };
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
