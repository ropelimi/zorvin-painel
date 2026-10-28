// A FICHA NÃO APAGA NEM EMPRESTA O QUE FOI DIGITADO (auditoria de 28/10)
//
// Dois defeitos do rascunho da ficha do Vantoro, o lugar onde se digita o
// cadastro do cliente — e as senhas do GOV e do SERASA.
//
// 1. "SALVAR NO VANTORO" APAGAVA O QUE FOI DIGITADO ENQUANTO A GRAVAÇÃO
//    ESTAVA NO AR. Na volta vinha `setEdicao({ ...r.cliente })`, e os
//    campos não ficam desabilitados enquanto salva; o efeito do rascunho via
//    a tela igual ao cadastro e apagava o rascunho. A tela dizia "Cadastro
//    atualizado no Vantoro." e o acréscimo sumia. Com a ponte que hiberna, a
//    gravação leva segundos — tempo de sobra para alguém continuar
//    escrevendo nas observações.
//
// 2. O RASCUNHO NÃO ERA DE NINGUÉM. Um mapa do módulo, pelo cadastro, e o
//    "Sair" não recarrega a página: A digitava uma senha GOV num cadastro e
//    saía sem salvar; B entrava na mesma aba, abria o cliente e via (e podia
//    salvar) o que A digitou. Os rascunhos da caixa de escrever já eram por
//    pessoa (`rascunhos.js`) exatamente por isso.
//
// O QUE ESTA PROVA GUARDA:
//   - o que se digita com a gravação no ar continua na tela, continua por
//     salvar, e volta depois de trocar de conversa — e o que foi ao Vantoro
//     é o que estava na tela no clique; com o contraste de que, sem nada
//     digitado no meio, a ficha volta "em dia";
//   - quem entra depois na mesma aba — pelo "Sair", ou depois de a sessão
//     acabar sozinha (sem aviso de saída) — não vê o rascunho de quem saiu;
//     e quem saiu, ao entrar de novo, encontra o dele.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const NUMERO_DEUS = "5567992183107";
const OBS = "Cliente prefere contato à tarde.";
const CLIENTE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
                  telefone: NUMERO_DEUS, telefone2: "", ocupacao: "Costureira",
                  senha_gov: "gov-de-verdade", senha_serasa: "",
                  observacoes: OBS, documentos: 0, processos: [], ordem_servico: null };
const OUTRO = { id: "v-200", nome: "JOSE DA SILVA", cpf: "222.222.222-22",
                telefone: "", telefone2: "", ocupacao: "Pedreiro", observacoes: "Outro cadastro.",
                documentos: 0, processos: [], ordem_servico: null };

const nav = await abrirNavegador();

/** Abre o painel com a ponte de mentira: o número do "Deus" é a ANDREIA, e
 *  qualquer outro número é o JOSE. A gravação (`PATCH`) demora
 *  `demoraDaGravacao`, como o Vantoro atrás da ponte que hiberna. */
async function abrir({ demoraDaGravacao = 0 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  page.on("dialog", (d) => d.accept().catch(() => {}));
  const patches = [];
  const banco = { [CLIENTE.id]: { ...CLIENTE }, [OUTRO.id]: { ...OUTRO } };
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    if (url.pathname.endsWith("/vantoro/status")) {
      return rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, configurado: true }) }).catch(() => {});
    }
    if (url.pathname.endsWith("/vantoro/cliente") && metodo === "GET") {
      const tel = String(url.searchParams.get("telefone") || "").replace(/\D/g, "");
      const foto = { ...banco[tel === NUMERO_DEUS ? CLIENTE.id : OUTRO.id] };
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: [foto], opcoes: {} }) }).catch(() => {});
    }
    const m = /\/vantoro\/cliente\/([^/]+)$/.exec(url.pathname);
    if (m && metodo === "PATCH") {
      let corpo = {};
      try { corpo = JSON.parse(rota.request().postData() || "{}"); } catch (_) { /* vazio */ }
      patches.push(corpo);
      if (demoraDaGravacao) await new Promise((r) => setTimeout(r, demoraDaGravacao));
      banco[m[1]] = { ...banco[m[1]], ...corpo };
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente: banco[m[1]] }) }).catch(() => {});
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }).catch(() => {});
  });
  // A SEGUNDA PESSOA DA ABA: administradora como a primeira, para enxergar as
  // mesmas conversas. TODAS AS BANDEIRAS EM TODA ABERTURA.
  await page.addInitScript(() => {
    globalThis.__SEMENTE = { usuarios: [{ id: "u2", admin: true, nome: "Camila Souza", foto_url: null }] };
    globalThis.__SESSAO_SUMIU = false;
    globalThis.__VIGIA_DA_SESSAO = 600000;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const el = document.querySelector("[data-aviso]");
      const t = el && el.innerText.trim();
      const v = globalThis.__AVISOS_VISTOS;
      if (t && v[v.length - 1] !== t) v.push(t);
    }, 50);
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  // A CONVERSA PELO ID: abrir a ficha renomeia a linha ("Deus" vira o nome
  // do cadastro), e procurar pelo nome depois disso não acha nada.
  const deus = page.locator('[data-conversa-nome*="Deus"]');
  const deusId = (await deus.count())
    ? await deus.first().evaluate((n) => n.closest("[data-conversa-id]")?.getAttribute("data-conversa-id"))
    : null;
  const outraId = await page.evaluate((id) => {
    const n = [...document.querySelectorAll("[data-conversa-id]")]
      .find((x) => x.getAttribute("data-conversa-id") !== id && !/grupo|Mutir/i.test(x.innerText || ""));
    return n ? n.getAttribute("data-conversa-id") : null;
  }, deusId);
  return { ctx, page, estouros, patches, deusId, outraId };
}

async function clicar(loc, espera = 0) {
  if (!(await loc.count())) return false;
  try { await loc.first().click({ timeout: 3000 }); } catch (_) { return false; }
  if (espera) await new Promise((r) => setTimeout(r, espera));
  return true;
}
const irPara = (page, id, espera = 1500) => clicar(page.locator(`[data-conversa-id="${id}"]`), espera);
async function garantirFicha(page) {
  if (!(await page.locator("[data-ficha]").count())) await clicar(page.locator("[data-abrir-ficha]"), 1200);
  await page.waitForTimeout(600);
}
const campo = (page, chave) => page.locator(`[data-campo="${chave}"]`);
const valor = async (page, chave) => ((await campo(page, chave).count()) ? campo(page, chave).first().inputValue() : null);
const estado = (page) => page.locator("[data-salvar-ficha]").first().getAttribute("data-salvar-ficha").catch(() => null);

// ==================================================================
console.log("\n1. O que se digita enquanto a gravação está no ar fica");
{
  const { ctx, page, estouros, patches, deusId, outraId } = await abrir({ demoraDaGravacao: 2000 });
  ok("achei a conversa da cliente e uma outra", Boolean(deusId && outraId), q({ deusId, outraId }));
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("a ficha abriu com as observações", (await valor(page, "observacoes")) === OBS, await valor(page, "observacoes"));

  const PRIMEIRO = `${OBS}\nLigou hoje: vai mandar o comprovante.`;
  const DEPOIS = `${PRIMEIRO}\nE pediu para falar só por mensagem.`;
  await campo(page, "observacoes").fill(PRIMEIRO);
  await page.waitForTimeout(300);
  await clicar(page.getByRole("button", { name: /Salvar no Vantoro/ }));
  // COM A GRAVAÇÃO NO AR, a pessoa continua escrevendo.
  await page.waitForTimeout(500);
  const noAr = await page.getByRole("button", { name: /Salvando/ }).count();
  ok("a gravação está no ar enquanto escrevo", noAr === 1, `${noAr} botões “Salvando…”`);
  await campo(page, "observacoes").fill(DEPOIS);
  await page.waitForTimeout(3000);

  ok("foi ao Vantoro o que estava na tela no clique", patches.length === 1 && patches[0].observacoes === PRIMEIRO, q(patches));
  const naTela = await valor(page, "observacoes");
  ok("o que escrevi durante a gravação continua na tela", naTela === DEPOIS, q(naTela));
  ok("e a ficha diz que há algo por salvar", (await estado(page)) === "pendente", await estado(page));
  await irPara(page, outraId);
  await irPara(page, deusId);
  await garantirFicha(page);
  const voltou = await valor(page, "observacoes");
  ok("e, trocando de conversa e voltando, o acréscimo volta", voltou === DEPOIS, q(voltou));

  // O CONTRASTE: sem nada digitado no meio, a ficha volta EM DIA. Um conserto
  // que deixasse tudo "por salvar" passaria nas conferências de cima.
  await clicar(page.getByRole("button", { name: /Salvar no Vantoro/ }));
  await page.waitForTimeout(3000);
  ok("salvando sem mexer no meio, foi o texto inteiro", patches.length === 2 && patches[1].observacoes === DEPOIS, q(patches.slice(1)));
  ok("e a ficha fica em dia", (await estado(page)) === "em-dia", await estado(page));
  ok("com o texto salvo na tela", (await valor(page, "observacoes")) === DEPOIS);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O rascunho da ficha é de quem digitou");
{
  const { ctx, page, estouros, patches, deusId } = await abrir();
  const SENHA = "senha-gov-que-a-u1-digitou";
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("a senha GOV veio do Vantoro", (await valor(page, "senha_gov")) === CLIENTE.senha_gov, await valor(page, "senha_gov"));
  await campo(page, "senha_gov").fill(SENHA);
  await page.waitForTimeout(400);
  ok("digitei uma senha nova e não salvei", (await estado(page)) === "pendente", await estado(page));

  // SAIR, pelo caminho de sempre: Menu → Configurações → Sair.
  await clicar(page.getByRole("button", { name: "Menu" }), 400);
  await clicar(page.getByRole("button", { name: "Configurações" }), 700);
  await clicar(page.locator("button", { hasText: "Sair" }).filter({ visible: true }));
  const saiu = await page.waitForSelector('input[type="password"]', { timeout: 8000 }).then(() => true).catch(() => false);
  ok("saí, e a tela é a de entrada", saiu);

  // OUTRA PESSOA ENTRA NA MESMA ABA, sem recarregar.
  await page.evaluate(() => globalThis.__ENTRADA_DA_BIBLIOTECA("u2"));
  const entrou = await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).then(() => true).catch(() => false);
  ok("outra pessoa entrou na mesma aba", entrou);
  await page.waitForTimeout(1200);
  await irPara(page, deusId);
  await garantirFicha(page);
  const viu = await valor(page, "senha_gov");
  ok("ela vê a senha do Vantoro, e não a que a outra digitou", viu === CLIENTE.senha_gov, q(viu));
  ok("e a ficha está em dia para ela", (await estado(page)) === "em-dia", await estado(page));
  ok("nada do que a outra digitou foi ao Vantoro", !patches.some((p) => p.senha_gov === SENHA), q(patches));

  // A SESSÃO QUE ACABA SOZINHA não avisa "saiu" — e o rascunho continua
  // não sendo de quem entra depois.
  const NOTA = "Observação que a u2 escreveu e não salvou.";
  await campo(page, "observacoes").fill(NOTA);
  await page.waitForTimeout(400);
  await page.evaluate(() => { globalThis.__SESSAO_SUMIU = true; window.dispatchEvent(new Event("focus")); });
  const caiu = await page.waitForSelector('input[type="password"]', { timeout: 8000 }).then(() => true).catch(() => false);
  ok("a sessão dela acabou sozinha, e a tela é a de entrada", caiu);
  await page.evaluate(() => globalThis.__ENTRADA_DA_BIBLIOTECA("u1"));
  const voltou = await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).then(() => true).catch(() => false);
  ok("a primeira pessoa entrou de novo na mesma aba", voltou);
  await page.waitForTimeout(1200);
  await irPara(page, deusId);
  await garantirFicha(page);
  const obs = await valor(page, "observacoes");
  ok("ela não vê a observação que a outra deixou", obs === OBS, q(obs));
  // QUEM SAIU ENCONTRA O DELE AO VOLTAR — a régua de `rascunhos.js`.
  ok("e encontra a senha que ela mesma tinha digitado", (await valor(page, "senha_gov")) === SENHA, await valor(page, "senha_gov"));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
