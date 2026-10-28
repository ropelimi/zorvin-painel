// O "FORA DO HORÁRIO" QUE NÃO CARREGOU NÃO VIRA "DESLIGADA" (auditoria de 28/10)
//
// A leitura da configuração que falhava (não por falta da tabela: por um
// tropeço) só avisava no alto da janela e seguia com `existe = true`. As
// linhas ficavam vazias, e a tela desenhava o padrão: "Desligada — ninguém
// recebe nada", sem texto, semana de segunda a sexta, fuso de Brasília. O
// "Salvar" continuava ligado e gravava ISSO por cima do texto, da semana e
// do fuso de verdade — e o aviso de erro era apagado pelo `aoAvisar("")` do
// próprio `salvar()`. O comentário logo acima da leitura dizia justamente
// que isso não podia acontecer ("faria alguém configurar de novo por cima
// do que existe").
//
// E O RESULTADO DOS FERIADOS ERA JOGADO FORA nesse caminho: a seção dizia
// "Nenhum feriado daqui para a frente" com os feriados lidos na mão. E
// quando eram os feriados que falhavam, a mesma frase aparecia — ausência
// no lugar de falha, a armadilha nº 2.
//
// O QUE ESTA PROVA GUARDA:
//   - a configuração que não carregou é DITA no lugar do formulário, com o
//     código, e não há "Salvar" que grave o padrão por cima — a linha do
//     banco continua a mesma; "Tentar de novo" lê de novo e mostra a de
//     verdade;
//   - os feriados lidos aparecem mesmo com a configuração falhando;
//   - os feriados que não carregaram são ditos na seção deles, e a frase
//     continua lá depois de salvar a configuração.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";
import { SEMANA_PADRAO } from "../src/foraDoHorario.js";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();

// A CONFIGURAÇÃO DE VERDADE do primeiro departamento da lista (o que a aba
// abre): ligada, com texto, sábado aberto e o fuso de Manaus — tudo
// diferente do padrão, para o padrão gravado por cima não passar por igual.
const TEXTO = "Olá! Estamos fora do expediente. Respondemos no próximo dia útil.";
const SEMANA = { ...SEMANA_PADRAO, sab: ["08:00", "12:00"] };
const CONFIG = { departamento_id: 1, ligada: true, texto: TEXTO, semana: SEMANA, fuso: "America/Manaus" };

async function clicar(loc) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}
const texto = (loc) => loc.first().innerText().catch(() => "");

async function abrir({ quebrarLeitura = [] } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 }, timezoneId: "America/Sao_Paulo" });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS, SEMPRE — `addInitScript` acumula.
  await page.addInitScript((b) => {
    globalThis.__SEM_FORA_DO_HORARIO = false;
    globalThis.__SEMENTE = { zorvin_fora_do_horario: [b.config] };
    globalThis.__QUEBRAR = [];
    globalThis.__QUEBRAR_SO_A_LEITURA = b.quebrarLeitura;
  }, { config: CONFIG, quebrarLeitura });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await clicar(page.getByRole("button", { name: "Menu" }));
  await clicar(page.getByRole("button", { name: "Departamentos e acessos" }));
  await page.waitForTimeout(700);
  const abriu = await clicar(page.locator("[data-aba-fora-do-horario]"));
  await page.waitForTimeout(1200);
  return { ctx, page, estouros, abriu };
}
const linhaNoBanco = (page) => page.evaluate(() =>
  (globalThis.__TABELAS.zorvin_fora_do_horario || []).find((l) => String(l.departamento_id) === "1") || null);
const janela = (page) => page.locator("text=Departamentos e acessos").first().evaluate((el) => {
  let a = el; while (a && !a.style?.maxWidth) a = a.parentElement;
  return (a || document.body).innerText;
}).catch(() => "");

// ==================================================================
console.log("\n1. A configuração que não carregou é dita, e não vira “Desligada”");
{
  const { ctx, page, estouros, abriu } = await abrir({ quebrarLeitura: ["zorvin_fora_do_horario"] });
  ok("a aba aparece mesmo com a leitura falhando", abriu);
  const t = await janela(page);
  ok("a aba diz que não conseguiu ler, com o código", /Não consegui ler a resposta fora do horário/.test(t) && /57014/.test(t), t.slice(0, 300));
  ok("e não desenha “Desligada — ninguém recebe nada”", !/Desligada — ninguém recebe nada/.test(t));
  ok("nem a caixa de texto vazia", (await page.locator("[data-fora-texto]").count()) === 0);
  // O PIOR DESFECHO: salvar o padrão por cima do que existe. Se houver um
  // botão de salvar, ele é apertado — e o banco tem de continuar igual.
  const temSalvar = (await page.locator("[data-fora-salvar]").count()) > 0;
  ok("não há “Salvar” para gravar o que não foi lido", !temSalvar);
  if (temSalvar) {
    await clicar(page.locator("[data-fora-salvar]"));
    await page.waitForTimeout(1200);
  }
  const linha = await linhaNoBanco(page);
  ok("a configuração do banco continua a de verdade", Boolean(linha) && linha.ligada === true && linha.texto === TEXTO
     && linha.fuso === "America/Manaus" && Array.isArray(linha.semana && linha.semana.sab), q(linha));
  // OS FERIADOS FORAM LIDOS, e aparecem.
  ok("os feriados lidos estão na lista", (await page.locator("[data-feriado]").count()) > 0,
     `${await page.locator("[data-feriado]").count()} feriados`);
  ok("e não diz “Nenhum feriado daqui para a frente”", !/Nenhum feriado daqui para a frente/.test(await janela(page)));

  // TENTAR DE NOVO, com a leitura de pé: a tela mostra a de verdade.
  await page.evaluate(() => { globalThis.__QUEBRAR_SO_A_LEITURA = []; });
  ok("há “Tentar de novo”", await clicar(page.getByRole("button", { name: "Tentar de novo" })));
  await page.waitForTimeout(1200);
  ok("de novo, a configuração aparece ligada", (await page.locator('[data-fora-ligada="sim"]').count()) === 1);
  ok("com o texto de verdade", (await page.locator("[data-fora-texto]").inputValue().catch(() => "")) === TEXTO);
  ok("e o fuso de verdade", (await page.locator("[data-fora-fuso]").inputValue().catch(() => "")) === "America/Manaus");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Os feriados que não carregaram são ditos na seção deles");
{
  const { ctx, page, estouros } = await abrir({ quebrarLeitura: ["zorvin_feriados"] });
  ok("a configuração carregou", (await page.locator("[data-fora-texto]").inputValue().catch(() => "")) === TEXTO);
  const secao = () => texto(page.locator("[data-feriados]"));
  ok("a seção dos feriados diz que não conseguiu ler, com o código",
     /Não consegui ler os feriados/.test(await secao()) && /57014/.test(await secao()), (await secao()).slice(0, 200));
  ok("e não diz “Nenhum feriado daqui para a frente”", !/Nenhum feriado daqui para a frente/.test(await secao()));
  // SALVAR A CONFIGURAÇÃO não apaga a frase dos feriados (era o
  // `aoAvisar("")` do salvar que apagava o aviso).
  await page.locator("[data-fora-texto]").fill(`${TEXTO} Obrigado!`);
  await page.waitForTimeout(200);
  await clicar(page.locator("[data-fora-salvar]"));
  await page.waitForTimeout(1500);
  ok("salvou a configuração", ((await linhaNoBanco(page)) || {}).texto === `${TEXTO} Obrigado!`);
  ok("e a seção dos feriados continua dizendo que não leu",
     /Não consegui ler os feriados/.test(await secao()) && !/Nenhum feriado daqui para a frente/.test(await secao()),
     (await secao()).slice(0, 200));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
