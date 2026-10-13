// A DISTRIBUIÇÃO AUTOMÁTICA DAS CONVERSAS NOVAS (13/10) — a metade do painel.
//
// Quem decide é o BANCO (script 023, provado num Postgres de verdade no repo
// da ponte), chamado pela ponte a cada mensagem de cliente. O que esta prova
// guarda é o que é da tela:
//
//   1. a aba "Distribuição" só existe com o script;
//   2. tudo nasce desligado, e o padrão de cada pessoa vem DO BANCO — quem
//      atende dentro, quem administra fora, dizendo por quê;
//   3. cada departamento diz para quem as conversas iriam, e o que está
//      ligado sem ninguém para receber acende um aviso;
//   4. as chaves gravam no banco, e a tela mostra o que ficou gravado;
//   5. falha de leitura é DITA, e nunca vira "desligada" nem "ninguém";
//   6. na conversa, o menu do responsável diz que foi a distribuição — e só
//      quando foi.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
// TERÇA, 13/10/2026, 14h EM BRASÍLIA. O "hoje" da lista é o dia de Brasília.
const AGORA = new Date("2026-10-13T17:00:00Z");

/** Clique GUARDADO: num elemento que não existe, `click()` estoura a prova e
 *  esconde qual conferência pegou o defeito. */
async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.first().innerText().catch(() => "");
const dep = (page, id) => page.locator(`[data-distribuicao-departamento="${id}"]`);
const pessoa = (page, id) => page.locator(`[data-rodizio-pessoa="${id}"]`);
const naTabela = (page, tabela) => page.evaluate((t) => (globalThis.__TABELAS[t] || []).map((l) => ({ ...l })), tabela);

// QUEM VÊ O QUÊ. A Jenifer vê o departamento 3 (Sucesso do Cliente, três
// telefones); a Isabela vê UM telefone do departamento 5 (Acordos 1). O
// Rodrigo, que é a sessão da bancada, administra — e por isso vê tudo.
const PERMISSOES = [
  { id: "p-jen", usuario_id: "u-jenifer", departamento_id: 3, telefone_id: null },
  { id: "p-isa", usuario_id: "u-isabela", departamento_id: null, telefone_id: "a7" },
];
// UM DEPARTAMENTO SEM TELEFONE, para a frase de "não há o que distribuir".
const SEM_TELEFONE = { id: 9, nome: "Plantão de sábado", slug: "plantao", cor: "#8696a0", ordem: 9, ativo: true };
// O QUE A JENIFER JÁ RECEBEU: duas hoje (9h e 10h30 em Brasília) e uma ontem.
const RECEBIDAS = [
  { id: 1, conversa_id: "x-1", departamento_id: 3, usuario_id: "u-jenifer", quando: "2026-10-12T15:00:00Z" },
  { id: 2, conversa_id: "x-2", departamento_id: 3, usuario_id: "u-jenifer", quando: "2026-10-13T12:00:00Z" },
  { id: 3, conversa_id: "x-3", departamento_id: 3, usuario_id: "u-jenifer", quando: "2026-10-13T13:30:00Z" },
];

async function abrir({ sem = false, semente = {}, quebrar = null, rodizioFalha = false, erroNaGravacao = {},
                       largura = 1400, altura = 900, relogio = true } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula entre cenários, e a
  // última escrita é a que vale.
  await page.addInitScript((b) => {
    globalThis.__SEM_DISTRIBUICAO = b.sem;
    globalThis.__SEMENTE = b.semente;
    globalThis.__QUEBRAR = b.quebrar;
    globalThis.__RODIZIO_FALHA = b.rodizioFalha;
    globalThis.__ERRO_NA_GRAVACAO = b.erroNaGravacao;
    globalThis.__ESCRITA_SEM_EFEITO = [];
  }, { sem, semente: { permissoes: PERMISSOES, departamentos: [SEM_TELEFONE], zorvin_distribuicoes: RECEBIDAS, ...semente },
       quebrar, rodizioFalha, erroNaGravacao });
  if (relogio) await page.clock.setFixedTime(AGORA);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}

async function abrirAdministracao(page) {
  if (!(await clicar(page.getByRole("button", { name: "Menu" })))) return false;
  if (!(await clicar(page.getByRole("button", { name: "Departamentos e acessos" })))) return false;
  await page.waitForTimeout(800);
  return true;
}
async function abrirAAba(page) {
  if (!(await abrirAdministracao(page))) return false;
  if (!(await clicar(page.locator("[data-aba-distribuicao]")))) return false;
  await page.waitForTimeout(900);
  return true;
}
/** Liga ou desliga pela chave da linha, e espera a releitura. */
async function trocar(linha, page) {
  const ok_ = await clicar(linha.locator('button[role="switch"]'));
  await page.waitForTimeout(700);
  return ok_;
}
const alerta = (page) => texto(page.locator('[role="alert"]'));

// ==================================================================
console.log("\n1. Sem o script 023, a aba não existe");
{
  const { ctx, page, estouros } = await abrir({ sem: true });
  ok("abri a administração", (await abrirAdministracao(page)) && (await page.locator("[data-aba-banco]").count()) === 1);
  ok("e não há aba Distribuição", (await page.locator("[data-aba-distribuicao]").count()) === 0);
  // O CONTRASTE: as abas de sempre continuam lá.
  ok("(as outras abas continuam)", (await page.getByRole("button", { name: "Atendentes" }).count()) === 1);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Tudo nasce desligado, e o padrão de cada pessoa vem do banco");
{
  const { ctx, page, estouros } = await abrir();
  ok("a aba Distribuição existe e abre", await abrirAAba(page));
  ok("a seção está na tela", (await page.locator("[data-distribuicao]").count()) === 1);
  const linhas = await page.locator("[data-distribuicao-departamento]").count();
  ok("todos os departamentos aparecem, inclusive o sem telefone", linhas === 9, `vi ${linhas}`);
  ok("e todos desligados", (await page.locator('[data-distribuicao-departamento][data-ligada="nao"]').count()) === 9
     && (await page.locator('[data-distribuicao-departamento][data-ligada="sim"]').count()) === 0);
  ok("abrir a aba não grava nada", (await naTabela(page, "zorvin_distribuicao")).length === 0
     && (await naTabela(page, "zorvin_rodizio")).length === 0);

  // AS PESSOAS — e o padrão é do banco.
  const rodrigo = pessoa(page, "u1");
  ok("quem administra aparece na lista", (await rodrigo.count()) === 1);
  ok("FORA do rodízio, que é o padrão de quem administra", (await rodrigo.getAttribute("data-recebe").catch(() => "")) === "nao");
  ok("dizendo que administra, e por que está fora",
     /administra/.test(await texto(rodrigo)) && (await rodrigo.locator("[data-rodizio-admin-fora]").count()) === 1,
     q(await texto(rodrigo)));
  ok("quem atende aparece DENTRO, sem ninguém ter mexido",
     (await pessoa(page, "u-jenifer").getAttribute("data-recebe").catch(() => "")) === "sim"
     && (await pessoa(page, "u-isabela").getAttribute("data-recebe").catch(() => "")) === "sim");
  ok("e quem atende não ganha o aviso de quem administra",
     (await pessoa(page, "u-jenifer").locator("[data-rodizio-admin-fora]").count()) === 0);
  ok("cada pessoa diz o que vê",
     /Vê: Sucesso do Cliente/.test(await texto(pessoa(page, "u-jenifer")))
     && /Vê: Acordos/.test(await texto(pessoa(page, "u-isabela"))),
     q([await texto(pessoa(page, "u-jenifer")), await texto(pessoa(page, "u-isabela"))]));
  const recebeuJen = await texto(pessoa(page, "u-jenifer").locator("[data-rodizio-recebeu]"));
  ok("e o que recebeu: a última, e quantas hoje (no dia de Brasília)",
     /Recebeu a última em 13\/10 às 10:30 · 2 hoje/.test(recebeuJen), q(recebeuJen));
  const recebeuIsa = await texto(pessoa(page, "u-isabela").locator("[data-rodizio-recebeu]"));
  ok("quem nunca recebeu diz isso, e não uma data vazia", /Ainda não recebeu nenhuma · 0 hoje/.test(recebeuIsa), q(recebeuIsa));

  // OS DEPARTAMENTOS dizem para quem iria.
  const sdc = await texto(dep(page, 3).locator("[data-distribuicao-quem]"));
  ok("Sucesso do Cliente diz para quem iria — só quem recebe e vê os telefones dele",
     /Ligando, vão para: JENIFER ALMEIDA\.$/.test(sdc), q(sdc));
  const acordos = await texto(dep(page, 5).locator("[data-distribuicao-quem]"));
  ok("quem vê UM telefone do departamento entra no rodízio dele", /vão para: ISABELA GUEDES\./.test(acordos), q(acordos));
  const interno = await texto(dep(page, 1).locator("[data-distribuicao-quem]"));
  ok("o departamento que ninguém do rodízio vê diz isso",
     /Ninguém do rodízio vê os telefones deste departamento/.test(interno), q(interno));
  const plantao = await texto(dep(page, 9).locator("[data-distribuicao-quem]"));
  ok("o departamento sem telefone diz que não há o que distribuir", /Nenhum telefone ativo/.test(plantao), q(plantao));
  ok("tudo desligado, nenhum aviso de “ninguém vai receber”",
     (await page.locator("[data-distribuicao-sem-ninguem]").count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Ligar, desligar, férias — e o banco acompanha");
{
  const { ctx, page, estouros } = await abrir();
  await abrirAAba(page);
  ok("liguei Sucesso do Cliente", await trocar(dep(page, 3), page));
  let banco = await naTabela(page, "zorvin_distribuicao");
  ok("o banco guarda a chave ligada", banco.some((l) => String(l.departamento_id) === "3" && l.ligada === true), q(banco));
  ok("e a linha mostra ligada", (await dep(page, 3).getAttribute("data-ligada").catch(() => "")) === "sim");
  ok("e diz para quem as conversas novas VÃO",
     /^As conversas novas vão para: JENIFER ALMEIDA\.$/.test(await texto(dep(page, 3).locator("[data-distribuicao-quem]"))),
     q(await texto(dep(page, 3).locator("[data-distribuicao-quem]"))));

  // LIGADA SEM NINGUÉM: o único caso que pede ação.
  ok("liguei Interno, que ninguém do rodízio vê", await trocar(dep(page, 1), page));
  ok("acende o aviso de que ninguém vai receber", (await dep(page, 1).locator("[data-distribuicao-sem-ninguem]").count()) === 1);
  ok("e só nele", (await page.locator("[data-distribuicao-sem-ninguem]").count()) === 1);

  // QUEM ADMINISTRA ENTRA NO RODÍZIO PELA CHAVE DELE.
  ok("pus quem administra no rodízio", await trocar(pessoa(page, "u1"), page));
  let rodizio = await naTabela(page, "zorvin_rodizio");
  ok("o banco guarda a escolha", rodizio.some((r) => r.usuario_id === "u1" && r.recebe === true), q(rodizio));
  ok("a linha dele passa a receber", (await pessoa(page, "u1").getAttribute("data-recebe").catch(() => "")) === "sim");
  ok("e some o “fora por administrar” — agora é escolha", (await pessoa(page, "u1").locator("[data-rodizio-admin-fora]").count()) === 0);
  const interno = await texto(dep(page, 1).locator("[data-distribuicao-quem]"));
  ok("o Interno passa a ter quem receba", /^As conversas novas vão para: Rodrigo Sousa\.$/.test(interno), q(interno));
  ok("e o aviso de ninguém some", (await page.locator("[data-distribuicao-sem-ninguem]").count()) === 0);
  const sdc = await texto(dep(page, 3).locator("[data-distribuicao-quem]"));
  ok("Sucesso do Cliente agora tem os dois", /vão para: JENIFER ALMEIDA, Rodrigo Sousa\./.test(sdc), q(sdc));

  // FÉRIAS.
  ok("tirei a Jenifer do rodízio (férias)", await trocar(pessoa(page, "u-jenifer"), page));
  rodizio = await naTabela(page, "zorvin_rodizio");
  ok("o banco guarda a escolha dela", rodizio.some((r) => r.usuario_id === "u-jenifer" && r.recebe === false), q(rodizio));
  ok("a linha dela diz que não recebe", (await pessoa(page, "u-jenifer").getAttribute("data-recebe").catch(() => "")) === "nao");
  const sdc2 = await texto(dep(page, 3).locator("[data-distribuicao-quem]"));
  ok("e a vez dela sai do departamento", /vão para: Rodrigo Sousa\.$/.test(sdc2), q(sdc2));

  ok("desliguei Sucesso do Cliente", await trocar(dep(page, 3), page));
  banco = await naTabela(page, "zorvin_distribuicao");
  ok("o banco guarda desligada", banco.some((l) => String(l.departamento_id) === "3" && l.ligada === false), q(banco));

  // FECHAR E ABRIR DE NOVO: o que aparece é o que o banco guardou, e não o
  // que ficou na memória da tela.
  await clicar(page.getByRole("button", { name: "Fechar", exact: true }));
  await page.waitForTimeout(500);
  await abrirAAba(page);
  ok("reaberta, a tela mostra o que o banco guardou",
     (await dep(page, 1).getAttribute("data-ligada").catch(() => "")) === "sim"
     && (await dep(page, 3).getAttribute("data-ligada").catch(() => "")) === "nao"
     && (await pessoa(page, "u1").getAttribute("data-recebe").catch(() => "")) === "sim"
     && (await pessoa(page, "u-jenifer").getAttribute("data-recebe").catch(() => "")) === "nao");
  ok("nenhum erro dito no caminho", !(await alerta(page)), q(await alerta(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A lista do rodízio que não carrega é dita — e nunca vira “ninguém”");
{
  const { ctx, page, estouros } = await abrir({ rodizioFalha: true,
    semente: { zorvin_distribuicao: [{ departamento_id: 3, ligada: true }] } });
  await abrirAAba(page);
  const falha = await texto(page.locator("[data-rodizio-falha]"));
  ok("a seção das pessoas diz que não conseguiu ler, com o código",
     /Não consegui ler quem recebe as conversas novas\. \(erro 57014\)/.test(falha), q(falha));
  ok("e não desenha pessoa nenhuma", (await page.locator("[data-rodizio-pessoa]").count()) === 0);
  ok("nem diz que ninguém vê telefone nenhum", (await page.locator("[data-rodizio-vazio]").count()) === 0);
  const sdc = await texto(dep(page, 3).locator("[data-distribuicao-quem]"));
  ok("o departamento diz que não conseguiu ler, e não que ninguém recebe",
     /Não consegui ler quem está no rodízio/.test(sdc) && !/Ninguém/.test(sdc), q(sdc));
  ok("e o ligado não acende o aviso de “ninguém vai receber” — não se sabe",
     (await page.locator("[data-distribuicao-sem-ninguem]").count()) === 0);
  await page.evaluate(() => { globalThis.__RODIZIO_FALHA = false; });
  ok("“Tentar de novo” existe", await clicar(page.locator("[data-rodizio-falha] button")));
  await page.waitForTimeout(700);
  ok("e traz a lista", (await page.locator("[data-rodizio-pessoa]").count()) === 3
     && (await page.locator("[data-rodizio-falha]").count()) === 0);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. As chaves que não carregam: a aba aparece, e nenhuma chave é desenhada desligada");
{
  const { ctx, page, estouros } = await abrir({ quebrar: ["zorvin_distribuicao"] });
  await abrirAdministracao(page);
  ok("a falha não esconde o recurso: a aba aparece", (await page.locator("[data-aba-distribuicao]").count()) === 1);
  await clicar(page.locator("[data-aba-distribuicao]"));
  await page.waitForTimeout(900);
  const falha = await texto(page.locator("[data-distribuicao-falha-chaves]"));
  ok("e diz que não conseguiu ler, com o código",
     /Não consegui ler quais departamentos distribuem as conversas novas\. \(erro 57014\)/.test(falha), q(falha));
  ok("sem desenhar chave nenhuma — desligada por falha faria alguém ligar de novo",
     (await page.locator("[data-distribuicao-departamento]").count()) === 0);
  ok("(a lista das pessoas, que não depende disto, continua)", (await page.locator("[data-rodizio-pessoa]").count()) === 3);
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. O banco que recusa: a frase diz, com o código, e a chave volta");
{
  const recusa = { code: "42501", message: "new row violates row-level security policy" };
  const { ctx, page, estouros } = await abrir({ erroNaGravacao: { zorvin_distribuicao: recusa, zorvin_rodizio: recusa } });
  await abrirAAba(page);
  await trocar(dep(page, 3), page);
  const a1 = await alerta(page);
  ok("ligar recusado é dito, com o departamento e o código",
     /Não consegui ligar a distribuição de Sucesso do Cliente\. \(erro 42501\)/.test(a1), q(a1));
  ok("e a chave continua desligada, porque a tela releu do banco",
     (await dep(page, 3).getAttribute("data-ligada").catch(() => "")) === "nao");
  ok("e o banco não ganhou nada", (await naTabela(page, "zorvin_distribuicao")).length === 0);
  await trocar(pessoa(page, "u-jenifer"), page);
  const a2 = await alerta(page);
  ok("tirar alguém do rodízio recusado é dito, com o nome e o código",
     /Não consegui tirar JENIFER ALMEIDA do rodízio\. \(erro 42501\)/.test(a2), q(a2));
  ok("e ela continua recebendo", (await pessoa(page, "u-jenifer").getAttribute("data-recebe").catch(() => "")) === "sim");
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n7. No celular, as chaves cabem na tela");
{
  const { ctx, page, estouros } = await abrir({ largura: 390, altura: 844 });
  ok("a aba abre no celular", await abrirAAba(page));
  const caixas = await page.evaluate(() => [...document.querySelectorAll(
    "[data-distribuicao-departamento] button[role=switch], [data-rodizio-pessoa] button[role=switch]")]
    .map((b) => { const r = b.getBoundingClientRect(); return { esq: r.left, dir: r.right, larg: r.width }; }));
  ok("todas as chaves dentro da tela, inteiras",
     caixas.length === 12 && caixas.every((c) => c.esq >= 0 && c.dir <= 390 && c.larg >= 38), q(caixas.slice(0, 3)));
  // A CHAVE CONTINUA SENDO UMA PÍLULA. A regra do celular põe todo botão em
  // 40px de altura, e a chave, que era o próprio botão, virava um círculo de
  // 40×40 com a bolinha solta no alto — não se via se estava ligada. O botão
  // é a área do dedo; a pílula, o desenho.
  const formas = await page.evaluate(() => [...document.querySelectorAll("[data-distribuicao] button[role=switch]")]
    .map((b) => { const a = b.getBoundingClientRect(); const p = b.querySelector("[data-pilula-da-chave]");
                  const r = p ? p.getBoundingClientRect() : null;
                  return { alvo: Math.round(a.height), larg: r && Math.round(r.width), alt: r && Math.round(r.height) }; }));
  ok("o dedo tem os 40px de altura",
     formas.length === 9 && formas.every((f) => f.alvo >= 40), q(formas.slice(0, 2)));
  ok("e o olho vê uma pílula de 40×22, e não um círculo",
     formas.length === 9 && formas.every((f) => f.larg === 40 && f.alt === 22), q(formas.slice(0, 2)));
  ok("e a página não rola de lado", await page.evaluate(() => document.documentElement.scrollWidth <= 390));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
//  8. NA CONVERSA: O MENU DO RESPONSÁVEL DIZ QUE FOI A DISTRIBUIÇÃO
// ==================================================================
console.log("\n8. Na conversa, o menu do responsável diz que foi a distribuição — e só quando foi");
{
  // O TELEFONE QUE O PAINEL ABRE — descoberto, e não escolhido a dedo.
  const sonda = await abrir({ relogio: false });
  const ADV = await sonda.page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await sonda.ctx.close();
  ok("aprendi qual telefone o painel abre", Boolean(ADV));

  const agora = new Date().toISOString();
  const conversa = (id, ct, nome, numero, extra) => ({
    id, advogado_id: ADV, contato_id: ct, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: agora, ultima_mensagem: "bom dia", frente: null, vantoro_nome: null, digitando_ate: null,
    contato: { id: ct, nome, numero, foto_url: null }, ...extra,
  });
  const contato = (id, nome, numero) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
                                           vantoro_cliente_id: null, foto_url: null });
  const semente = {
    contatos: [contato("ct-d1", "ODETE DISTRIBUIDA", "5511970004401"),
               contato("ct-d2", "PAULO PASSADO", "5511970004402"),
               contato("ct-d3", "SILAS ASSUMIDO", "5511970004403"),
               contato("ct-d4", "TERESA DO TEMPO REAL", "5511970004404")],
    conversas: [
      // O ZORVIN PÔS: `responsavel_por` NULO.
      conversa("cv-d1", "ct-d1", "ODETE DISTRIBUIDA", "5511970004401",
               { responsavel_id: "u-jenifer", responsavel_em: agora, responsavel_por: null }),
      // UMA COLEGA PASSOU.
      conversa("cv-d2", "ct-d2", "PAULO PASSADO", "5511970004402",
               { responsavel_id: "u-jenifer", responsavel_em: agora, responsavel_por: "u1" }),
      // ELA MESMA ASSUMIU (ao responder, ou pelo menu): quem pôs é o dono.
      conversa("cv-d3", "ct-d3", "SILAS ASSUMIDO", "5511970004403",
               { responsavel_id: "u-jenifer", responsavel_em: agora, responsavel_por: "u-jenifer" }),
      conversa("cv-d4", "ct-d4", "TERESA DO TEMPO REAL", "5511970004404",
               { responsavel_id: null, responsavel_em: null, responsavel_por: null }),
    ],
    mensagens: ["cv-d1", "cv-d2", "cv-d3", "cv-d4"].map((c, i) => ({
      id: `m-d${i + 1}`, conversa_id: c, origem: "contato", tipo: "texto", texto: "bom dia", criado_em: agora })),
  };
  // A 1920: a linha do número escreve o dono por extenso (a 1400 com a ficha
  // aberta ela vira ícone — ver "Tarefas e lembretes" no CLAUDE.md).
  const { ctx, page, estouros } = await abrir({ semente, relogio: false, largura: 1920 });
  async function origemDe(nome) {
    if (!(await clicar(page.locator(`[data-conversa-nome="${nome}"]`)))) return null;
    await page.waitForTimeout(700);
    if (!(await clicar(page.locator("[data-responsavel-da-conversa]")))) return null;
    await page.waitForTimeout(400);
    const el = page.locator("[data-responsavel-origem]");
    const r = { txt: await texto(el), marca: await el.first().getAttribute("data-pela-distribuicao").catch(() => null) };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return r;
  }
  const d1 = await origemDe("ODETE DISTRIBUIDA");
  ok("a conversa que o Zorvin distribuiu diz isso no menu",
     d1 && /^JENIFER ALMEIDA desde .+ — pela distribuição automática\.$/.test(d1.txt) && d1.marca === "sim", q(d1));
  const d2 = await origemDe("PAULO PASSADO");
  ok("a que uma colega passou diz quem passou, e não a distribuição",
     d2 && /passada por Rodrigo Sousa/.test(d2.txt) && !/distribuição/.test(d2.txt) && d2.marca === null, q(d2));
  const d3 = await origemDe("SILAS ASSUMIDO");
  ok("a que ela mesma assumiu não fala em distribuição nem em quem passou",
     d3 && /^JENIFER ALMEIDA desde [^—]+\.$/.test(d3.txt) && d3.marca === null, q(d3));
  // SEM DONO, O NULO NÃO É DA DISTRIBUIÇÃO: `responsavel_por` também é nulo
  // ali, e é o dono que separa um caso do outro.
  const d4antes = await origemDe("TERESA DO TEMPO REAL");
  ok("a conversa sem dono diz que ninguém é dono — e não que foi distribuída",
     d4antes && /^Ninguém ainda/.test(d4antes.txt) && d4antes.marca === null, q(d4antes));

  // O TEMPO REAL: o banco distribui com a conversa aberta.
  await clicar(page.locator('[data-conversa-nome="TERESA DO TEMPO REAL"]'));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const cv = globalThis.__TABELAS.conversas.find((x) => x.id === "cv-d4");
    const em = new Date().toISOString();
    cv.responsavel_id = "u1"; cv.responsavel_em = em; cv.responsavel_por = null;
    globalThis.__EMITIR("UPDATE", "conversas", { id: "cv-d4", responsavel_id: "u1", responsavel_em: em, responsavel_por: null });
  });
  await page.waitForTimeout(700);
  const dono = await page.locator("[data-responsavel-da-conversa]").first().getAttribute("data-responsavel-da-conversa").catch(() => "");
  ok("o dono que chega pelo tempo real aparece na conversa aberta", dono === "u1", q(dono));
  await clicar(page.locator("[data-responsavel-da-conversa]"));
  await page.waitForTimeout(400);
  const d4 = await texto(page.locator("[data-responsavel-origem]"));
  ok("e o menu diz que foi a distribuição, para mim", /^Você desde .+ — pela distribuição automática\.$/.test(d4), q(d4));
  ok("sem erro de JavaScript no caminho", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
