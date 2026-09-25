// A ESPERA COMEÇA NA PRIMEIRA MENSAGEM SEM RESPOSTA
//
// PEDIDO DO RODRIGO, 25/09: as atendentes do SAC dizem que a organização não
// fica clara. Elas trabalham de baixo para cima numa lista ordenada pela
// ÚLTIMA mensagem — e é isso que erra. O exemplo dele, com hoje em 25/09:
//
//   Cliente A  escreveu 21/09, escreveu DE NOVO 24/09, sem resposta
//   Cliente C  escreveu 24/09, sem resposta
//
// Pela última mensagem os dois são "24/09". Mas A espera desde 21/09, quatro
// vezes mais. A equipe zera o dia achando que atendeu todo mundo, e A fica lá
// — parecendo tão novo quanto quem acabou de chegar.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
// Duas metades, e a segunda importa tanto quanto a primeira:
//
//   1. na ordem NOVA, A vem antes de C — a fila é pela espera;
//   2. na ordem de SEMPRE, C vem antes de A — o defeito continua ali, de
//      propósito, porque "mais recentes" é outra pergunta e tem de continuar
//      respondendo a ela.
//
// Sem a segunda, uma ordem que virasse a lista inteira do avesso em todos os
// modos passaria verde.
//
// E a terceira metade, que não é sobre ordem: SEM O SQL RODADO, a ordem nova
// nem é oferecida. Ela pede uma coluna que não existe, e uma consulta que
// falha não devolve "sem ordem" — devolve lista de conversas NENHUMA.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();

/** Exatamente `n` dias de calendário atrás, ao meio-dia.
 *
 *  Ao MEIO-DIA de propósito: "agora menos 26 horas" cai em ontem ou anteontem
 *  conforme a hora em que a prova roda, e uma conferência que muda de resposta
 *  às 23h não é conferência. */
function diasAtras(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}
const hojeCedo = () => { const d = new Date(); d.setHours(0, 30, 0, 0); return d.toISOString(); };
const segundosAtras = (s) => new Date(Date.now() - s * 1000).toISOString();

async function abrirPainel({ semColuna = false, semente = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((d) => {
    globalThis.__SEM_ESPERA = d.semColuna;
    globalThis.__SEMENTE = d.semente || undefined;
    globalThis.__ESCRITA_SEM_EFEITO = [];
    globalThis.__ERRO_NA_GRAVACAO = {};
  }, { semColuna, semente });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** O telefone que o painel ABRE, e o feitio de uma mensagem.
 *
 *  O que abre, e não um escolhido a dedo: trocar de telefone é um clique a
 *  mais que pode falhar por motivo nenhum a ver com esta prova — e aí ela
 *  reprovaria falando de ordem quando o que faltou foi o clique. Aconteceu na
 *  primeira volta desta prova. */
async function molde() {
  const { ctx, page } = await abrirPainel({});
  const m = await page.evaluate(() => {
    const id = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(id));
    const msg = (globalThis.__TABELAS.mensagens || []).find((x) => String(x.conversa_id) === String(id));
    // E O TELEFONE GRANDE, o das 1.200 conversas. É nele que se mede se a
    // ordem foi para o BANCO: a lista vem em páginas de 200, e uma conversa
    // que espera há 500 dias mas cuja última mensagem é de meses atrás só
    // aparece se quem ordenou foi o banco. Reordenar a página carregada dá
    // "quem mais espera entre as 200 que vieram", com cara de "quem mais
    // espera" — e é justamente o cliente esquecido que mora fora das 200.
    const quantas = new Map();
    for (const x of (globalThis.__TABELAS.conversas || [])) {
      quantas.set(x.advogado_id, (quantas.get(x.advogado_id) || 0) + 1);
    }
    let maior = null;
    for (const [adv, n] of quantas) if (!maior || n > maior.n) maior = { adv, n };
    const telGrande = (globalThis.__TABELAS.advogados || []).find((a) => a.id === maior.adv);
    return c ? { advogado_id: c.advogado_id, mensagem: msg || null,
                 grandeId: maior && maior.adv, grandeNome: telGrande && telGrande.nome,
                 grandeQuantas: maior && maior.n } : null;
  });
  await ctx.close();
  return m;
}

const base = await molde();
ok("aprendi o feitio de uma conversa de verdade", !!base?.advogado_id);
if (!base?.advogado_id) { await nav.close(); process.exit(1); }

function conversa(id, nome, numero, ultima, espera) {
  const contato = { nome, numero, foto_url: null, vantoro_nome: null, nome_zorvin: null };
  return {
    id, contato_id: `ct-${id}`, advogado_id: base.advogado_id,
    fixada: false, arquivada: false, favorita: false, nao_lidas: 1,
    ultima_mensagem: "oi", ultima_atividade: ultima, esperando_desde: espera,
    frente: null, vantoro_nome: null, digitando_ate: null,
    atendendo_por: null, atendendo_em: null, contato,
  };
}
// O caso do relato, com os dois clientes que a lista de hoje confunde.
const SEMENTE = {
  contatos: [
    { id: "ct-cv-a", nome: "ZZ Cliente A", numero: "5511960001111" },
    { id: "ct-cv-c", nome: "ZZ Cliente C", numero: "5511960002222" },
    { id: "ct-cv-d", nome: "ZZ Cliente D", numero: "5511960003333" },
    { id: "ct-cv-e", nome: "ZZ Cliente E", numero: "5511960004444" },
  ],
  conversas: [
    // Escreveu há 40 dias e DE NOVO agora há pouco. A última mensagem é
    // recentíssima; a espera, antiquíssima. É o Cliente A.
    conversa("cv-a", "ZZ Cliente A", "5511960001111", segundosAtras(60), diasAtras(40)),
    // Escreveu pela primeira vez ontem, e é a mensagem MAIS recente das quatro.
    conversa("cv-c", "ZZ Cliente C", "5511960002222", segundosAtras(30), diasAtras(1)),
    // Já foi respondido: não espera ninguém.
    conversa("cv-d", "ZZ Cliente D", "5511960003333", segundosAtras(45), null),
    // Escreveu HOJE de manhã: espera, mas ainda não faz um dia.
    conversa("cv-e", "ZZ Cliente E", "5511960004444", segundosAtras(20), hojeCedo()),
  ],
  mensagens: ["cv-a", "cv-c", "cv-d", "cv-e"].map((id, i) => ({
    ...(base.mensagem || {}), id: `m-${id}`, conversa_id: id, texto: "oi",
    criado_em: segundosAtras(100 + i),
  })),
};

const nomesNaTela = (page) => page.locator("[data-conversa-nome]").allTextContents();
const posicao = (nomes, quem) => nomes.findIndex((n) => n.includes(quem));

async function escolherOrdem(page, chave) {
  await page.locator("[data-ordem]").first().click();
  await page.waitForTimeout(300);
  const opcao = page.locator(`[data-ordem-opcao="${chave}"]`);
  if (!(await opcao.count())) return false;
  await opcao.first().click();
  await page.waitForTimeout(1800);
  return true;
}

/** O rótulo de espera daquela linha ("esperando há 4 dias"), ou null. */
const esperaDaLinha = (page, convId) => page.evaluate((id) => {
  const linha = document.querySelector(`[data-conversa-id="${id}"]`);
  if (!linha) return { achei: false };
  const marca = linha.querySelector("[data-espera]");
  return { achei: true, texto: marca ? marca.innerText.trim() : null };
}, convId);

// ==================================================================
console.log("\nA ordem de SEMPRE continua respondendo o que ela responde");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: SEMENTE });
  const nomes = await nomesNaTela(page);
  const a = posicao(nomes, "ZZ Cliente A"), c = posicao(nomes, "ZZ Cliente C");
  ok("os dois clientes do exemplo estão na lista", a >= 0 && c >= 0, nomes.join(" | "));
  // O DEFEITO, MEDIDO: em "mais recentes", C aparece ACIMA de A — e A espera
  // há 40 dias. Esta conferência guarda o defeito de propósito: "recentes" é
  // outra pergunta, e tem de continuar respondendo a ela.
  ok("em 'mais recentes', quem escreveu por último vem primeiro (C acima de A)",
     c >= 0 && a >= 0 && c < a, `A na posição ${a}, C na ${c}`);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nNa ordem NOVA, quem espera há mais tempo sobe — mesmo tendo escrito hoje");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: SEMENTE });
  const tem = await escolherOrdem(page, "esperando");
  ok("a ordem 'Esperando há mais tempo' é oferecida", tem);
  if (tem) {
    const nomes = await nomesNaTela(page);
    const a = posicao(nomes, "ZZ Cliente A");
    const c = posicao(nomes, "ZZ Cliente C");
    const d = posicao(nomes, "ZZ Cliente D");
    // O CONSERTO: A sobe, apesar de a última mensagem dele ser a mais nova.
    ok("A vem antes de C — a fila é pela espera, não pela última mensagem",
       a >= 0 && c >= 0 && a < c, `A na posição ${a}, C na ${c} — ${nomes.join(" | ")}`);
    // QUEM NÃO ESPERA VAI PARA O FIM. Sem `nullsFirst: false`, o Postgres põe
    // os nulos na frente e a fila abre por quem não está esperando nada.
    ok("e quem já foi respondido fica DEPOIS dos dois",
       d >= 0 && d > a && d > c, `D na posição ${d}, A na ${a}, C na ${c}`);
    // A PÍLULA DIZ EM QUE ORDEM A LISTA ESTÁ. Contrato antigo desta tela: um
    // controle que troca e não conta o estado transforma "achei estranho" em
    // "está quebrado".
    ok("e a pílula da ordem passa a dizer 'Esperando'",
       (await page.locator("[data-ordem]").first().innerText()).includes("Esperando"));
  } else {
    ok("A vem antes de C — a fila é pela espera, não pela última mensagem", false);
    ok("e quem já foi respondido fica DEPOIS dos dois", false);
    ok("e a pílula da ordem passa a dizer 'Esperando'", false);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nA linha diz há quantos dias, e a conta começa na primeira sem resposta");
{
  const { ctx, page, estouros } = await abrirPainel({ semente: SEMENTE });
  const a = await esperaDaLinha(page, "cv-a");
  const c = await esperaDaLinha(page, "cv-c");
  const d = await esperaDaLinha(page, "cv-d");
  const e = await esperaDaLinha(page, "cv-e");
  ok("as quatro conversas de prova estão na lista",
     a.achei && c.achei && d.achei && e.achei);
  // 40 DIAS, e não "agora há pouco". A última mensagem de A é de um minuto
  // atrás; a espera dele é de 40 dias. É o coração do pedido.
  ok("o Cliente A diz 40 dias, e não a idade da última mensagem",
     a.texto === "esperando há 40 dias", JSON.stringify(a));
  ok("o Cliente C diz 1 dia, no singular", c.texto === "esperando há 1 dia", JSON.stringify(c));
  // O CONTRASTE, duas vezes. Sem ele, um rótulo em toda linha passaria — e aí
  // o sinal vira ruído e deixa de ser lido no dia em que importa.
  ok("quem já foi respondido não mostra rótulo nenhum", d.texto === null, JSON.stringify(d));
  ok("e quem escreveu HOJE também não — a hora ali em cima já responde",
     e.texto === null, JSON.stringify(e));
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nA ordem vai para o BANCO: o esquecido de 500 dias aparece, e ele está na página 6");
{
  // AS DUAS SABOTAGENS QUE VAZARAM NA PRIMEIRA VOLTA desta prova moram aqui.
  //
  // Eu media a ordem num telefone pequeno, onde TUDO cabe na primeira página —
  // e ali a reordenação que a tela faz ao emendar as duas consultas já deixa a
  // lista certa. Com isso, trocar a ordem do banco por `ultima_atividade`
  // PASSAVA, e tirar o `nullsFirst` também. A prova dizia medir a fila e media
  // a arrumação da página.
  //
  // Aqui é o telefone de 1.200 conversas. O esquecido tem a última mensagem de
  // meses atrás — fora das 200 primeiras por recência — e espera há 500 dias.
  // Ele só chega à tela se quem ordenou foi o banco.
  ok("achei o telefone grande da bancada",
     !!base.grandeId && !!base.grandeNome, JSON.stringify({ n: base.grandeQuantas, nome: base.grandeNome }));
  const semente = {
    contatos: [{ id: "ct-cv-fundo", nome: "ZZ Esquecido No Fundo", numero: "5511960009999" }],
    conversas: [{
      id: "cv-fundo", contato_id: "ct-cv-fundo", advogado_id: base.grandeId,
      fixada: false, arquivada: false, favorita: false, nao_lidas: 1,
      ultima_mensagem: "oi", frente: null, vantoro_nome: null, digitando_ate: null,
      atendendo_por: null, atendendo_em: null,
      ultima_atividade: diasAtras(120),
      esperando_desde: diasAtras(500),
      contato: { nome: "ZZ Esquecido No Fundo", numero: "5511960009999", foto_url: null,
                 vantoro_nome: null, nome_zorvin: null },
    }],
    mensagens: [{ ...(base.mensagem || {}), id: "m-cv-fundo", conversa_id: "cv-fundo",
                  texto: "oi", criado_em: diasAtras(500) }],
  };
  const { ctx, page, estouros } = await abrirPainel({ semente });
  // A barra mostra as INICIAIS; o nome inteiro é o valor de `data-telefone`.
  const tel = page.locator(`[data-telefone="${base.grandeNome}"]`);
  const abriu = (await tel.count()) > 0;
  ok("o telefone grande abre", abriu);
  if (abriu) {
    await tel.first().click();
    await page.waitForTimeout(2500);
    // O CONTROLE, e sem ele a conferência de baixo não prova nada: na ordem de
    // sempre o esquecido está mesmo fora da vista.
    const antes = await nomesNaTela(page);
    ok("na ordem de sempre, o esquecido NÃO está na tela",
       posicao(antes, "ZZ Esquecido No Fundo") < 0,
       `apareceu na posição ${posicao(antes, "ZZ Esquecido No Fundo")} de ${antes.length}`);
    const trocou = await escolherOrdem(page, "esperando");
    ok("a ordem nova é oferecida no telefone grande", trocou);
    if (trocou) {
      await page.waitForTimeout(1500);
      const depois = await nomesNaTela(page);
      const p = posicao(depois, "ZZ Esquecido No Fundo");
      ok("na fila de espera ele aparece — a ordem veio do banco", p >= 0,
         `${depois.length} conversas na tela e ele não está em nenhuma`);
      // E NO ALTO: é o que espera há mais tempo de todos.
      ok("e aparece no alto, porque é o que espera há mais tempo", p >= 0 && p <= 2,
         `posição ${p}`);
    } else {
      ok("na fila de espera ele aparece — a ordem veio do banco", false);
      ok("e aparece no alto, porque é o que espera há mais tempo", false);
    }
  } else {
    ok("na ordem de sempre, o esquecido NÃO está na tela", false);
    ok("a ordem nova é oferecida no telefone grande", false);
    ok("na fila de espera ele aparece — a ordem veio do banco", false);
    ok("e aparece no alto, porque é o que espera há mais tempo", false);
  }
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nSem o SQL rodado, a ordem nova nem é oferecida");
{
  // A CONSULTA PEDIRIA UMA COLUNA QUE NÃO EXISTE, e uma consulta que falha não
  // devolve "sem ordem": devolve lista de conversas NENHUMA. Oferecer a opção
  // num banco sem o script seria oferecer um botão que apaga a tela.
  const { ctx, page, estouros } = await abrirPainel({ semColuna: true, semente: SEMENTE });
  const nomes = await nomesNaTela(page);
  ok("a lista de conversas continua de pé", nomes.length > 0, `${nomes.length} conversas`);
  await page.locator("[data-ordem]").first().click();
  await page.waitForTimeout(300);
  ok("a ordem 'Esperando há mais tempo' NÃO aparece no menu",
     (await page.locator('[data-ordem-opcao="esperando"]').count()) === 0);
  // E AS DUAS DE SEMPRE CONTINUAM. Esconder a nova não pode virar esconder o
  // menu inteiro.
  ok("e as duas ordens de sempre continuam lá",
     (await page.locator('[data-ordem-opcao="recentes"]').count()) === 1
     && (await page.locator('[data-ordem-opcao="antigas"]').count()) === 1);
  ok("nem o rótulo de espera aparece nas linhas",
     (await page.locator("[data-espera]").count()) === 0);
  ok("sem erro de JavaScript no caminho", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
