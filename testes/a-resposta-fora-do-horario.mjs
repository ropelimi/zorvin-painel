// A RESPOSTA AUTOMÁTICA FORA DO HORÁRIO (09/10) — a metade do painel.
//
// Quem decide e manda é a PONTE, com a conta do banco (script 021, provado lá
// num Postgres de verdade). O que esta prova guarda é o que é da tela:
//
//   1. a aba "Fora do horário" só existe com o script;
//   2. a PRÉVIA é a conta do banco feita com o que está NA TELA, ainda não
//      salvo — é ali que se descobre o dia esquecido;
//   3. não dá para ligar sem texto, nem salvar dia que fecha antes de abrir;
//   4. salvar grava o que se vê, e a releitura mostra o que ficou;
//   5. os feriados entram e saem da lista do escritório;
//   6. na conversa, a resposta é uma bolha NOSSA, sem menu, que diz se saiu
//      ou não saiu — e aparece sozinha quando sai com a conversa aberta;
//   7. sem o script, a conversa abre como sempre, e calada;
//   8. a explicação diz que ela NÃO INTERROMPE uma conversa (script 022), com
//      a janela que o BANCO usa — e não um número escrito na tela.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { minutosDaJanela, fraseDaJanela } from "../src/foraDoHorario.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
// SEXTA, 09/10/2026, NO FUSO DO ESCRITÓRIO. A segunda 12/10 é feriado na
// bancada (como o 021 semeia), então "fechado agora" volta na TERÇA.
const SEXTA_19H = new Date("2026-10-09T22:00:00Z");
const SEXTA_10H = new Date("2026-10-09T13:00:00Z");

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.first().innerText().catch(() => "");

async function abrir({ quando = SEXTA_19H, sem = false, semente = null, quebrar = null, largura = 1400,
                       carencia = null } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários, e a
  // última escrita é a que vale.
  await page.addInitScript((b) => {
    globalThis.__SEM_FORA_DO_HORARIO = b.sem;
    globalThis.__SEMENTE = b.semente;
    globalThis.__QUEBRAR = b.quebrar;
    globalThis.__CARENCIA = b.carencia;
  }, { sem, semente, quebrar, carencia });
  await page.clock.setFixedTime(quando);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

async function abrirAAba(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(700);
  if (!(await clicar(page.locator("[data-aba-fora-do-horario]")))) return false;
  await page.waitForTimeout(900);
  return true;
}
const previa = (page) => texto(page.locator("[data-fora-previa]"));
const linhaDe = (page, depId) => page.evaluate((id) =>
  (globalThis.__TABELAS.zorvin_fora_do_horario || []).find((l) => String(l.departamento_id) === String(id)) || null, depId);

// ==================================================================
console.log("\n1. Sem o script 021, a aba não existe");
{
  const { ctx, page, estouros } = await abrir({ sem: true });
  await clicar(page.getByRole("button", { name: "Menu" }));
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
  await page.waitForTimeout(900);
  ok("abri a administração", (await page.locator("[data-aba-banco]").count()) === 1);
  ok("e não há aba Fora do horário", (await page.locator("[data-aba-fora-do-horario]").count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. A aba, a prévia e o que impede ligar");
{
  const { ctx, page, estouros } = await abrir({ quando: SEXTA_19H });
  ok("a aba Fora do horário existe e abre", await abrirAAba(page));
  ok("a seção está na tela", (await page.locator("[data-fora-do-horario]").count()) === 1);
  const dep = await page.locator("[data-fora-departamento]").inputValue().catch(() => "");
  ok("um departamento vem escolhido", Boolean(dep), q(dep));
  ok("nasce desligada", (await page.locator('[data-fora-ligada="nao"]').count()) === 1);
  ok("com o expediente de segunda a sexta, das 8 às 18",
     (await page.locator('[data-fora-dia="seg"] [data-abre]').inputValue().catch(() => "")) === "08:00"
     && (await page.locator('[data-fora-dia="sex"] [data-fecha]').inputValue().catch(() => "")) === "18:00"
     && (await page.locator('[data-fora-dia="sab"] input[type="time"]').count()) === 0);
  await page.waitForTimeout(600);
  // A CONTA DO BANCO, com o feriado: sexta 19h volta na TERÇA, e não na segunda.
  ok("sexta às 19h a prévia diz fechado, voltando na terça (segunda é feriado)",
     /fechado — volta terça-feira, 13\/10, às 08:00/.test(await previa(page)), q(await previa(page)));

  // LIGAR SEM TEXTO NÃO É RESPOSTA.
  await clicar(page.locator('[data-fora-ligada] button[role="switch"]'));
  await page.waitForTimeout(200);
  ok("ligada sem texto, a tela diz o que falta", /escreva o texto/.test(await texto(page.locator("[data-fora-impede]"))));
  ok("e o Salvar fica desligado", await page.locator("[data-fora-salvar]").isDisabled().catch(() => false));

  ok("há um texto sugerido para começar", await clicar(page.locator("[data-fora-sugerido]")));
  const t = await page.locator("[data-fora-texto]").inputValue().catch(() => "");
  ok("e ele entra na caixa", /Recebemos sua mensagem/.test(t), q(t));
  ok("com o texto, o Salvar liga", !(await page.locator("[data-fora-salvar]").isDisabled().catch(() => true)));

  // AS VARIÁVEIS DAS RÁPIDAS NÃO FUNCIONAM AQUI.
  await page.locator("[data-fora-texto]").fill("Olá, {nome}! Voltamos amanhã.");
  await page.waitForTimeout(150);
  ok("escrever {nome} acende o aviso de que não funciona aqui", (await page.locator("[data-fora-chaves]").count()) === 1);
  await page.locator("[data-fora-texto]").fill("Recebemos sua mensagem. Voltamos às 8h.");
  await page.waitForTimeout(150);
  ok("e o aviso some sem as chaves", (await page.locator("[data-fora-chaves]").count()) === 0);

  // FECHAR ANTES DE ABRIR.
  await page.locator('[data-fora-dia="seg"] [data-fecha]').fill("07:00");
  await page.waitForTimeout(200);
  ok("segunda fechando antes de abrir é dito, com o dia",
     /Segunda: a hora de fechar precisa ser depois da de abrir/.test(await texto(page.locator("[data-fora-problemas]"))),
     q(await texto(page.locator("[data-fora-problemas]"))));
  ok("e o Salvar desliga", await page.locator("[data-fora-salvar]").isDisabled().catch(() => false));
  await page.locator('[data-fora-dia="seg"] [data-fecha]').fill("18:00");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2b. Ela não interrompe uma conversa, e a janela é a do banco");
{
  ok("a janela se lê do intervalo do Postgres",
     minutosDaJanela("00:30:00") === 30 && minutosDaJanela("01:00:00") === 60
       && minutosDaJanela("1 day 02:00:00") === 1560,
     q([minutosDaJanela("00:30:00"), minutosDaJanela("01:00:00"), minutosDaJanela("1 day 02:00:00")]));
  ok("e o que não se lê não vira número", minutosDaJanela("lixo") === null && minutosDaJanela(null) === null
       && minutosDaJanela("00:00:00") === null);
  ok("a frase de cada janela",
     fraseDaJanela(30) === "nos 30 minutos antes" && fraseDaJanela(60) === "na última hora antes"
       && fraseDaJanela(120) === "nas 2 horas antes" && fraseDaJanela(null) === "pouco antes",
     q([fraseDaJanela(30), fraseDaJanela(60), fraseDaJanela(120), fraseDaJanela(null)]));

  const explicacao = (page) => texto(page.locator("[data-fora-nao-interrompe]"));
  let { ctx, page, estouros } = await abrir();
  await abrirAAba(page);
  let e = await explicacao(page);
  ok("a aba diz que ela não interrompe uma conversa", /não interrompe uma conversa/.test(e), q(e));
  ok("nem depois do fechamento, nem nos 30 minutos antes de o cliente escrever",
     /depois do\s+fechamento/.test(e) && /nos 30 minutos antes de o cliente escrever/.test(e), q(e));
  await ctx.close();

  ({ ctx, page, estouros } = await abrir({ carencia: "00:10:00" }));
  await abrirAAba(page);
  e = await explicacao(page);
  ok("com a janela do banco em 10 minutos, a tela diz 10", /nos 10 minutos antes/.test(e) && !/30/.test(e), q(e));
  await ctx.close();

  ({ ctx, page, estouros } = await abrir({ carencia: "01:00:00" }));
  await abrirAAba(page);
  e = await explicacao(page);
  ok("com uma hora, diz a última hora", /na última hora antes/.test(e), q(e));
  await ctx.close();

  ({ ctx, page, estouros } = await abrir({ carencia: "falha" }));
  await abrirAAba(page);
  e = await explicacao(page);
  ok("sem conseguir ler a janela, não promete número nenhum", /pouco antes de o cliente escrever/.test(e) && !/\d/.test(e), q(e));
  ok("e a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. A prévia é do que está NA TELA, e não do que foi salvo");
{
  const { ctx, page } = await abrir({ quando: SEXTA_10H });
  await abrirAAba(page);
  await page.waitForTimeout(600);
  ok("sexta às 10h está aberto, fechando às 18h",
     /aberto — fecha hoje às 18:00/.test(await previa(page)), q(await previa(page)));
  // FECHAR A SEXTA SEM SALVAR: a prévia já muda.
  await page.locator('[data-fora-dia="sex"] input[type="checkbox"]').uncheck().catch(() => {});
  await page.waitForTimeout(700);
  ok("tirando a sexta, a prévia diz fechado — antes de salvar",
     /fechado — volta terça-feira, 13\/10, às 08:00/.test(await previa(page)), q(await previa(page)));
  ok("e o banco continua sem configuração (nada foi salvo)",
     (await page.evaluate(() => (globalThis.__TABELAS.zorvin_fora_do_horario || []).length)) === 0);
  // O FUSO TAMBÉM ENTRA NA CONTA: 10h em Brasília são 8h no Acre.
  await page.locator('[data-fora-dia="sex"] input[type="checkbox"]').check().catch(() => {});
  await page.locator("[data-fora-fuso]").selectOption("America/Rio_Branco").catch(() => {});
  await page.waitForTimeout(700);
  ok("no fuso do Acre, 10h de Brasília ainda está aberto e fecha às 18h de lá",
     /aberto — fecha hoje às 18:00/.test(await previa(page)), q(await previa(page)));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Salvar grava o que se vê, e a releitura mostra o que ficou");
{
  const { ctx, page, estouros } = await abrir({ quando: SEXTA_19H });
  await abrirAAba(page);
  const dep = await page.locator("[data-fora-departamento]").inputValue().catch(() => "");
  await page.locator("[data-fora-texto]").fill("Recebemos sua mensagem.\nRespondemos de segunda a sábado.");
  await clicar(page.locator('[data-fora-ligada] button[role="switch"]'));
  await page.locator('[data-fora-dia="sab"] input[type="checkbox"]').check().catch(() => {});
  await page.locator('[data-fora-dia="sab"] [data-fecha]').fill("12:00");
  ok("salvei", await clicar(page.locator("[data-fora-salvar]")));
  await page.waitForTimeout(900);
  const l = await linhaDe(page, dep);
  ok("a linha do departamento foi gravada, ligada", Boolean(l) && l.ligada === true, q(l));
  ok("com o texto inteiro, quebra de linha incluída",
     Boolean(l) && l.texto === "Recebemos sua mensagem.\nRespondemos de segunda a sábado.", q(l && l.texto));
  ok("com o sábado de meio expediente e as sete chaves da semana",
     Boolean(l) && q(l.semana.sab) === q(["08:00", "12:00"]) && Object.keys(l.semana).length === 7, q(l && l.semana));
  ok("e o fuso de Brasília", Boolean(l) && l.fuso === "America/Sao_Paulo", q(l && l.fuso));
  ok("a tela diz que salvou", (await page.locator("[data-fora-salvo]").count()) === 1);
  // A RELEITURA: sai da aba e volta — a seção é montada de novo e lê do
  // banco, e o que ficou é o que aparece.
  await clicar(page.getByRole("button", { name: "Atendentes" }));
  await page.waitForTimeout(400);
  await clicar(page.locator("[data-aba-fora-do-horario]"));
  await page.waitForTimeout(900);
  ok("reabrindo, a resposta continua ligada", (await page.locator('[data-fora-ligada="sim"]').count()) === 1);
  ok("com o texto salvo", (await page.locator("[data-fora-texto]").inputValue().catch(() => "")).startsWith("Recebemos sua mensagem."));
  ok("e o sábado aberto até o meio-dia",
     (await page.locator('[data-fora-dia="sab"] [data-fecha]').inputValue().catch(() => "")) === "12:00");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A recusa do banco é dita, e não vira 'salvo'");
{
  const { ctx, page } = await abrir({ quando: SEXTA_19H });
  await abrirAAba(page);
  // QUEM NÃO ADMINISTRA: o `upsert` esbarra na regra de acesso e o banco
  // RECUSA com erro (no `insert … on conflict` a recusa não é calada).
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = { zorvin_fora_do_horario:
    { code: "42501", message: 'new row violates row-level security policy for table "zorvin_fora_do_horario"' } }; });
  await page.locator("[data-fora-texto]").fill("Oi, voltamos amanhã.");
  await clicar(page.locator("[data-fora-salvar]"));
  await page.waitForTimeout(800);
  let corpo = await page.locator("body").innerText().catch(() => "");
  ok("a recusa é dita, com o código", /Não consegui salvar a resposta fora do horário\. \(erro 42501\)/.test(corpo));
  ok("e a tela não diz 'Salvo'", (await page.locator("[data-fora-salvo]").count()) === 0);
  ok("e nada foi gravado", (await page.evaluate(() => (globalThis.__TABELAS.zorvin_fora_do_horario || []).length)) === 0);
  // O GATILHO DO BANCO JÁ FALA PORTUGUÊS: a frase dele vai inteira para a tela.
  await page.evaluate(() => { globalThis.__ERRO_NA_GRAVACAO = { zorvin_fora_do_horario:
    { code: "23514", message: "Em sexta a hora de fechar precisa ser depois da de abrir." } }; });
  await clicar(page.locator("[data-fora-salvar]"));
  await page.waitForTimeout(800);
  corpo = await page.locator("body").innerText().catch(() => "");
  ok("a recusa do gatilho aparece com as palavras dele", /Em sexta a hora de fechar precisa ser depois da de abrir\./.test(corpo));
  await ctx.close();
}

// ==================================================================
console.log("\n6. Os feriados do escritório");
{
  const { ctx, page } = await abrir({ quando: SEXTA_19H });
  await abrirAAba(page);
  ok("os feriados que vêm com o script estão na lista", (await page.locator('[data-feriado="2026-10-12"]').count()) === 1);
  ok("com o dia da semana por extenso", /segunda-feira, 12\/10\/2026/.test(await texto(page.locator('[data-feriado="2026-10-12"]'))));
  await page.locator("[data-feriado-dia]").fill("2027-02-09");
  await page.locator("[data-feriado-nome]").fill("Carnaval");
  ok("acrescentei o Carnaval", await clicar(page.locator("[data-feriado-acrescentar]")));
  await page.waitForTimeout(600);
  ok("ele aparece na lista", (await page.locator('[data-feriado="2027-02-09"]').count()) === 1);
  ok("e foi gravado", await page.evaluate(() => (globalThis.__TABELAS.zorvin_feriados || []).some((f) => f.dia === "2027-02-09" && f.nome === "Carnaval")));
  ok("tirei o de 12/10", await clicar(page.locator('[data-feriado="2026-10-12"] button')));
  await page.waitForTimeout(600);
  ok("ele sai da lista", (await page.locator('[data-feriado="2026-10-12"]').count()) === 0);
  ok("e do banco", await page.evaluate(() => !(globalThis.__TABELAS.zorvin_feriados || []).some((f) => f.dia === "2026-10-12")));
  await page.waitForTimeout(500);
  // SEM O FERIADO, A CONTA MUDA: sexta 19h volta na SEGUNDA.
  ok("e a prévia passa a voltar na segunda",
     /volta segunda-feira, 12\/10, às 08:00/.test(await previa(page)), q(await previa(page)));
  await ctx.close();
}

// ==================================================================
console.log("\n7. Na conversa, a resposta é uma bolha nossa, sem menu");
const AGORA = SEXTA_19H.getTime();
const CONTATO = { id: "ct-noite", numero: "5511944440001", nome: "Cliente da Noite", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const { ctx, page } = await abrir();
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
const semente = (respostas) => ({
  contatos: [CONTATO],
  conversas: [{
    id: "cv-noite", advogado_id: ADV, contato_id: CONTATO.id, nao_lidas: 1, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: new Date(AGORA - 60000).toISOString(),
    esperando_desde: new Date(AGORA - 60000).toISOString(), tratada_em: null,
    ultima_mensagem: "Boa noite, alguém aí?", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO,
  }],
  mensagens: [
    { id: "m-noite-1", conversa_id: "cv-noite", origem: "contato", tipo: "texto", texto: "Boa noite, alguém aí?",
      id_uazapi: "uz-noite-1", criado_em: new Date(AGORA - 60000).toISOString() },
  ],
  zorvin_respostas_automaticas: respostas,
});
const SAIU = { id: "ra-1", conversa_id: "cv-noite", texto: "Recebemos sua mensagem. Voltamos na terça às 8h.",
               status: "enviada", erro: null, ate: "2026-10-13T11:00:00Z",
               criada_em: new Date(AGORA - 58000).toISOString(), enviada_em: new Date(AGORA - 57000).toISOString() };
{
  const { ctx, page, estouros } = await abrir({ semente: semente([SAIU]) });
  const linha = page.locator('[data-conversa-id="cv-noite"]');
  ok("a conversa plantada está na lista", (await linha.count()) > 0);
  ok("e a prévia da lista é a pergunta do cliente, e não a resposta",
     /Boa noite, alguém aí\?/.test(await texto(linha)), q(await texto(linha)));
  await clicar(linha);
  await page.waitForTimeout(1200);
  const bolha = page.locator('[data-resposta-automatica]');
  ok("a resposta automática aparece na conversa", (await bolha.count()) === 1);
  ok("com o texto que o cliente recebeu", /Recebemos sua mensagem\. Voltamos na terça às 8h\./.test(await texto(bolha)), q(await texto(bolha)));
  ok("dizendo que é automática", /Resposta automática/.test(await texto(bolha)));
  ok("e que saiu", (await page.locator('[data-resposta-automatica="enviada"]').count()) === 1);
  const lados = await page.evaluate(() => {
    const auto = document.querySelector("[data-resposta-automatica] > div")?.getBoundingClientRect();
    const cli = [...document.querySelectorAll("[data-msg-id]")].find((n) => /alguém aí/.test(n.innerText))
      ?.querySelector("div")?.getBoundingClientRect();
    return auto && cli ? { autoEsq: auto.left, autoDir: auto.right, cliEsq: cli.left, cliDir: cli.right } : null;
  });
  // AS DUAS BORDAS, e não a direita de uma contra a esquerda da outra: com as
  // duas bolhas encostadas à esquerda, a direita da nossa ainda fica longe da
  // esquerda da do cliente — a sabotagem que mudava o lado PASSAVA assim.
  ok("do nosso lado (encostada à direita, e a do cliente à esquerda)",
     Boolean(lados) && lados.autoEsq > lados.cliEsq + 100 && lados.autoDir > lados.cliDir + 100, q(lados));
  const depois = await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-msg-id]")].map((n) => n.getAttribute("data-msg-id"));
    return ids.indexOf("auto-ra-1") > ids.indexOf("m-noite-1") && ids.indexOf("m-noite-1") >= 0;
  });
  ok("e depois da mensagem do cliente", depois);
  // SEM MENU: não está em `mensagens`, então não se responde nem se apaga daqui.
  await bolha.first().hover().catch(() => {});
  await page.waitForTimeout(300);
  ok("sem botão nenhum dentro da bolha", (await bolha.locator("button").count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}
{
  const NAO_SAIU = { ...SAIU, id: "ra-2", status: "erro", enviada_em: null,
                     erro: "Uazapi respondeu 500: WhatsApp disconnected" };
  const { ctx, page } = await abrir({ semente: semente([NAO_SAIU]) });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1200);
  ok("a que não saiu diz que não saiu", (await page.locator('[data-resposta-automatica="erro"]').count()) === 1);
  ok("com o motivo, e que o cliente não recebeu",
     /Não saiu: Uazapi respondeu 500: WhatsApp disconnected\. O cliente não recebeu/.test(await texto(page.locator("[data-automatica-erro]"))),
     q(await texto(page.locator("[data-automatica-erro]"))));
  await ctx.close();
}

// ==================================================================
console.log("\n8. Saindo com a conversa aberta, ela aparece sozinha");
{
  const { ctx, page } = await abrir({ semente: semente([]) });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1200);
  ok("antes, nenhuma resposta automática", (await page.locator("[data-resposta-automatica]").count()) === 0);
  // O CLIENTE ESCREVE DE NOVO, e a ponte responde um instante depois.
  const ouviram = await page.evaluate((agora) => {
    const nova = { id: "m-noite-2", conversa_id: "cv-noite", origem: "contato", tipo: "texto",
                   texto: "Tem alguém?", id_uazapi: "uz-noite-2", criado_em: new Date(agora).toISOString() };
    globalThis.__TABELAS.mensagens.push(nova);
    const n = globalThis.__EMITIR("INSERT", "mensagens", nova);
    setTimeout(() => globalThis.__TABELAS.zorvin_respostas_automaticas.push({
      id: "ra-3", conversa_id: "cv-noite", texto: "Recebemos sua mensagem.", status: "enviada", erro: null,
      ate: "2026-10-13T11:00:00Z", criada_em: new Date(agora).toISOString(), enviada_em: new Date(agora + 1000).toISOString(),
    }), 800);
    return n;
  }, AGORA);
  ok("o painel ouviu a mensagem do cliente", ouviram > 0, `ouvintes: ${ouviram}`);
  await page.waitForTimeout(5000);
  ok("e a resposta automática aparece sem reabrir a conversa", (await page.locator('[data-resposta-automatica="enviada"]').count()) === 1);
  ok("depois da mensagem nova", await page.evaluate(() => {
    const ids = [...document.querySelectorAll("[data-msg-id]")].map((n) => n.getAttribute("data-msg-id"));
    return ids.indexOf("auto-ra-3") > ids.indexOf("m-noite-2") && ids.indexOf("m-noite-2") >= 0;
  }));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Sem o script, a conversa abre como sempre; com falha, diz");
{
  const { ctx, page, estouros } = await abrir({ sem: true, semente: semente([]) });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1200);
  ok("sem o script, a conversa abre com a mensagem do cliente",
     /Boa noite, alguém aí\?/.test(await texto(page.locator('[data-msg-id="m-noite-1"]'))));
  ok("e sem faixa de falha de leitura (o recurso só não existe)",
     (await page.locator("[data-falha-de-leitura]").count()) === 0,
     q(await texto(page.locator("[data-falha-de-leitura]"))));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ semente: semente([SAIU]), quebrar: ["zorvin_respostas_automaticas"] });
  await clicar(page.locator('[data-conversa-id="cv-noite"]'));
  await page.waitForTimeout(1500);
  ok("a leitura que FALHA não vira 'nenhuma resposta': a faixa âmbar diz",
     /respostas automáticas/.test(await texto(page.locator("[data-falha-de-leitura]"))),
     q(await texto(page.locator("[data-falha-de-leitura]"))));
  ok("e a conversa abre igual",
     /Boa noite, alguém aí\?/.test(await texto(page.locator('[data-msg-id="m-noite-1"]'))));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
