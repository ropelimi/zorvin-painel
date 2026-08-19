// BANCADA — um Supabase de mentira, só para ver a tela funcionando.
//
// Não vai para produção: o `supabase.js` só troca por este quando o Vite roda
// com VITE_BANCADA=1. Serve para reproduzir defeito de tela sem tocar no banco
// de verdade e sem precisar de chave nenhuma.
//
// O ATRASO É DE PROPÓSITO. O "pisca" da contagem só existe na janela entre o
// clique e a resposta da consulta; num banco rápido ela dura poucos quadros e
// escapa da medição. Aqui a busca de conversas demora `ATRASO_CONVERSAS` ms,
// que é o mesmo defeito em câmera lenta.
const ATRASO_CONVERSAS = 700;

// E as MENSAGENS também demoram. Sem isto, a bancada respondia num piscar e a
// tela terminava de montar antes de qualquer rolagem automática acontecer —
// escondendo uma corrida que em produção é ganha pelo lado errado. Foi assim
// que "abrir a conversa na mensagem achada" passou no teste e falhou no uso.
const ATRASO_MENSAGENS = 250;

// O TETO DE LINHAS É DE PROPÓSITO, e é o mesmo da API do Supabase: um `select`
// sem paginação devolve no máximo isto e CALA — não vem erro, não vem aviso,
// vem uma lista curta com cara de lista inteira. Enquanto o painel só lia 120
// mensagens por conversa, isso nunca apareceu. A tela de contagem foi a
// primeira a ler em bloco, e sem este teto aqui ela passava em todos os testes
// da bancada e mentia no banco de verdade.
const LIMITE_LINHAS = 1000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const DEPARTAMENTOS = [
  { id: 1, nome: "Interno", slug: "interno", cor: "#a06cd5", ordem: 1, ativo: true },
  { id: 2, nome: "Comercial", slug: "comercial", cor: "#8a8f98", ordem: 2, ativo: true },
  { id: 3, nome: "Sucesso do Cliente", slug: "sdc", cor: "#0f8a6a", ordem: 3, ativo: true },
  { id: 4, nome: "Audiências", slug: "audiencias", cor: "#d99a1e", ordem: 4, ativo: true },
  { id: 5, nome: "Acordos", slug: "acordos", cor: "#3b82f6", ordem: 5, ativo: true },
  { id: 6, nome: "Subsídio", slug: "subsidio", cor: "#e5573f", ordem: 6, ativo: true },
  { id: 7, nome: "Trabalhista", slug: "trabalhista", cor: "#14b8a6", ordem: 7, ativo: true },
  { id: 8, nome: "Financeiro", slug: "financeiro", cor: "#f59e0b", ordem: 8, ativo: true },
];

// Telefones: o suficiente para haver departamento com um só e com vários.
const ADVOGADOS = [
  { id: "a1", nome: "Dr. Jorge Mesquita", numero: "5511976378160", foto_url: null, departamento_id: 1, ativo: true },
  { id: "a2", nome: "Comercial", numero: "5511993289441", foto_url: null, departamento_id: 2, ativo: true },
  { id: "a3", nome: "SDC CCR", numero: "5511950473857", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a4", nome: "Sucesso do Cliente", numero: "5511995941666", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a5", nome: "SAC", numero: "5511969401932", foto_url: null, departamento_id: 3, ativo: true },
  { id: "a6", nome: "Audiências", numero: "5511913559990", foto_url: null, departamento_id: 4, ativo: true },
  { id: "a7", nome: "Acordos 1", numero: "5511911112222", foto_url: null, departamento_id: 5, ativo: true },
  { id: "a8", nome: "Acordos 2", numero: "5511933334444", foto_url: null, departamento_id: 5, ativo: true },
  { id: "a9", nome: "Subsidio Emenda", numero: "5511992057503", foto_url: null, departamento_id: 6, ativo: true },
  { id: "a10", nome: "Trabalhista", numero: "5511955556666", foto_url: null, departamento_id: 7, ativo: true },
  { id: "a11", nome: "Financeiro", numero: "5511977778888", foto_url: null, departamento_id: 8, ativo: true },
  // MUDO de propósito: nenhuma mensagem. O Painel serve para ver qual número
  // está parado, e um telefone parado só aparece se a tela listar os que estão
  // em zero em vez de só os que tiveram movimento.
  { id: "a12", nome: "Plantão", numero: "5511900001111", foto_url: null, departamento_id: 8, ativo: true },
];

// Quantas conversas NÃO LIDAS cada telefone tem. São números bem diferentes de
// propósito: se o selo mostrar o do vizinho, dá para ver a olho nu.
const NAO_LIDAS = { a1: 3, a2: 5, a3: 26, a4: 1, a5: 12, a6: 6, a7: 9, a8: 2, a9: 8, a10: 4, a11: 7 };

const NOMES = ["ANDRE EUGENIO", "PRISCILA DE JESUS FRANCO", "RODRIGO ALVES SOUSA",
  "MARIA APARECIDA DA SILVA", "JOÃO FERREIRA DO CARMO", "BRUNA FERREIRA SOUZA",
  "CAMILA MARTINS", "LUIZ DOS SANTOS SOARES", "VANESSA ALVES DE JESUS",
  "PEDRO COSTA ALMEIDA", "SIMONE ALVES FILHO", "DÉBORA CARVALHO"];

const CONVERSAS = [];
for (const adv of ADVOGADOS) {
  const naoLidas = NAO_LIDAS[adv.id] || 0;
  // Cada telefone tem 4 conversas a mais do que as não lidas, para a lista
  // nunca ser só o contador.
  for (let i = 0; i < naoLidas + 4; i++) {
    CONVERSAS.push({
      id: `${adv.id}-c${i}`,
      advogado_id: adv.id,
      contato_id: `${adv.id}-ct${i}`,
      nao_lidas: i < naoLidas ? 1 : 0,
      arquivada: false, fixada: false, favorita: false,
      ultima_atividade: new Date(Date.now() - i * 3600e3).toISOString(),
      ultima_mensagem: `Conversa ${i + 1} de ${adv.nome}`,
      frente: null, vantoro_nome: null, digitando_ate: null,
      contato: { nome: `${NOMES[i % NOMES.length]}`, numero: `5511${900000000 + i}`, foto_url: null },
    });
  }
}

// MENSAGENS — e, antes delas, ATENDIMENTOS.
//
// A primeira versão disto tinha 300 mensagens, três autores certinhos e o
// valor "cliente" em `origem`. Passava em tudo e não provava nada: o banco de
// verdade tem MILHARES de linhas, `origem` é "contato", as notas moram noutra
// tabela, e há mensagem enviada que não é de atendente nenhum.
//
// A segunda versão consertou isso e criou outro problema: todas as mensagens
// de uma conversa nasciam no MESMO instante (`Date.now() - (k % 3) * dia`).
// Serve para contar mensagem; não serve para nada que dependa de TEMPO. Numa
// base assim, uma conversa inteira é um atendimento só, o tempo de resposta é
// sempre zero e o mapa de horários tem uma coluna. O Painel novo teria passado
// em todos os testes sem que uma linha dele estivesse certa.
//
// AGORA A BANCADA É CONSTRUÍDA AO CONTRÁRIO: primeiro um ROTEIRO de
// atendimentos — este começou terça às 9h, esperou 15 minutos por resposta,
// teve três idas e vindas, quem atendeu foi a Camila —, e as mensagens NASCEM
// dele. O esperado é o roteiro, e não uma segunda contagem que poderia repetir
// o mesmo engano da primeira.
//
// O que ela continua tendo, porque tudo isso é real:
//
// 1. VOLUME acima do teto de linhas da API do Supabase (ver LIMITE_LINHAS).
// 2. `origem` com os valores REAIS: "contato" e "advogado".
// 3. NOTAS na tabela `notas` — nunca em `mensagens`.
// 4. "WhatsApp" em `enviado_por`: mensagem que saiu pelo aparelho. Não é gente.
// 5. Rótulo de importação assinando mensagem. Também não é gente.
// 6. Atendente antigo sem id, contado só pelo nome.
// 7. Um telefone MUDO, e atendimentos que ninguém respondeu.
const AUTORES = [
  { id: "u1", nome: "Rodrigo Sousa" },
  { id: "u2", nome: "Camila Souza" },
  { id: null, nome: "Atendente Antigo" },   // histórico: só o nome sobrou
];

// RÓTULO QUE NÃO É PESSOA. O importador de histórico assina as mensagens
// enviadas com o nome da LINHA como estava salvo no celular de quem exportou.
// Isso entrava na lista de atendentes como se fosse um colega, e no topo,
// porque são milhares.
const ROTULOS_NAO_PESSOA = ["Cadastro - C&A", "Atendimento Estratégico"];
const APARELHO = { id: null, nome: "WhatsApp", aparelho: true };

// A MESMA JANELA DA FUNÇÃO DE VERDADE. Todo atendimento do roteiro cabe em
// menos de 3 horas e dois atendimentos nunca caem no mesmo dia da mesma
// conversa — então cada um é, de fato, um atendimento só.
const JANELA_H = 6;
const dia = 86400e3;
const MENSAGENS = [];
const NOTAS = [];
const ROTEIRO = [];
// Qual atendimento cada mensagem integra. Fica de fora da linha de `mensagens`
// de propósito: a tabela de verdade não tem esta coluna, e o painel não pode
// aprender a depender dela.
const ATEND_DA_MSG = new Map();

// Espera (segundos) até a primeira resposta, e tempo de cada resposta seguinte.
// Listas fixas: o teste precisa de mediana previsível, e `Math.random()` faria
// a bancada mudar de resposta entre duas execuções do mesmo teste.
const ESPERAS = [60, 300, 900, 1800, 3600];
const RESPOSTAS = [30, 120, 600, 1500];

/** Um instante a `dias` atrás, na `hora` cheia, no relógio de quem está
    olhando — que é o mesmo relógio que o teste usa para conferir. */
function quando(dias, hora) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  d.setHours(hora, 0, 0, 0);
  return d;
}

/** Escreve um atendimento no roteiro E as mensagens dele. */
function atendimento({ adv, conversa, dias, hora, autor, espera, pares, resposta }) {
  const idx = ROTEIRO.length;
  const t0 = quando(dias, hora).getTime();
  const põe = (origem, quem, t) => {
    const id = `m-${idx}-${MENSAGENS.length}`;
    MENSAGENS.push({
      id, conversa_id: conversa, origem, tipo: "texto",
      texto: origem === "contato" ? "Mensagem do cliente" : "Resposta",
      enviado_por: quem ? quem.nome : null,
      enviado_por_id: quem ? quem.id : null,
      criado_em: new Date(t).toISOString(),
    });
    ATEND_DA_MSG.set(id, idx);
    return t;
  };

  põe("contato", null, t0);
  let fim = t0, recebidas = 1, enviadas = 0;

  if (espera != null) {
    fim = põe("advogado", autor, t0 + espera * 1000);
    enviadas = 1;
    // Cada ida e volta a mais: o cliente escreve 45 minutos depois, e a
    // resposta vem em `resposta` segundos. Tudo dentro da janela de 6 horas.
    for (let p = 1; p < pares; p++) {
      const tq = t0 + espera * 1000 + p * 45 * 60e3;
      põe("contato", null, tq);
      fim = põe("advogado", autor, tq + resposta * 1000);
      recebidas++; enviadas++;
    }
  }

  ROTEIRO.push({
    idx, adv, conversa, inicio: t0, fim, recebidas, enviadas,
    espera,                                  // null = ninguém respondeu ainda
    respostas: espera == null ? [] : [espera, ...Array(Math.max(0, pares - 1)).fill(resposta)],
    autor: espera == null ? null : autor,
    // Quem "pegou" o atendimento. O aparelho respondeu, mas não é ninguém: o
    // atendimento fica sem dono, e é isso que a tela precisa saber dizer.
    dono: espera == null || !autor || autor.aparelho ? null : autor,
  });
  return idx;
}

ADVOGADOS.forEach((adv, i) => {
  const daqui = CONVERSAS.filter((c) => c.advogado_id === adv.id);
  const mudo = adv.id === "a12";
  // Volumes bem diferentes entre telefones. `quantos` fica sempre abaixo de
  // 6 × (conversas do telefone), que é o que garante um atendimento por
  // (conversa, dia) — sem isso dois deles cairiam no mesmo dia da mesma
  // conversa e o banco de verdade os leria como UM.
  const quantos = mudo ? 0 : Math.min(5 + i * 3, 6 * daqui.length - 1);

  for (let k = 0; k < quantos; k++) {
    const semResposta = k % 7 === 6;                       // ainda aguardando
    const peloAparelho = !semResposta && k % 11 === 10;    // respondeu o celular
    atendimento({
      adv: adv.id,
      conversa: daqui[k % daqui.length].id,
      dias: Math.floor(k / daqui.length) % 6,
      hora: 8 + ((k * 3) % 9),                             // das 8h às 16h
      autor: peloAparelho ? APARELHO : AUTORES[(i + k) % AUTORES.length],
      espera: semResposta ? null : ESPERAS[k % ESPERAS.length],
      pares: 1 + (k % 3),
      resposta: RESPOSTAS[k % RESPOSTAS.length],
    });
  }

  if (mudo) return;

  // Mensagens que saíram pelo APARELHO, no meio de um atendimento que já
  // existe. Contam como enviadas do telefone e não são de atendente nenhum.
  const primeiro = ROTEIRO.find((a) => a.adv === adv.id);
  for (let k = 0; k < 5 + i; k++) {
    const id = `m-ap-${adv.id}-${k}`;
    MENSAGENS.push({ id, conversa_id: primeiro.conversa, origem: "advogado", tipo: "texto",
      texto: "Pelo aparelho", enviado_por: "WhatsApp", enviado_por_id: null,
      criado_em: new Date(primeiro.inicio + (k + 1) * 60e3).toISOString() });
    ATEND_DA_MSG.set(id, primeiro.idx);
    primeiro.enviadas++;
  }

  for (let k = 0; k < 3; k++) {
    NOTAS.push({ id: `n-${adv.id}-${k}`, conversa_id: daqui[k % daqui.length].id,
      texto: `Nota ${k + 1}`, autor: "Rodrigo Sousa", autor_id: "u1",
      criado_em: new Date(Date.now() - k * 3600e3).toISOString() });
  }
});

// O histórico importado, em volume, só no primeiro telefone — como no banco de
// verdade, onde são milhares e aparecem no topo do ranking.
ROTULOS_NAO_PESSOA.forEach((rotulo, j) => {
  const alvo = ROTEIRO.filter((a) => a.adv === ADVOGADOS[0].id);
  for (let k = 0; k < 40 + j * 20; k++) {
    const a = alvo[k % alvo.length];
    const id = `m-rot${j}-${k}`;
    MENSAGENS.push({ id, conversa_id: a.conversa, origem: "advogado", tipo: "texto",
      texto: "Importada", enviado_por: rotulo, enviado_por_id: null,
      criado_em: new Date(a.inicio + 90e3).toISOString() });
    ATEND_DA_MSG.set(id, a.idx);
    a.enviadas++;
  }
});

// LOTES MAIS ANTIGOS: é o que faz "7 dias", "30", "90" e "Tudo" darem respostas
// diferentes. Sem eles, o filtro de período passaria no teste mesmo se não
// filtrasse nada — e foi o que aconteceu na primeira execução: o lote principal
// cabia todo nos últimos 6 dias, então "7 dias" e "30 dias" davam o mesmo 221.
//
// As bases estão a 5 dias ou mais umas das outras, e cada lote ocupa 5 dias
// seguidos: nunca há dois atendimentos no mesmo dia da mesma conversa, que é o
// que faria o banco de verdade ler os dois como UM.
[10, 18, 40, 45, 200, 210].forEach((diasAtras, j) => {
  const daqui = CONVERSAS.filter((c) => c.advogado_id === ADVOGADOS[1].id);
  for (let k = 0; k < 5; k++) {
    atendimento({
      adv: ADVOGADOS[1].id, conversa: daqui[(j * 5 + k) % daqui.length].id,
      dias: diasAtras + k, hora: 9 + (k % 6),
      autor: AUTORES[k % AUTORES.length],
      espera: ESPERAS[(k + j) % ESPERAS.length], pares: 1 + (k % 2),
      resposta: RESPOSTAS[k % RESPOSTAS.length],
    });
  }
});

// Um atendimento fora do horário comercial, para o mapa de horários não ser um
// bloco só de 8h às 16h.
atendimento({ adv: ADVOGADOS[2].id, conversa: CONVERSAS.find((c) => c.advogado_id === ADVOGADOS[2].id).id,
  dias: 1, hora: 22, autor: AUTORES[0], espera: 300, pares: 1, resposta: 120 });

if (typeof globalThis !== "undefined") {
  // Liga e desliga a função do painel na bancada. Ligada por padrão; o teste
  // desliga para conferir o que a tela mostra num banco onde o SQL ainda não
  // foi rodado — que é um estado real, não hipotético.
  if (globalThis.__TEM_FUNCAO_PAINEL === undefined) globalThis.__TEM_FUNCAO_PAINEL = true;
}

// O CASO DO APELIDO DO WHATSAPP.
//
// O contato mandou mensagem e o WhatsApp devolveu o nome que ELE escreveu no
// aparelho — "Deus". Depois alguém preencheu a ficha no Vantoro com o nome de
// verdade, e o cabeçalho da conversa continuou mostrando o apelido.
//
// `vantoro_nome` começa NULO de propósito: é esse estado que a tela precisa
// consertar. Começando preenchido, o teste passaria sem que nada funcionasse.
const APELIDO = {
  id: "ct-apelido",
  nome: "Deus",
  numero: "5567992183107",
  vantoro_nome: null,
  vantoro_cliente_id: null,
  // O nome que a EQUIPE daria aqui dentro. Começa nulo: é o estado que a tela
  // precisa saber criar, e semeá-lo faria o teste passar sem nada funcionar.
  nome_zorvin: null,
  // COM FOTO, e pequena: é ela que o retrato amplia. Uma foto de perfil de
  // WhatsApp chega com 100 ou 200 pixels de lado, e era esse tamanho que a
  // tela desenhava no meio de uma janela de 1400.
  foto_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzBiNmJjYiIvPjwvc3ZnPg==",
};
// O nome que está no cadastro do Vantoro, e que o teste espera ver no
// cabeçalho depois de abrir a ficha.
export const NOME_NO_VANTORO = "ANDREIA CRISTINA MARTINS";

// Entra como uma conversa NOVA, e não por cima de uma existente. Reaproveitar
// uma conversa que já estava ali mudaria o que os outros testes da bancada
// encontram — e um teste que quebra por causa do vizinho não diz nada sobre o
// que ele deveria estar medindo.
//
// No telefone que o painel ABRE: ele pede os telefones com `.order("nome")` e
// abre o primeiro, que por ordem alfabética é "Acordos 1" e não o primeiro do
// array. Preso ao índice 0, o contato de prova nascia numa conversa que a tela
// não mostrava.
//
// `nao_lidas: 0` para não mexer nos contadores que outros testes conferem.
const PRIMEIRO_TELEFONE = ADVOGADOS.slice()
  .sort((a, b) => a.nome.localeCompare(b.nome))[0];
CONVERSAS.push({
  id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  advogado_id: PRIMEIRO_TELEFONE.id,
  contato_id: APELIDO.id,
  nao_lidas: 0,
  arquivada: false, fixada: false, favorita: false,
  ultima_atividade: new Date().toISOString(),
  ultima_mensagem: "Boa tarde, tudo bem?",
  frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { ...APELIDO },
});

// ------------------------------------------------------------------
//  O NOME QUE SE VÊ NÃO É SEMPRE O `nome` DO CONTATO
// ------------------------------------------------------------------
// Três contatos, três origens de nome — e é exatamente aqui que a busca
// falhava: ela procurava só em `contato.nome`, enquanto a lista mostra
// `vantoro_nome` ou `nome_zorvin` quando eles existem. Quem procurava pelo
// nome que estava vendo na tela não achava nada.
const RENOMEADOS = [
  { id: "ct-do-vantoro", numero: "5567991110001", foto_url: null,
    nome: "Deusdete",                       // o apelido do WhatsApp
    vantoro_nome: "MARIA DAS GRAÇAS PEREIRA", // o cadastro manda
    nome_zorvin: null, vantoro_cliente_id: "v-1" },
  { id: "ct-do-zorvin", numero: "5567991110002", foto_url: null,
    nome: null,                             // nunca deixou nome no WhatsApp
    vantoro_nome: null,
    nome_zorvin: "Lead Feira do Livro",     // a equipe batizou aqui dentro
    vantoro_cliente_id: null },
  { id: "ct-so-numero", numero: "5567991110003", foto_url: null,
    nome: "JOSEFA BATISTA DE ANDRADE", vantoro_nome: null, nome_zorvin: null,
    vantoro_cliente_id: null },
];
RENOMEADOS.forEach((ct, i) => {
  CONVERSAS.push({
    id: `${PRIMEIRO_TELEFONE.id}-ren${i}`,
    advogado_id: PRIMEIRO_TELEFONE.id,
    contato_id: ct.id,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(Date.now() - (i + 2) * 3600e3).toISOString(),
    ultima_mensagem: "Combinado, obrigado",
    frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { ...ct },
  });
});

// ------------------------------------------------------------------
//  O QUE FOI DITO DENTRO DA CONVERSA
// ------------------------------------------------------------------
// No WhatsApp, procurar uma palavra acha a conversa em que ela foi escrita.
// Aqui isso é a diferença entre encontrar um cliente pelo que ele contou e ter
// de lembrar o nome dele.
//
// A palavra é "teste" de propósito: é a que o escritório usou para relatar que
// não funcionava. Ela está numa mensagem ENVIADA pelo escritório, e não
// recebida — foi assim que o relato veio.
export const PALAVRA_NA_CONVERSA = "teste";
// LONGE DO FIM, de propósito. A conversa abre mostrando as 120 mensagens mais
// recentes; esta é de três meses atrás e tem 200 mensagens depois dela. Se o
// teste a pusesse perto do fim, "abrir na mensagem" passaria sem que nada
// tivesse sido feito — a mensagem já estaria na tela.
export const MSG_ACHADA = "m-palavra";
const HA_TRES_MESES = Date.now() - 90 * 24 * 3600e3;
MENSAGENS.push({
  id: MSG_ACHADA, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "Bom dia, este é um teste de envio pelo sistema",
  enviado_por: "Rodrigo Sousa", enviado_por_id: "u1",
  criado_em: new Date(HA_TRES_MESES).toISOString(),
});
// Antes e depois dela, para haver conversa de verdade em volta.
for (let i = 1; i <= 60; i++) {
  MENSAGENS.push({
    id: `m-antes-${i}`, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
    origem: i % 2 ? "contato" : "advogado", tipo: "texto",
    texto: `mensagem anterior ${i}`,
    enviado_por: i % 2 ? null : "Rodrigo Sousa", enviado_por_id: i % 2 ? null : "u1",
    criado_em: new Date(HA_TRES_MESES - i * 60e3).toISOString(),
  });
}
// UMA SEGUNDA PALAVRA, NA MESMA CONVERSA.
//
// É o caso do relato: procura-se uma palavra, clica-se e vai; procura-se outra
// palavra da MESMA conversa, clica-se e não vai. Sem duas palavras na mesma
// conversa, nenhum teste chega perto disso.
export const OUTRA_PALAVRA = "dinossauro";
export const MSG_ACHADA_2 = "m-palavra-2";
MENSAGENS.push({
  id: MSG_ACHADA_2, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "contato", tipo: "texto",
  texto: "meu filho quer ver o dinossauro do museu",
  enviado_por: null, enviado_por_id: null,
  criado_em: new Date(HA_TRES_MESES + 30 * 60e3).toISOString(),
});

for (let i = 1; i <= 200; i++) {
  MENSAGENS.push({
    id: `m-depois-${i}`, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
    origem: i % 2 ? "contato" : "advogado", tipo: "texto",
    texto: `mensagem posterior ${i}`,
    enviado_por: i % 2 ? null : "Rodrigo Sousa", enviado_por_id: i % 2 ? null : "u1",
    criado_em: new Date(HA_TRES_MESES + i * 60e3).toISOString(),
  });
}

// O NOME VELHO E A FALTA DE FOTO, NA MESMA CONVERSA.
//
// É o relato inteiro numa montagem só. A MESMA pessoa (`u1`) escreveu três
// vezes na conversa fixada:
//
//   • quando se chamava "Rodrigo ADMIN" e não tinha foto  → mensagem e nota
//   • depois de trocar o nome e pôr a foto                → mensagem
//
// O que estava errado: as duas primeiras continuavam assinadas "Rodrigo ADMIN"
// e com a bolinha de iniciais, porque a mensagem guarda o nome e a foto do dia
// do envio. E no grupinho de avatares do topo ela aparecia DUAS vezes — o nome
// era a chave, então "Rodrigo ADMIN" e "Rodrigo Sousa" eram duas pessoas.
//
// O nome de hoje e a foto de hoje estão em `usuarios` (a vista `equipe`), e é
// de lá que a tela tira o que desenha.
export const NOME_VELHO = "Rodrigo ADMIN";
// Uma imagem DE VERDADE, em `data:`, e não um endereço de mentira: o
// `Avatar` cai para as iniciais quando a foto não carrega, então uma URL
// que dá 404 desenharia exatamente o defeito que o teste procura — e a
// prova reprovaria por causa do instrumento.
// 120 pixels de lado de propósito: é o tamanho de uma foto de perfil de
// verdade, e é dele que sai a foto "que abre pequena".
export const FOTO_DE_HOJE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzAwYTg4NCIvPjwvc3ZnPg==";
export const FOTO_JENIFER = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAiIGhlaWdodD0iMTIwIj48cmVjdCB3aWR0aD0iMTIwIiBoZWlnaHQ9IjEyMCIgZmlsbD0iIzdjNWNmZiIvPjwvc3ZnPg==";
export const FOTO_CONTATO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNjAiIGhlaWdodD0iMTYwIj48cmVjdCB3aWR0aD0iMTYwIiBoZWlnaHQ9IjE2MCIgZmlsbD0iIzBiNmJjYiIvPjwvc3ZnPg==";
MENSAGENS.push({
  id: "m-nome-velho", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "escrevi isto quando eu tinha outro nome e nenhuma foto",
  enviado_por: NOME_VELHO, enviado_por_id: "u1", enviado_por_foto: null,
  criado_em: new Date(Date.now() - 5 * 3600e3).toISOString(),
});
MENSAGENS.push({
  id: "m-nome-novo", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "e isto depois de trocar o nome e pôr a foto",
  enviado_por: "Rodrigo Sousa", enviado_por_id: "u1", enviado_por_foto: FOTO_DE_HOJE,
  criado_em: new Date(Date.now() - 4 * 3600e3).toISOString(),
});
// E UMA MENSAGEM SEM ID NENHUM, do histórico anterior à coluna existir, mas
// assinada com o nome que a pessoa TEM hoje: é o único caso em que dá para
// devolver a foto a uma mensagem antiga, casando pelo nome.
MENSAGENS.push({
  id: "m-so-nome", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "histórico antigo, sem id de quem escreveu",
  enviado_por: "jenifer almeida", enviado_por_id: null, enviado_por_foto: null,
  // ENTRE as duas do Rodrigo, e não depois: mensagens seguidas da mesma pessoa
  // são agrupadas e só a última leva avatar. Coladas uma na outra, a antiga não
  // desenharia avatar nenhum e o teste da foto não teria o que medir.
  criado_em: new Date(Date.now() - 4.5 * 3600e3).toISOString(),
});

// A CONTA QUE FOI APAGADA, e cujas mensagens ficaram.
//
// O relato: "o Rodrigo ADMIN era o usuário administrador, eu alterei para o
// Rodrigo Sousa e excluí o administrador". A mensagem ficou assinada com um id
// que não existe mais em `usuarios` — nem o id acha ninguém, nem o nome, porque
// o nome gravado é justamente o velho. Sem uma terceira pista ela não tem como
// voltar para a pessoa; a pista é `atendentes_de_para`.
export const CONTA_APAGADA = "u-admin-apagado";
MENSAGENS.push({
  id: "m-conta-apagada", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "escrevi isto pela conta de administrador, que depois foi apagada",
  enviado_por: NOME_VELHO, enviado_por_id: CONTA_APAGADA, enviado_por_foto: null,
  criado_em: new Date(Date.now() - 5.5 * 3600e3).toISOString(),
});

// E A MESMA PESSOA ASSINANDO COM O COMEÇO DO E-MAIL — o de-para antigo.
MENSAGENS.push({
  id: "m-de-para-antigo", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "assinei com o começo do e-mail, lá no comeco de tudo",
  enviado_por: "rodrigo", enviado_por_id: null, enviado_por_foto: null,
  criado_em: new Date(Date.now() - 5.7 * 3600e3).toISOString(),
});

// A MENSAGEM QUE SAIU PELO CELULAR, na conversa de prova.
//
// Quando alguém responde pelo aplicativo do WhatsApp em vez de responder pelo
// Zorvin, a ponte assina com o rótulo "WhatsApp" — o WhatsApp não diz qual
// atendente foi. Na base do escritório são 1556 mensagens em quatro semanas,
// e todas apareciam assinadas "WhatsApp", como se fosse um colega com esse
// nome. Entravam até no grupinho de rostos do topo.
MENSAGENS.push({
  id: "m-pelo-aparelho", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "respondi correndo, direto do aplicativo",
  enviado_por: "WhatsApp", enviado_por_id: null, enviado_por_foto: null,
  criado_em: new Date(Date.now() - 2.5 * 3600e3).toISOString(),
});
// E UM RÓTULO DO IMPORTADOR, que também não é gente — o nome da linha como
// estava salvo no celular de quem exportou o histórico.
MENSAGENS.push({
  id: "m-rotulo-import", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "advogado", tipo: "texto",
  texto: "veio do histórico importado",
  enviado_por: "Cadastro - C&A", enviado_por_id: null, enviado_por_foto: null,
  criado_em: new Date(Date.now() - 2.4 * 3600e3).toISOString(),
});

// UMA IMAGEM NA CONVERSA, para o visor em tela cheia ter o que abrir. A regra
// de tamanho dele é diferente da do retrato do contato, e sem uma foto de
// conversa aqui não haveria como provar que uma não estragou a outra.
MENSAGENS.push({
  id: "m-imagem", conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  origem: "contato", tipo: "imagem", texto: null,
  midia_url: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjAwIiBoZWlnaHQ9IjgwMCI+PHJlY3Qgd2lkdGg9IjEyMDAiIGhlaWdodD0iODAwIiBmaWxsPSIjYzg2NDFlIi8+PC9zdmc+",
  midia_mime: "image/svg+xml",
  enviado_por: null, enviado_por_id: null,
  criado_em: new Date(Date.now() - 2 * 3600e3).toISOString(),
});

// A MESMA PALAVRA, MUITAS VEZES, EM OUTROS TELEFONES.
//
// A busca por mensagem pedia as 1000 mensagens mais recentes que casassem —
// de TODO o escritório — e só depois descartava as de outros telefones. Uma
// palavra comum enche as mil vagas com conversa alheia, e a conversa certa,
// mais antiga, fica de fora. Some sem erro nenhum: é a outra metade do "às
// vezes acha, às vezes não".
for (let i = 0; i < 1400; i++) {
  MENSAGENS.push({
    id: `m-ruido-${i}`, conversa_id: `a13-c${i % 1200}`,
    origem: "contato", tipo: "texto",
    texto: `mais um teste ${i}`,
    enviado_por: null, enviado_por_id: null,
    // MAIS RECENTES que a de cima: são elas que ocupam as vagas.
    criado_em: new Date(Date.now() - i * 60e3).toISOString(),
  });
}

// ------------------------------------------------------------------
//  UM TELEFONE COM MAIS DE MIL CONVERSAS
// ------------------------------------------------------------------
// A API do Supabase devolve no máximo 1000 linhas por consulta e CALA. A lista
// de conversas para aí — e uma busca feita sobre a lista não alcança ninguém
// que esteja depois disso. Num telefone com dois anos de histórico, isso é a
// maior parte da agenda.
//
// O contato lá no fundo tem nome próprio para o teste poder procurá-lo pelo
// nome, como uma pessoa faria.
// No MESMO departamento do telefone que o painel abre primeiro, para o teste
// alcançá-lo com um clique — a barra lateral só mostra os do departamento atual.
const TELEFONE_FUNDO = { id: "a13", nome: "Arquivo", numero: "5511900002222",
                         foto_url: null, departamento_id: 5, ativo: true };
ADVOGADOS.push(TELEFONE_FUNDO);
export const NOME_LA_NO_FUNDO = "ZULMIRA ANTUNES DO PRADO";
/** Quantas conversas o telefone do fundo tem, e quantas delas são não lidas. */
export const FUNDO_TOTAL = 1200;
export const FUNDO_NAO_LIDAS = 1100;
const FUNDO = [];
for (let i = 0; i < 1200; i++) {
  const ct = {
    id: `ct-fundo-${i}`,
    numero: `55679${String(20000000 + i)}`,
    nome: i === 1150 ? NOME_LA_NO_FUNDO : `${NOMES[i % NOMES.length]} ${i}`,
    vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null,
  };
  FUNDO.push(ct);
  CONVERSAS.push({
    id: `a13-c${i}`,
    advogado_id: "a13",
    contato_id: ct.id,
    // MAIS DE MIL NÃO LIDAS, de propósito. O selo do telefone era contado
    // baixando TODAS as conversas não lidas de TODOS os telefones — e a API
    // para em 1000. Passando disso, o selo mentia para menos: sumia o aviso de
    // que havia gente esperando.
    nao_lidas: i >= 100 ? 1 : 0,
    arquivada: false, fixada: false, favorita: false,
    // O DE TRÁS É O MAIS ANTIGO: a lista vem por `ultima_atividade` desc, então
    // o teto de 1000 corta justamente os do fim.
    ultima_atividade: new Date(Date.now() - i * 3600e3).toISOString(),
    ultima_mensagem: "Conversa arquivada",
    frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { ...ct },
  });
}

// UMA MENSAGEM COM TEXTO PRÓPRIO, numa conversa que está DEPOIS da milésima.
// Serve para provar as duas coisas de uma vez: que a busca procura dentro das
// mensagens, e que ela alcança conversa que a lista não trouxe.
export const TEXTO_LA_NO_FUNDO = "protocolo 8891 do INSS";
MENSAGENS.push({
  id: "m-fundo-texto", conversa_id: "a13-c1180", origem: "contato", tipo: "texto",
  texto: `Boa tarde, é sobre o ${TEXTO_LA_NO_FUNDO}`,
  enviado_por: null, enviado_por_id: null,
  criado_em: new Date(Date.now() - 1180 * 3600e3).toISOString(),
});

// ETIQUETAS, E ONDE ELAS ESTÃO PENDURADAS.
//
// A bancada nascia com `tags: []` e `conversa_tags: []` — quer dizer que a
// etiqueta, do filtro ao selo na linha, nunca foi exercitada uma vez sequer.
//
// A "Urgente" está pendurada em cinco conversas do telefone do fundo, e de
// propósito ESPALHADA: duas dentro da primeira página que a tela carrega, três
// depois dela. É a diferença entre um filtro que pergunta ao banco e um que
// filtra a lista que está na tela — este último acha duas e diz que são todas.
export const TAG_URGENTE = "t-urgente";
export const URGENTE_TOTAL = 5;
const CONVERSAS_URGENTES = ["a13-c3", "a13-c40", "a13-c700", "a13-c980", "a13-c1150"];
const TAGS = [
  { id: TAG_URGENTE, nome: "Urgente", cor: "#c0392b" },
  { id: "t-aguardando", nome: "Aguardando cliente", cor: "#2a78d6" },
];
const CONVERSA_TAGS = CONVERSAS_URGENTES.map((cid, i) => ({
  id: `ct-tag-${i}`, conversa_id: cid, tag_id: TAG_URGENTE,
}));
// Uma segunda etiqueta numa conversa das primeiras, para provar que o filtro
// separa uma da outra em vez de mostrar tudo o que tem etiqueta.
CONVERSA_TAGS.push({ id: "ct-tag-x", conversa_id: "a13-c3", tag_id: "t-aguardando" });

// UMA CONVERSA FIXADA LÁ NO FUNDO.
//
// Fixar serve para uma conversa ficar à vista todo dia, acima das outras. A
// ordenação, porém, é feita sobre a lista já carregada — então uma conversa
// fixada que esteja na página 6 do banco só sobe quando alguém rolar até a
// página 6. Que é o mesmo que não estar fixada.
export const NOME_FIXADA = "CONVERSA QUE FOI FIXADA";
{
  const alvo = CONVERSAS.find((c) => c.id === "a13-c1000");
  const contato = FUNDO.find((c) => c.id === alvo.contato_id);
  alvo.fixada = true;
  contato.nome = NOME_FIXADA;
  alvo.contato = { ...contato };
}

// DUAS MENSAGENS QUE NÃO SAÍRAM.
//
// Elas nunca chegam em `mensagens` — ficam na fila de envio, com erro. A
// bancada nascia com a fila vazia, então a bolha vermelha e o motivo da falha
// jamais foram exercitados por teste nenhum.
//
// São duas de propósito: uma com motivo reconhecido (a frase em português que
// a ponte escreveu) e outra sem — porque o caso que mais importa é o do erro
// que a ponte NÃO conhece, em que a tela precisa mostrar o texto cru em vez de
// inventar uma explicação.
export const MOTIVO_CONHECIDO = "Este número não tem conta no WhatsApp, ou está escrito errado.";
export const ERRO_CRU = 'Uazapi respondeu 418: {"error":"sou um bule de cha"}';
const FILA_COM_ERRO = [
  { id: 901, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`, tipo: "texto",
    texto: "Doutor, segue o documento que combinamos", status: "erro",
    enviado_por: "Rodrigo Sousa", enviado_por_id: "u1",
    erro_motivo: MOTIVO_CONHECIDO,
    erro_detalhe: 'Uazapi respondeu 400: {"error":"number not exists"}',
    criado_em: new Date(Date.now() - 30 * 60e3).toISOString() },
  { id: 902, conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`, tipo: "texto",
    texto: "Consegue confirmar por aqui?", status: "erro",
    enviado_por: "Rodrigo Sousa", enviado_por_id: "u1",
    erro_motivo: null,
    erro_detalhe: ERRO_CRU,
    criado_em: new Date(Date.now() - 20 * 60e3).toISOString() },
];

// O CENÁRIO DO FILTRO POR ATENDENTE — o exemplo do relato, literal.
//
// Duas conversas no mesmo telefone. Na da MARIA falaram RODRIGO e JENIFER; na
// do JOÃO falaram RODRIGO e ISABELA. É a menor montagem que separa os dois
// modos do filtro:
//
//   RODRIGO sozinho            → as duas
//   ISABELA sozinha            → só JOÃO
//   RODRIGO+JENIFER, juntos    → só MARIA (é onde os dois se cruzam)
//   RODRIGO+JENIFER, qualquer  → as duas
//   JENIFER+ISABELA, juntos    → nenhuma (nunca se cruzaram)
//
// E uma terceira, do CARLOS, com mensagem SEM `enviado_por_id` — o histórico
// anterior à coluna existir. Sem ela, "as conversas em que eu participei"
// começaria no dia em que a coluna foi criada, e o recurso serve justamente
// para achar coisa antiga.
export const USUARIOS_FILTRO = [
  { id: "u1", nome: "Rodrigo Sousa" },
  { id: "u-jenifer", nome: "JENIFER ALMEIDA" },
  { id: "u-isabela", nome: "ISABELA GUEDES" },
];
const CONTATOS_FILTRO = [
  { id: "ct-maria",  numero: "5567993330001", nome: "MARIA DO FILTRO",  vantoro_nome: null, nome_zorvin: null, foto_url: null },
  { id: "ct-joao",   numero: "5567993330002", nome: "JOAO DO FILTRO",   vantoro_nome: null, nome_zorvin: null, foto_url: null },
  { id: "ct-carlos", numero: "5567993330003", nome: "CARLOS ANTIGO",    vantoro_nome: null, nome_zorvin: null, foto_url: null },
];
CONTATOS_FILTRO.forEach((ct, i) => {
  CONVERSAS.push({
    id: `${PRIMEIRO_TELEFONE.id}-quem${i}`,
    advogado_id: PRIMEIRO_TELEFONE.id,
    contato_id: ct.id,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(Date.now() - (i + 6) * 3600e3).toISOString(),
    ultima_mensagem: "Conversa do filtro por atendente",
    frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { ...ct },
  });
});
const FALAS = [
  ["quem0", "Rodrigo Sousa", "u1"],
  ["quem0", "JENIFER ALMEIDA", "u-jenifer"],
  ["quem1", "Rodrigo Sousa", "u1"],
  ["quem1", "ISABELA GUEDES", "u-isabela"],
  // O histórico antigo: nome escrito diferente e SEM id.
  ["quem2", "jenifer almeida", null],
];
FALAS.forEach(([conv, nome, id], i) => {
  MENSAGENS.push({
    id: `m-quem-${i}`, conversa_id: `${PRIMEIRO_TELEFONE.id}-${conv}`,
    origem: "advogado", tipo: "texto", texto: `mensagem de ${nome}`,
    enviado_por: nome, enviado_por_id: id,
    criado_em: new Date(Date.now() - (i + 6) * 3600e3).toISOString(),
  });
});

// UM TELEFONE ANTIGO — o caso em que o filtro não aparecia.
//
// Todo o histórico dele é anterior à coluna `enviado_por_id`: as mensagens têm
// só o NOME de quem escreveu. A lista de atendentes olhava apenas o id, então
// vinha vazia; e a tela, que só mostrava o botão com mais de um nome na lista,
// escondia o filtro inteiro. Medido no Postgres de verdade: a função antiga
// devolvia ZERO linha neste telefone, a nova devolve as duas pessoas.
//
// É o "alguns telefones não têm essa opção" do relato, reproduzido.
// "Acordos 2" e não um telefone qualquer: ele divide o departamento com o
// PRIMEIRO_TELEFONE, então aparece na barra lateral sem ter de trocar de
// departamento antes — o teste troca de número em um clique.
export const TELEFONE_ANTIGO = ADVOGADOS.find((a) => a.nome === "Acordos 2");
[["Rodrigo Sousa", 0], ["JENIFER ALMEIDA", 1]].forEach(([nome, i]) => {
  MENSAGENS.push({
    id: `m-antigo-${i}`, conversa_id: `${TELEFONE_ANTIGO.id}-c${i}`,
    origem: "advogado", tipo: "texto", texto: `mensagem antiga de ${nome}`,
    enviado_por: nome.toLowerCase(), enviado_por_id: null,
    criado_em: new Date(Date.now() - 400 * 86400e3).toISOString(),
  });
});

// UMA NOTA NA CONVERSA DE PROVA, escrita pelo próprio usuário logado — é dele
// a permissão de editar e apagar. `apagada_em` nula: é o estado que a tela
// precisa saber mudar.
NOTAS.push({
  id: "nota-de-prova",
  conversa_id: `${PRIMEIRO_TELEFONE.id}-apelido`,
  texto: "Cliente pediu para ligar depois das 18h",
  autor: "Rodrigo Sousa",
  autor_id: "u1",
  autor_foto: null,
  editada_em: null, editada_por: null,
  apagada_em: null, apagada_por: null, apagada_por_id: null,
  criado_em: new Date(Date.now() - 3600e3).toISOString(),
});

const TABELAS = {
  advogados: ADVOGADOS,
  departamentos: DEPARTAMENTOS,
  conversas: CONVERSAS,
  // O NOME AQUI É O DO VANTORO — e é de propósito que ele seja DIFERENTE do
  // que está no `user_metadata` logo abaixo. É a situação real de quem entrou
  // antes de o Vantoro ter o nome completo: o cadastro já diz "Rodrigo Sousa",
  // e a conta do Supabase ficou parada em "rodrigo". A tela tem de mostrar o
  // do cadastro.
  // ADMIN OU NÃO — o teste troca por `__SOU_ADMIN`. O Painel agora é de todo
  // mundo, e o que muda entre um caso e outro (o botão de escopo, e o recorte
  // que o banco impõe a quem não administra) só se prova entrando nos dois.
  // `foto_url` mora AQUI, e não só no `user_metadata` da conta. O metadado só
  // o próprio dono lê — era por isso que a foto precisava viajar copiada dentro
  // de cada mensagem, e por isso que trocar de foto não mudava nada no que já
  // estava escrito.
  usuarios: [
    // `__NOME_NOVO_U1` é como o teste renomeia alguém no cadastro. Tem de ser
    // lido AQUI, na montagem: mexer no objeto depois não sobrevive ao F5, e é
    // justamente o F5 que prova que a troca valeu para o histórico inteiro.
    { id: "u1", admin: (typeof globalThis !== "undefined" && globalThis.__SOU_ADMIN === false) ? false : true,
      nome: (typeof globalThis !== "undefined" && globalThis.__NOME_NOVO_U1) || "Rodrigo Sousa",
      foto_url: FOTO_DE_HOJE },
    { id: "u-jenifer", admin: false, nome: "JENIFER ALMEIDA", foto_url: FOTO_JENIFER },
    { id: "u-isabela", admin: false, nome: "ISABELA GUEDES", foto_url: null },
  ],
  permissoes: [],            // vazio + admin = alcança tudo
  mensagens: MENSAGENS,
  // TODOS OS CONTATOS, e não só o de prova. A tabela de verdade tem uma linha
  // por pessoa, e a busca nova consulta ELA em vez de filtrar a lista que está
  // na tela — que é o que a fazia parar no teto de 1000 linhas.
  contatos: [
    { ...APELIDO },
    ...RENOMEADOS.map((c) => ({ ...c })),
    ...FUNDO.map((c) => ({ ...c })),
    ...CONVERSAS.filter((c) => c.contato && c.contato.numero && !c.contato_id.startsWith("ct-"))
      .map((c) => ({ id: c.contato_id, ...c.contato, vantoro_nome: null, nome_zorvin: null })),
  ],
  notas: NOTAS, tags: TAGS, conversa_tags: CONVERSA_TAGS,
  // O histórico de alterações começa VAZIO: as linhas nascem do que se faz na
  // tela, e semear alguma aqui esconderia uma tela que não grava nada.
  alteracoes: [],
  mensagens_rapidas: [], figurinhas_favoritas: [], fila_envio: FILA_COM_ERRO,
  // O DE-PARA, que já existia para o Painel não contar "rodrigo" e "Rodrigo
  // Sousa" como duas pessoas. A conversa passou a consultá-lo pelo mesmo
  // motivo: é a única pista que sobra quando o id foi apagado e o nome gravado
  // é o antigo. `e_pessoa: false` é o rótulo que não é gente — o nome da linha
  // no celular de quem exportou o histórico — e não pode virar atendente.
  atendentes_de_para: [
    { nome_antigo: NOME_VELHO, usuario_id: "u1", nome_novo: null, e_pessoa: true },
    { nome_antigo: "Cadastro - C&A", usuario_id: null, nome_novo: null, e_pessoa: false },
    // A LINHA ANTIGA, sem `usuario_id`. As primeiras linhas do de-para foram
    // feitas quando só havia texto para comparar: o começo do e-mail
    // ("rodrigo") apontando para o nome por extenso. Ela era o que fazia a
    // MESMA pessoa aparecer duas vezes em "quem participou" — uma vinda do id,
    // com foto, e outra vinda daqui, sem. Aconteceu em produção.
    { nome_antigo: "rodrigo", usuario_id: null, nome_novo: "Rodrigo Sousa", e_pessoa: true },
  ],
  // A VISTA `equipe`: as três colunas que a tela desenha, e nada mais.
  //
  // Um `get`, e não uma cópia: no banco ela é uma vista, então enxerga na hora
  // o que mudar em `usuarios`. Uma cópia congelada aqui faria o teste de
  // trocar a foto passar sem que a troca tivesse chegado a lugar nenhum.
  get equipe() {
    return this.usuarios.map((u) => ({ id: u.id, nome: u.nome, foto_url: u.foto_url ?? null }));
  },
};

// O teste troca o nome de alguém no meio da prova — é o que o relato descreve.
if (typeof globalThis !== "undefined") {
  globalThis.__RENOMEAR_USUARIO = (id, nome) => {
    const u = TABELAS.usuarios.find((x) => String(x.id) === String(id));
    if (u) u.nome = nome;
  };
}

// O teste lê a tabela de contatos daqui para conferir o que foi GRAVADO, e não
// só o que apareceu na tela. Uma tela que mostra o nome certo sem ter gravado
// nada volta ao apelido no próximo carregamento.
if (typeof globalThis !== "undefined") {
  globalThis.__TABELAS = TABELAS;
  globalThis.__PALAVRA_NA_CONVERSA = PALAVRA_NA_CONVERSA;
  globalThis.__MSG_ACHADA = MSG_ACHADA;
  globalThis.__OUTRA_PALAVRA = OUTRA_PALAVRA;
  globalThis.__MSG_ACHADA_2 = MSG_ACHADA_2;
  globalThis.__MOTIVO_CONHECIDO = MOTIVO_CONHECIDO;
  globalThis.__ERRO_CRU = ERRO_CRU;
  globalThis.__USUARIOS_FILTRO = USUARIOS_FILTRO;
}

/** O `%` do PostgREST vira o `.*` de uma expressão regular, sem diferenciar
    maiúscula de minúscula — e o resto do padrão é escapado, para um ponto de
    CPF não virar "qualquer caractere". */
function comoIlike(padrao) {
  const corpo = String(padrao ?? "")
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/%/g, ".*")
    .replace(/_/g, ".");
  return new RegExp(`^${corpo}$`, "i");
}

/** Separa `a.ilike.%x%,b.eq.1` nos seus pedaços, respeitando parênteses. */
function separarOr(expr) {
  const limpo = expr.startsWith("(") && expr.endsWith(")") ? expr.slice(1, -1) : expr;
  const saida = []; let atual = "", nivel = 0;
  for (const ch of limpo) {
    if (ch === "(") nivel++;
    if (ch === ")") nivel--;
    if (ch === "," && nivel === 0) { saida.push(atual); atual = ""; continue; }
    atual += ch;
  }
  if (atual) saida.push(atual);
  return saida;
}

/** Compara número com número e texto com texto. Data em ISO ordena sozinha
    como texto, que é o que o Postgres faz com `timestamptz` de qualquer jeito. */
function comparar(a, b) {
  const na = Number(a), nb = Number(b);
  if (a !== null && a !== "" && b !== null && b !== "" && !isNaN(na) && !isNaN(nb)) return na - nb;
  const sa = String(a ?? ""), sb = String(b ?? "");
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

/** Uma consulta encadeável que devolve sempre `{data, error}` no final. */
function consulta(tabela) {
  // A VISTA QUE AINDA NÃO EXISTE. O código sobe antes do script — sempre sobe.
  // Nesse intervalo a tela tem de continuar desenhando o nome e a foto que
  // estão gravados na mensagem, e não uma conversa sem assinatura nenhuma.
  const faltando = tabela === "equipe"
    && typeof globalThis !== "undefined" && globalThis.__SEM_EQUIPE;
  let linhas = faltando ? [] : (TABELAS[tabela] || []).slice();
  // O QUE FOI PEDIDO, e não só o resultado. É por isto que dá para saber se a
  // consulta varreu a tabela inteira ou entrou por um recorte — a diferença
  // entre uma busca que responde e uma que estoura o tempo.
  const pedidos = [];
  let inicio = 0, corte = Infinity, patch = null, contando = false, semLinhas = false, apagando = false;
  const eu = {
    // `select("id", { count: "exact", head: true })` — o jeito de pedir só a
    // CONTAGEM. A bancada precisa saber disso desde que os selos de não lidas
    // pararam de baixar mil conversas para somar uma dúzia de números.
    select(_cols, opc) {
      if (opc && opc.count) contando = true;
      if (opc && opc.head) semLinhas = true;
      return eu;
    },
    eq(col, val) { pedidos.push(col); linhas = linhas.filter((l) => String(l[col]) === String(val)); return eu; },
    in(col, vals) { pedidos.push(col); linhas = linhas.filter((l) => vals.map(String).includes(String(l[col]))); return eu; },
    is(col, val) { linhas = linhas.filter((l) => l[col] === val); return eu; },
    neq(col, val) { linhas = linhas.filter((l) => String(l[col]) !== String(val)); return eu; },
    // `gt` PRECISA filtrar de verdade: o selo da barra lateral sai de
    // `.gt("nao_lidas", 0)`, e com um cano vazio aqui ele contava também as
    // conversas já lidas — a bancada acusava um defeito que o painel não tem.
    // E precisa comparar TEXTO também: o corte de período do Painel é
    // `.gte("criado_em", "2026-…")`. Passando por `Number()`, aquilo virava
    // NaN >= NaN, que é falso sempre — a bancada devolvia zero mensagem e a
    // tela parecia quebrada quando quem estava quebrado era o instrumento.
    gt(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) > 0); return eu; },
    gte(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) >= 0); return eu; },
    lt(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) < 0); return eu; },
    lte(col, val) { linhas = linhas.filter((l) => comparar(l[col], val) <= 0); return eu; },
    not() { return eu; }, contains() { return eu; },
    // `ilike` E `or` ERAM CANO VAZIO, e é por isso que o defeito da busca
    // atravessou todos os testes: a bancada devolvia TUDO para qualquer termo,
    // então a tela parecia achar o que na verdade ela nunca procurou.
    ilike(col, padrao) {
      pedidos.push(col);
      const re = comoIlike(padrao);
      linhas = linhas.filter((l) => re.test(String(l[col] ?? "")));
      return eu;
    },
    // `or("a.ilike.%x%,b.ilike.%x%")` — a mesma forma que o PostgREST aceita.
    // Só o que o painel usa: `ilike` e `eq`.
    or(expr) {
      const partes = separarOr(String(expr || ""));
      linhas = linhas.filter((l) => partes.some((p) => {
        const [col, op, ...resto] = p.split(".");
        const valor = resto.join(".");
        if (op === "ilike") return comoIlike(valor).test(String(l[col] ?? ""));
        if (op === "eq") return String(l[col] ?? "") === valor;
        return false;
      }));
      return eu;
    },
    // `order`, `limit` e `range` PRECISAM valer, agora que a bancada tem
    // milhares de linhas: são eles que a paginação usa para sair do teto.
    order(col, opc) {
      const cres = !(opc && opc.ascending === false);
      linhas = linhas.slice().sort((a, b) => (cres ? 1 : -1) * comparar(a[col], b[col]));
      return eu;
    },
    limit(n) { corte = Math.min(corte, n); return eu; },
    range(de, ate) { inicio = de; corte = ate - de + 1; return eu; },
    single() { return eu.then((r) => ({ data: r.data[0] || null, error: null })); },
    maybeSingle() { return eu.then((r) => ({ data: r.data[0] || null, error: null })); },
    // GRAVAR TAMBÉM É ENCADEÁVEL. O painel escreve `upsert(...).select("id")
    // .single()`, e devolver uma Promise aqui quebrava a corrente com
    // "upsert(...).select is not a function" — a bancada acusava um defeito
    // que o painel não tem. Além de encadear, estas guardam a linha: sem isso
    // o contato criado pelo link não existia na consulta seguinte, e o teste
    // do link nunca chegava ao fim.
    insert(reg) { return eu.gravar(reg); },
    upsert(reg) { return eu.gravar(reg); },
    gravar(reg) {
      const novos = (Array.isArray(reg) ? reg : [reg]).map((r, i) => ({
        id: r.id || `${tabela}-${(TABELAS[tabela] || []).length + i + 1}`, ...r,
      }));
      const tab = TABELAS[tabela] || (TABELAS[tabela] = []);
      for (const n of novos) {
        // "onConflict: numero" é o uso real: mesmo número, mesma linha.
        const j = tab.findIndex((l) => (n.numero && l.numero === n.numero) || l.id === n.id);
        if (j >= 0) tab[j] = { ...tab[j], ...n }; else tab.push(n);
      }
      linhas = novos;
      return eu;
    },
    // GRAVA SÓ NO FIM, e não no instante da chamada. O painel escreve
    // `update(campos).eq("numero", n)` — o filtro vem DEPOIS do update, e o
    // Supabase de verdade aplica os dois juntos. Aplicando na hora, a bancada
    // gravava em TODAS as linhas e depois filtrava, o que faria um teste passar
    // mesmo se o painel esquecesse o filtro e reescrevesse o cadastro inteiro.
    update(reg) { patch = { ...(patch || {}), ...reg }; return eu; },
    // APAGAR PRECISA APAGAR. Era um cano vazio: devolvia a corrente e não
    // tirava linha nenhuma. Tirar uma etiqueta de uma conversa, apagar uma
    // etiqueta, apagar uma nota — tudo isso passava na bancada sem que nada
    // saísse da tabela, e um teste que conferisse o resultado passaria mesmo
    // com o painel esquecendo de apagar. Como o `update`, ela guarda a
    // intenção e executa no fim, depois de os filtros terem sido aplicados.
    delete() { apagando = true; return eu; },
    async then(resolver) {
      // A vista que ainda não foi criada responde como o PostgREST responde:
      // com erro, e não com uma lista vazia. São coisas diferentes — "não
      // existe" e "existe e está vazia" — e a tela precisa distinguir as duas.
      if (faltando) {
        return resolver({ data: null, count: null,
          error: { code: "42P01", message: `relation "public.${tabela}" does not exist` } });
      }
      if (tabela === "conversas") await espera(ATRASO_CONVERSAS);
      if (tabela === "mensagens") await espera(ATRASO_MENSAGENS);
      if (patch) linhas.forEach((l) => Object.assign(l, patch));
      if (apagando) {
        const tab = TABELAS[tabela] || [];
        for (const l of linhas) { const i = tab.indexOf(l); if (i >= 0) tab.splice(i, 1); }
      }
      // O "join" com contatos, refeito na hora. No Supabase a lista de
      // conversas traz o contato por junção, então uma gravação em `contatos`
      // aparece na consulta seguinte. Aqui o contato era uma CÓPIA presa à
      // conversa, e a lista continuava mostrando o nome velho depois de o
      // cadastro ter sido gravado — a bancada mentia a favor do defeito.
      if (tabela === "conversas") {
        for (const l of linhas) {
          if (!l.contato || !l.contato.numero) continue;
          const atual = (TABELAS.contatos || []).find((c) => c.numero === l.contato.numero);
          if (atual) l.contato = { ...l.contato, ...atual };
        }
      }
      // ------------------------------------------------------------
      //  O TEMPO ESTOURA — como estoura no banco de verdade
      //
      //  `ilike '%palavra%'` não usa índice: o `%` na frente obriga a ler a
      //  tabela linha por linha. Em `mensagens`, que é a maior tabela do
      //  sistema, isso é uma varredura completa — e a API do Supabase corta a
      //  consulta em 8 segundos.
      //
      //  O que volta é `data: null` com um erro. Quem não confere o erro vê uma
      //  lista vazia e conclui que não há resultado. Foi exatamente esse o
      //  relato: procurar uma palavra que existe na conversa e não achar nada.
      //
      //  A bancada não tinha como reproduzir isso — ela devolvia as três mil
      //  linhas dela num piscar. Agora ela recusa a mesma consulta que o banco
      //  recusa: varrer `mensagens` inteira sem dizer de qual conversa.
      // Falha sob encomenda, para o teste poder ver o que a tela faz quando a
      // consulta não responde. Sem isto, o caminho do erro nunca é exercitado —
      // e é justamente o caminho em que a tela mentia.
      if (typeof globalThis !== "undefined" && globalThis.__QUEBRAR_BUSCA
          && (tabela === "contatos" || tabela === "mensagens")) {
        return resolver({ data: null, error: {
          code: "57014", message: "canceling statement due to statement timeout" } });
      }
      if (tabela === "mensagens" && pedidos.includes("texto")
          && !pedidos.includes("conversa_id") && linhas.length >= 0
          && !pedidos.some((c) => c !== "texto")) {
        return resolver({ data: null, error: {
          code: "57014",
          message: "canceling statement due to statement timeout",
        } });
      }

      // O teto entra AQUI, no fim, igual à API de verdade: depois de filtrar e
      // ordenar, e sem avisar ninguém de que sobrou coisa para trás.
      // A CONTAGEM NÃO PASSA PELO TETO DE LINHAS, como no banco de verdade: o
      // `count` é feito lá dentro e vem completo.
      const total = linhas.length;
      const fatia = semLinhas ? [] : linhas.slice(inicio, inicio + Math.min(corte, LIMITE_LINHAS));
      return resolver(contando
        ? { data: fatia, count: total, error: null }
        : { data: fatia, error: null });
    },
  };
  return eu;
}

/* ==================================================================
   `painel_dashboard`, de mentira
   ==================================================================
   Ela AGREGA O ROTEIRO — não redescobre os atendimentos a partir das
   mensagens. Redescobrir seria escrever, em JavaScript, a mesma lógica de
   janela de silêncio que já está no SQL; se as duas errassem igual, o teste
   passaria e o painel mentiria. A lógica do SQL é provada onde ela roda, num
   Postgres de verdade (sql/2026-08-painel-completo.sql). O papel da bancada é
   outro: entregar à tela um resultado CERTO e realista, para que o teste
   possa cobrar da tela que ela mostre exatamente isso.

   E, como a de verdade, ela faz A CONTA INTEIRA: não passa pelo teto de
   linhas da API. É o ponto todo da correção que originou esta tela. */
const NAO_PESSOA = new Set(ROTULOS_NAO_PESSOA.map((r) => r.toLowerCase()));
const TEL_DA_CONVERSA = new Map(CONVERSAS.map((c) => [String(c.id), String(c.advogado_id)]));

const mediana = (v) => {
  if (!v.length) return null;
  const s = v.slice().sort((a, b) => a - b), m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const media = (v) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);
const soDia = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function agregar({ desde, ate, quem, telefone, departamento }) {
  const t0 = desde ? new Date(desde).getTime() : -Infinity;
  const t1 = ate ? new Date(ate).getTime() : Date.now();
  const agora = Date.now(), janela = JANELA_H * 3600e3;
  const meu = (a) => !quem || (a.dono && a.dono.id === quem);

  // OS RECORTES DE LUGAR entram antes de tudo, como no banco: um telefone, ou
  // todos os telefones de um departamento.
  const doDep = new Map(ADVOGADOS.map((a) => [String(a.id), String(a.departamento_id)]));
  const lugar = (advId) =>
    (!telefone || String(advId) === String(telefone)) &&
    (!departamento || doDep.get(String(advId)) === String(departamento));

  const noPeriodo = ROTEIRO.filter((a) => a.inicio >= t0 && a.inicio <= t1 && lugar(a.adv));
  const meus = noPeriodo.filter(meu);
  const tamanho = t0 === -Infinity ? null : t1 - t0;
  const antesDe = tamanho == null ? null : t0 - tamanho;
  const anteriores = tamanho == null ? [] :
    ROTEIRO.filter((a) => a.inicio >= antesDe && a.inicio < t0 && lugar(a.adv)).filter(meu);

  // ---- mensagens ----
  const conta = (de, ateQuando, comEscopo) => {
    let enviadas = 0, recebidas = 0, aparelho = 0, semId = 0;
    const porTel = new Map(), porPessoa = new Map(), porRotulo = new Map();
    for (const m of MENSAGENS) {
      const t = new Date(m.criado_em).getTime();
      if (t < de || t > ateQuando) continue;
      const a = ROTEIRO[ATEND_DA_MSG.get(m.id)];
      if (!lugar(TEL_DA_CONVERSA.get(String(m.conversa_id)))) continue;
      const enviada = m.origem === "advogado";
      const rotulo = (m.enviado_por || "").trim();
      const ehAparelho = rotulo === "WhatsApp";
      const ehRotulo = !m.enviado_por_id && NAO_PESSOA.has(rotulo.toLowerCase());
      const id = m.enviado_por_id || null;

      if (comEscopo && quem) {
        // A minha ENVIADA é a que eu escrevi. A minha RECEBIDA é a que chegou
        // num atendimento que eu peguei — mensagem que chega não tem autor.
        if (enviada && id !== quem) continue;
        if (!enviada && !(a && a.dono && a.dono.id === quem)) continue;
      }
      if (enviada) enviadas++; else recebidas++;

      const tel = TEL_DA_CONVERSA.get(String(m.conversa_id));
      if (tel) {
        const r = porTel.get(tel) || { advogado_id: tel, atendimentos: 0, recebidas: 0, enviadas: 0 };
        r[enviada ? "enviadas" : "recebidas"]++;
        porTel.set(tel, r);
      }
      if (!enviada) continue;
      if (ehAparelho) { aparelho++; continue; }
      if (ehRotulo) { porRotulo.set(rotulo, (porRotulo.get(rotulo) || 0) + 1); continue; }
      if (!id) semId++;
      const chave = id ? `id:${id}` : `nome:${rotulo || "(sem nome)"}`;
      const r = porPessoa.get(chave) || { chave, id, nome: rotulo || "(sem nome)", enviadas: 0 };
      r.enviadas++;
      porPessoa.set(chave, r);
    }
    return { enviadas, recebidas, aparelho, semId, porTel, porPessoa, porRotulo };
  };

  const m = conta(t0, t1, true);            // recortado em mim
  const mTodos = conta(t0, t1, false);      // o escritório, para o ranking
  const mAntes = tamanho == null ? { enviadas: 0, recebidas: 0 } : conta(antesDe, t0 - 1, true);

  // ---- as séries ----
  const dias = tamanho == null
    ? (Date.now() - Math.min(...ROTEIRO.map((a) => a.inicio))) / dia
    : tamanho / dia;
  const passo = dias <= 62 ? "day" : dias <= 400 ? "week" : "month";
  const balde = (t) => {
    const d = soDia(t);
    if (passo === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));   // segunda
    if (passo === "month") d.setDate(1);
    return iso(d);
  };
  const inicioReal = tamanho == null ? Math.min(...ROTEIRO.map((a) => a.inicio)) : t0;
  const serie = new Map();
  for (let d = soDia(inicioReal); d.getTime() <= t1; d.setDate(d.getDate() + 1)) {
    const b = balde(d.getTime());
    if (!serie.has(b)) serie.set(b, { quando: b, atendimentos: 0, enviadas: 0, recebidas: 0, resp: [], esp: [] });
  }
  const pega = (t) => serie.get(balde(t));
  meus.forEach((a) => {
    const s = pega(a.inicio); if (!s) return;
    s.atendimentos++;
    if (a.espera != null) s.esp.push(a.espera);
    a.respostas.forEach((r) => s.resp.push(r));
  });
  for (const msg of MENSAGENS) {
    const t = new Date(msg.criado_em).getTime();
    if (t < t0 || t > t1) continue;
    if (!lugar(TEL_DA_CONVERSA.get(String(msg.conversa_id)))) continue;
    const a = ROTEIRO[ATEND_DA_MSG.get(msg.id)];
    const enviada = msg.origem === "advogado";
    if (quem) {
      if (enviada && msg.enviado_por_id !== quem) continue;
      if (!enviada && !(a && a.dono && a.dono.id === quem)) continue;
    }
    const s = pega(t); if (!s) continue;
    s[enviada ? "enviadas" : "recebidas"]++;
  }
  const por_periodo = [...serie.values()]
    .sort((a, b) => (a.quando < b.quando ? -1 : 1))
    .map((s) => ({ quando: s.quando, atendimentos: s.atendimentos, enviadas: s.enviadas,
                   recebidas: s.recebidas, resposta: mediana(s.resp), espera: mediana(s.esp) }));

  // ---- mapa de horários: a grade inteira, com os zeros ----
  const mapa = [];
  for (let d = 0; d < 7; d++) for (let h = 0; h < 24; h++) mapa.push({ dia: d, hora: h, atendimentos: 0 });
  meus.forEach((a) => {
    const q = new Date(a.inicio);
    mapa[q.getDay() * 24 + q.getHours()].atendimentos++;
  });

  // ---- telefones ----
  const porTel = m.porTel;
  meus.forEach((a) => {
    const r = porTel.get(a.adv) || { advogado_id: a.adv, atendimentos: 0, recebidas: 0, enviadas: 0 };
    r.atendimentos++;
    porTel.set(a.adv, r);
  });

  // ---- ranking: SEMPRE o escritório inteiro ----
  const rank = new Map();
  noPeriodo.forEach((a) => {
    if (!a.dono) return;
    // A MESMA CHAVE QUE AS MENSAGENS USAM. Com `id:null` para quem não tem id,
    // o "Atendente Antigo" saía DUAS VEZES no ranking — uma com os
    // atendimentos e nenhuma mensagem, outra com as mensagens e nenhum
    // atendimento. É a mesma cara do defeito do "Max Canaverde duplicado", e
    // apareceu na primeira olhada na tela pronta.
    const chave = a.dono.id ? `id:${a.dono.id}` : `nome:${a.dono.nome}`;
    const r = rank.get(chave) || { chave, id: a.dono.id, nome: a.dono.nome, atendimentos: 0, enviadas: 0, esp: [], resp: [] };
    r.atendimentos++;
    if (a.espera != null) r.esp.push(a.espera);
    a.respostas.forEach((x) => r.resp.push(x));
    rank.set(chave, r);
  });
  mTodos.porPessoa.forEach((p, chave) => {
    const r = rank.get(chave) || { chave, id: p.id, nome: p.nome, atendimentos: 0, enviadas: 0, esp: [], resp: [] };
    r.enviadas = p.enviadas;
    if (!r.nome) r.nome = p.nome;
    rank.set(chave, r);
  });

  const esperas = meus.filter((a) => a.espera != null).map((a) => a.espera);
  const respostas = meus.flatMap((a) => a.respostas);

  return {
    de: desde || null, ate: new Date(t1).toISOString(), fuso: "bancada", passo,
    janela_horas: JANELA_H, so_meu: !!quem, quem: quem || null,
    telefone: telefone || null, departamento: departamento || null,
    total: {
      atendimentos: meus.length,
      aguardando: meus.filter((a) => a.espera == null).length,
      em_andamento: meus.filter((a) => a.espera != null && agora - a.fim <= janela).length,
      // `espera != null` também aqui: os três estados são excludentes e têm de
      // somar o total. Sem isso o atendimento sem resposta e já frio entrava em
      // "aguardando" E em "encerrados", e a barra somava mais do que o total.
      encerrados: meus.filter((a) => a.espera != null && agora - a.fim > janela).length,
      enviadas: m.enviadas, recebidas: m.recebidas,
      notas: NOTAS.filter((n) => {
        const t = new Date(n.criado_em).getTime();
        return t >= t0 && t <= t1 && (!quem || n.autor_id === quem);
      }).length,
      respostas: respostas.length, resposta_mediana: mediana(respostas), resposta_media: media(respostas),
      esperas: esperas.length, espera_mediana: mediana(esperas), espera_media: media(esperas),
      sem_atendente: noPeriodo.filter((a) => !a.dono).length,
    },
    antes: {
      atendimentos: anteriores.length, enviadas: mAntes.enviadas, recebidas: mAntes.recebidas,
      // O mesmo teto do SQL: acima de 92 dias a comparação não sai, porque
      // calculá-la obrigaria a ler o dobro do período.
      existe: tamanho != null && tamanho <= 92 * dia
              && antesDe >= Math.min(...ROTEIRO.map((a) => a.inicio)),
    },
    por_periodo,
    por_hora: mapa,
    por_telefone: [...porTel.values()],
    por_atendente: [...rank.values()].map((r) => ({
      chave: r.chave, id: r.id, nome: r.nome, atendimentos: r.atendimentos, enviadas: r.enviadas,
      espera_mediana: mediana(r.esp), resposta_mediana: mediana(r.resp),
    })),
    por_rotulo: [...mTodos.porRotulo.entries()].map(([nome, enviadas]) => ({ nome, enviadas })),
    aparelho: mTodos.aparelho, sem_id: mTodos.semId, outras: 0,
  };
}

// O que a bancada CONTÉM, para o teste conferir contra a tela. Sai do roteiro,
// que é a origem de tudo — e não de uma segunda leitura das mensagens.
export const ESPERADO = {
  totalDeLinhas: MENSAGENS.length,
  atendimentos: ROTEIRO.length,
  // Um autor de cada tipo, para o teste não precisar cravar nome nenhum. Um
  // nome escrito à mão no teste vira reprovação falsa no dia em que a bancada
  // muda — foi o que aconteceu ao trocar "Rodrigo Alves" por "Rodrigo Sousa".
  eu: { id: "u1", nome: AUTORES[0].nome },
  outroAutor: AUTORES[1].nome,
  autorSemId: AUTORES[2].nome,
  rotulos: ROTULOS_NAO_PESSOA,
  telefoneMudo: ADVOGADOS.find((a) => a.id === "a12").nome,
  // O telefone com mais de mil conversas, para os testes que só fazem sentido
  // em base grande. Vem por aqui, e não por `import("/src/bancada.js")`: no
  // build de produção esse caminho não existe, e é justamente o build de
  // produção que a equipe usa.
  fundo: { telefone: TELEFONE_FUNDO.nome, nome: NOME_LA_NO_FUNDO,
           texto: TEXTO_LA_NO_FUNDO, total: FUNDO_TOTAL, naoLidas: FUNDO_NAO_LIDAS },
  janelaHoras: JANELA_H,
  /** O mesmo que a tela vai pedir, para o teste comparar número a número. */
  painel: (dias, quem, telefone, departamento) => agregar({
    desde: dias == null ? null : new Date(Date.now() - dias * dia).toISOString(),
    ate: null, quem: quem || null, telefone: telefone || null,
    departamento: departamento || null,
  }),
  telefones: ADVOGADOS.map((a) => ({ id: a.id, nome: a.nome, departamento_id: a.departamento_id })),
  departamentos: DEPARTAMENTOS.map((x) => ({ id: x.id, nome: x.nome })),
};
if (typeof globalThis !== "undefined") globalThis.__ESPERADO = ESPERADO;

export const supabase = {
  from: (t) => consulta(t),
  // Quem chamar uma função que não existe recebe o mesmo erro que o Supabase
  // devolve (PGRST202), para o caminho de "falta rodar o SQL" também ser
  // testável em vez de imaginado.
  rpc: async (nome, args) => {
    // QUEM JÁ ESCREVEU POR ESTE TELEFONE, e as conversas de quem se escolher.
    //
    // A de verdade casa por id E, no histórico antigo que não tem id, pelo
    // NOME sem acento. As duas coisas precisam estar aqui: uma bancada que
    // casasse só por id deixaria passar um filtro que não acha nada do que foi
    // dito antes de a coluna existir — e isso é a maior parte do histórico.
    const semAcentoN = (t) => String(t ?? "").normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

    // TROCAR A PR\u00d3PRIA FOTO \u2014 s\u00f3 a pr\u00f3pria, s\u00f3 essa coluna. No banco \u00e9 uma
    // fun\u00e7\u00e3o `security definer` com `where id = auth.uid()`, e \u00e9 isso que a
    // bancada imita: `p_url` chega, `auth.uid()` n\u00e3o.
    if (nome === "salvar_minha_foto") {
      if (globalThis.__SEM_EQUIPE) {
        return { data: null, error: { code: "PGRST202", message: "Could not find the function public.salvar_minha_foto" } };
      }
      const eu = TABELAS.usuarios[0];
      if (eu) eu.foto_url = String((args && args.p_url) || "").trim() || null;
      await espera(80);
      return { data: null, error: null };
    }

    if (nome === "atendentes_do_telefone" || nome === "conversas_por_atendente") {
      if (globalThis.__SEM_FILTRO_DE_ATENDENTE) {
        return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${nome}` } };
      }
      const advId = args && args.p_advogado;
      const minhas = TABELAS.conversas.filter((c) => String(c.advogado_id) === String(advId));
      const daqui = new Map(minhas.map((c) => [String(c.id), c]));
      const porNomeDoUsuario = new Map(
        (TABELAS.usuarios || []).map((u) => [semAcentoN(u.nome), String(u.id)]));

      /** Quem falou em cada conversa deste telefone — id quando há, e o nome
       *  resolvido para id quando não há. */
      const quemFalou = new Map();   // conversaId → Set(usuarioId)
      // O NOME QUE A MENSAGEM CARREGA, para quem não está em `usuarios`.
      // A função de verdade faz `coalesce(nome do usuário, nome da mensagem)`:
      // há ids em `mensagens` de gente que saiu do escritório, e sem essa queda
      // a lista mostraria "(sem nome)" onde a produção mostra o nome da pessoa.
      const nomeDaMensagem = new Map();
      for (const m of TABELAS.mensagens) {
        const k = String(m.conversa_id);
        if (!daqui.has(k)) continue;
        const id = m.enviado_por_id
          ? String(m.enviado_por_id)
          : porNomeDoUsuario.get(semAcentoN(m.enviado_por));
        if (!id) continue;
        if (m.enviado_por && !nomeDaMensagem.has(id)) nomeDaMensagem.set(id, m.enviado_por);
        if (!quemFalou.has(k)) quemFalou.set(k, new Set());
        quemFalou.get(k).add(id);
      }

      if (nome === "atendentes_do_telefone") {
        const conta = new Map();
        for (const ids of quemFalou.values()) for (const id of ids) conta.set(id, (conta.get(id) || 0) + 1);
        // QUEM ESTÁ LOGADO ENTRA SEMPRE, ainda que com zero. "De quais conversas
        // eu participei" é a pergunta que dá origem ao recurso: ela precisa ter
        // resposta em todo telefone, inclusive quando a resposta é "nenhuma".
        const eu = (TABELAS.usuarios[0] || {}).id;
        if (eu && !conta.has(String(eu))) conta.set(String(eu), 0);
        const lista = [...conta.entries()].map(([id, conversas]) => ({
          id,
          nome: ((TABELAS.usuarios || []).find((u) => String(u.id) === id) || {}).nome
                || nomeDaMensagem.get(id) || "(sem nome)",
          conversas,
        })).sort((a, b) => b.conversas - a.conversas || String(a.nome).localeCompare(String(b.nome)));
        await espera(120);
        return { data: lista, error: null };
      }

      const pedidos = (args && args.p_usuarios) || [];
      const todos = !!(args && args.p_todos);
      const saida = [];
      for (const [k, ids] of quemFalou) {
        const quantos = pedidos.filter((u) => ids.has(String(u))).length;
        if (todos ? quantos === pedidos.length : quantos > 0) {
          saida.push({ id: daqui.get(k).id, ultima_atividade: daqui.get(k).ultima_atividade });
        }
      }
      saida.sort((a, b) => String(b.ultima_atividade || "").localeCompare(String(a.ultima_atividade || "")));
      await espera(150);
      return { data: saida.slice(0, (args && args.p_limite) || 500), error: null };
    }

    // A BUSCA DO BANCO.
    //
    // A de verdade compara SEM ACENTO (é o `zorvin_sem_acento` do SQL) e nasce
    // recortada no telefone. As duas coisas são o conserto, então as duas
    // precisam estar aqui — uma bancada que compare com acento, ou que olhe o
    // escritório inteiro, deixaria o defeito passar de novo.
    if (nome === "buscar_conversas") {
      if (globalThis.__SEM_BUSCA_NO_BANCO) {
        return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${nome}` } };
      }
      if (globalThis.__QUEBRAR_BUSCA) {
        return { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } };
      }
      const semAcento = (t) => String(t ?? "").normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const termo = semAcento(args && args.p_termo);
      const digitos = String((args && args.p_termo) || "").replace(/\D/g, "");
      const advId = args && args.p_advogado;
      const minhas = TABELAS.conversas.filter((c) => String(c.advogado_id) === String(advId));
      const porId = new Map(TABELAS.contatos.map((ct) => [String(ct.id), ct]));
      const saida = new Map();

      for (const c of minhas) {
        const ct = porId.get(String(c.contato_id)) || c.contato || {};
        const campo = semAcento([ct.nome, ct.vantoro_nome, ct.nome_zorvin, ct.numero].join(" "));
        if (termo.length >= 3 && campo.includes(termo)) {
          saida.set(String(c.id), { id: c.id, motivo: "nome", trecho: null,
                                    ultima_atividade: c.ultima_atividade });
        } else if (digitos.length >= 4 && String(ct.numero || "").includes(digitos)) {
          saida.set(String(c.id), { id: c.id, motivo: "numero", trecho: null,
                                    ultima_atividade: c.ultima_atividade });
        }
      }
      if (termo.length >= 3) {
        const daqui = new Set(minhas.map((c) => String(c.id)));
        const recentes = TABELAS.mensagens
          .filter((m) => daqui.has(String(m.conversa_id)) && semAcento(m.texto).includes(termo))
          .sort((a, b) => String(b.criado_em || "").localeCompare(String(a.criado_em || "")));
        for (const m of recentes) {
          const k = String(m.conversa_id);
          if (saida.has(k)) continue;
          const c = minhas.find((x) => String(x.id) === k);
          saida.set(k, { id: m.conversa_id, motivo: "mensagem", trecho: m.texto,
                         ultima_atividade: c && c.ultima_atividade,
                         mensagem_id: String(m.id), mensagem_em: m.criado_em });
        }
      }
      const lista = [...saida.values()]
        .sort((a, b) => String(b.ultima_atividade || "").localeCompare(String(a.ultima_atividade || "")))
        .slice(0, (args && args.p_limite) || 80);
      await espera(120);
      return { data: lista, error: null };
    }

    if (nome !== "painel_dashboard" || !globalThis.__TEM_FUNCAO_PAINEL) {
      return { data: null, error: { code: "PGRST202", message: `Could not find the function public.${nome}` } };
    }
    // O RECORTE É DO BANCO, e não do navegador: quem não administra não
    // escolhe. A função de verdade faz o mesmo, com `zorvin_admin()`.
    const souAdmin = !!(TABELAS.usuarios[0] && TABELAS.usuarios[0].admin);
    const quem = souAdmin ? (args && args.p_quem) || null : (TABELAS.usuarios[0] || {}).id || null;
    return { data: agregar({
      desde: args && args.p_desde, ate: args && args.p_ate, quem,
      telefone: (args && args.p_telefone) || null,
      departamento: (args && args.p_departamento) || null,
    }), error: null };
  },
  auth: {
    getSession: async () => ({ data: { session: { access_token: "jwt-de-mentira", user: { id: "u1", email: "rodrigo@ropelimi",
      // O nome VELHO, congelado na criação da conta. Se a tela mostrar este,
      // a correção não funcionou.
      user_metadata: { nome: "rodrigo" } } } } }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    updateUser: async () => ({ error: null }),
  },
  channel: () => {
    const canal = { on: () => canal, subscribe: () => canal, unsubscribe: () => {} };
    return canal;
  },
  removeChannel: () => {},
  storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "" } }) }) },
};
