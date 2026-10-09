// A FICHA GUARDA O QUE FOI DIGITADO E AINDA NÃO FOI SALVO (09/10)
//
// Relato do Rodrigo: *"quando eu salvo algo nas observações dentro da Ficha
// do Vantoro, tudo o que eu escrevi não está ficando salvo depois que eu saio
// da ficha e entro novamente"*.
//
// A ficha é REMONTADA a cada conversa (auditoria de 07/10), e o que estava
// digitado e não salvo ia embora junto, sem uma palavra. O "Salvar no
// Vantoro" fica depois de todas as seções — fora da vista de quem escreve
// nas observações, lá no alto.
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. escrever e trocar de conversa sem salvar: o texto VOLTA, e a ficha
//      diz que ele não foi salvo; nada foi ao Vantoro sem o clique;
//   2. o botão de salvar fica À VISTA enquanto há algo por salvar;
//   3. recolher a ficha não descarta nem pergunta; abrir de novo devolve;
//   4. "Descartar" pergunta e volta ao Vantoro; "Atualizar" também descarta;
//   5. o rascunho é do CADASTRO: não aparece na ficha de outro cliente;
//   6. recarregar a página com algo por salvar pergunta antes;
//   7. A CORRIDA: salvar, trocar de conversa e voltar antes de a gravação
//      terminar — a ficha nova lê o cadastro de ANTES, e o texto não pode
//      sumir por isso.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const NUMERO_DEUS = "5567992183107";
const OBS_A = "Cliente prefere contato à tarde.";
const NOVO = "Cliente prefere contato à tarde.\nLigou hoje: vai mandar o comprovante amanhã.";
const OBS_B = "Cadastro de outra pessoa.";
const CLIENTE_A = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
                    telefone: NUMERO_DEUS, telefone2: "", ocupacao: "Costureira",
                    observacoes: OBS_A, documentos: 0, processos: [], ordem_servico: null };
const CLIENTE_B = { id: "v-200", nome: "JOSE DA SILVA", cpf: "222.222.222-22",
                    telefone: "", telefone2: "", ocupacao: "Pedreiro",
                    observacoes: OBS_B, documentos: 0, processos: [], ordem_servico: null };

const nav = await abrirNavegador();

/** Abre o painel com a ponte de mentira: o número do "Deus" é a cliente A, e
 *  qualquer outro número é o cliente B. `demoraDaLeitura` e
 *  `demoraDaGravacao` simulam o Vantoro atrás da ponte que hiberna — e a
 *  leitura devolve o cadastro COMO ESTAVA quando o pedido chegou, que é o
 *  que um banco faz com uma leitura que começou antes da gravação. */
async function abrir({ demoraDaLeitura = 0, demoraDaGravacao = 0 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const dialogos = [];
  let responder = "aceitar";
  page.on("dialog", async (d) => {
    dialogos.push(d.message());
    if (responder === "aceitar") await d.accept(); else await d.dismiss();
  });
  const patches = [];
  const banco = { [CLIENTE_A.id]: { ...CLIENTE_A }, [CLIENTE_B.id]: { ...CLIENTE_B } };
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const metodo = rota.request().method();
    if (url.pathname.endsWith("/vantoro/cliente") && metodo === "GET") {
      const tel = String(url.searchParams.get("telefone") || "").replace(/\D/g, "");
      const foto = { ...banco[tel === NUMERO_DEUS ? CLIENTE_A.id : CLIENTE_B.id] };
      if (demoraDaLeitura) await new Promise((r) => setTimeout(r, demoraDaLeitura));
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
    if (m && metodo === "GET") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente: banco[m[1]] || {} }) }).catch(() => {});
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }).catch(() => {});
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  // A CONVERSA É ENDEREÇADA PELO ID: abrir a ficha RENOMEIA a linha ("Deus"
  // vira o nome do cadastro), e procurar pelo nome depois disso não acha nada.
  const deus = page.locator('[data-conversa-nome*="Deus"]');
  const deusId = (await deus.count())
    ? await deus.first().evaluate((n) => n.closest("[data-conversa-id]")?.getAttribute("data-conversa-id"))
    : null;
  const outraId = await page.evaluate((id) => {
    const ns = [...document.querySelectorAll("[data-conversa-id]")];
    const n = ns.find((x) => x.getAttribute("data-conversa-id") !== id
                             && !/grupo|Mutir/i.test(x.innerText || ""));
    return n ? n.getAttribute("data-conversa-id") : null;
  }, deusId);
  return { ctx, page, estouros, patches, dialogos, deusId, outraId, banco,
           responder: (r) => { responder = r; } };
}

/** Cliques GUARDADOS: num elemento que não existe, `click()` estoura a prova
 *  inteira e esconde qual conferência pegou o defeito. */
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
const caixa = (page) => page.locator('[data-campo="observacoes"]');
const valor = async (page) => ((await caixa(page).count()) ? await caixa(page).inputValue() : null);
const estado = (page) => page.locator("[data-salvar-ficha]").first().getAttribute("data-salvar-ficha").catch(() => null);
const frase = (page) => page.locator("[data-ficha-por-salvar]").first().innerText().catch(() => "");
async function escrever(page, texto) {
  if (!(await caixa(page).count())) return false;
  await caixa(page).fill(texto);
  await page.waitForTimeout(300);
  return true;
}
const salvar = (page) => clicar(page.getByRole("button", { name: /Salvar no Vantoro/ }), 1500);

// ==================================================================
console.log("\n1. Escrever e trocar de conversa sem salvar: o texto volta");
{
  const { ctx, page, estouros, patches, deusId, outraId } = await abrir();
  ok("achei a conversa da cliente e uma outra", Boolean(deusId && outraId), q({ deusId, outraId }));
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("a ficha abriu com as observações do Vantoro", (await valor(page)) === OBS_A, q(await valor(page)));
  ok("sem nada por salvar, o pé da ficha está em dia", (await estado(page)) === "em-dia", q(await estado(page)));
  ok("e não oferece descartar", (await page.locator("[data-descartar-ficha]").count()) === 0);

  ok("escrevi nas observações", await escrever(page, NOVO));
  ok("a ficha diz que há algo por salvar", (await estado(page)) === "pendente", q(await estado(page)));
  ok("com a frase de quem está mudando agora", /ainda não foram salvas/.test(await frase(page)), q(await frase(page)));

  // O BOTÃO À VISTA: o que está PINTADO no centro dele é ele mesmo, sem rolar.
  const pintado = await page.evaluate(() => {
    const b = [...document.querySelectorAll("[data-salvar-ficha] button")]
      .find((x) => /Salvar no Vantoro/.test(x.innerText));
    if (!b) return { achou: false };
    const r = b.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const el = document.elementFromPoint(x, y);
    return { achou: true, dentro: y > 0 && y < window.innerHeight, pinta: Boolean(el && b.contains(el)), y };
  });
  ok("o Salvar no Vantoro está À VISTA, sem rolar a ficha", pintado.achou && pintado.dentro && pintado.pinta, q(pintado));

  await irPara(page, outraId);
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("voltando à conversa, o texto digitado VOLTOU", (await valor(page)) === NOVO, q(await valor(page)));
  ok("e a ficha diz que ele não foi salvo", (await estado(page)) === "pendente"
     && /deixou alterações sem salvar/.test(await frase(page)), q([await estado(page), await frase(page)]));
  ok("e nada foi ao Vantoro sem o clique", patches.length === 0, q(patches));

  ok("salvei", await salvar(page));
  ok("foi ao Vantoro o texto inteiro", patches.length === 1 && patches[0].observacoes === NOVO, q(patches));
  ok("e o pé da ficha voltou a estar em dia", (await estado(page)) === "em-dia", q(await estado(page)));
  await irPara(page, outraId);
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("trocando e voltando, o texto é o do Vantoro — e não há aviso", (await valor(page)) === NOVO
     && (await estado(page)) === "em-dia", q([await valor(page), await estado(page)]));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Recolher a ficha não descarta, e nem pergunta");
{
  const { ctx, page, estouros, dialogos, deusId } = await abrir();
  await irPara(page, deusId);
  await garantirFicha(page);
  await escrever(page, NOVO);
  ok("recolhi a ficha", await clicar(page.locator("[data-recolher-ficha]"), 800));
  ok("sem pergunta nenhuma", dialogos.length === 0, q(dialogos));
  ok("a ficha saiu da tela", (await page.locator("[data-ficha]").count()) === 0);
  await clicar(page.locator("[data-abrir-ficha]"), 1500);
  ok("abrindo de novo, o texto digitado continua lá", (await valor(page)) === NOVO, q(await valor(page)));
  ok("e diz que não foi salvo", (await estado(page)) === "pendente", q(await estado(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Descartar pergunta e volta ao Vantoro; Atualizar também descarta");
{
  const { ctx, page, estouros, dialogos, deusId, outraId, responder } = await abrir();
  await irPara(page, deusId);
  await garantirFicha(page);
  await escrever(page, NOVO);
  responder("recusar");
  await clicar(page.locator("[data-descartar-ficha]"), 400);
  ok("Descartar pergunta antes", dialogos.length === 1 && /Descartar/.test(dialogos[0]), q(dialogos));
  ok("e, sem confirmar, o texto fica", (await valor(page)) === NOVO, q(await valor(page)));
  responder("aceitar");
  await clicar(page.locator("[data-descartar-ficha]"), 400);
  ok("confirmando, volta ao que está no Vantoro", (await valor(page)) === OBS_A, q(await valor(page)));
  ok("e o pé volta a estar em dia", (await estado(page)) === "em-dia", q(await estado(page)));
  await irPara(page, outraId);
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("trocando e voltando, o descartado não volta", (await valor(page)) === OBS_A
     && (await estado(page)) === "em-dia", q([await valor(page), await estado(page)]));

  await escrever(page, NOVO);
  const antes = dialogos.length;
  await clicar(page.getByTitle("Atualizar"), 1500);
  ok("Atualizar pergunta antes de descartar", dialogos.length === antes + 1, q(dialogos));
  ok("e, confirmado, troca o digitado pelo que está no Vantoro", (await valor(page)) === OBS_A
     && (await estado(page)) === "em-dia", q([await valor(page), await estado(page)]));
  await irPara(page, outraId);
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("e o rascunho não volta depois do Atualizar", (await valor(page)) === OBS_A, q(await valor(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. O rascunho é do cadastro: não aparece na ficha de outra pessoa");
{
  const { ctx, page, estouros, deusId, outraId } = await abrir();
  await irPara(page, deusId);
  await garantirFicha(page);
  await escrever(page, NOVO);
  await irPara(page, outraId);
  await garantirFicha(page);
  // O NOME MORA NUM CAMPO de digitar, e o `innerText` não lê o que está
  // dentro de campo — é o valor dele que diz de quem é a ficha.
  const nome = await page.locator('[data-campo="nome"]').first().inputValue().catch(() => null);
  ok("a outra conversa abre a ficha do outro cliente", nome === "JOSE DA SILVA", q(nome));
  ok("com as observações DELE", (await valor(page)) === OBS_B, q(await valor(page)));
  ok("e sem aviso de algo por salvar", (await estado(page)) === "em-dia", q(await estado(page)));
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("e o rascunho da cliente continua com ela", (await valor(page)) === NOVO, q(await valor(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. Recarregar a página com algo por salvar pergunta antes");
{
  const { ctx, page, deusId } = await abrir();
  const perguntaAoSair = () => page.evaluate(() => {
    const e = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(e);
    return e.defaultPrevented;
  });
  await irPara(page, deusId);
  await garantirFicha(page);
  ok("sem nada por salvar, sair não pergunta", (await perguntaAoSair()) === false);
  await escrever(page, NOVO);
  ok("com algo por salvar, sair pergunta", (await perguntaAoSair()) === true);
  await clicar(page.locator("[data-recolher-ficha]"), 600);
  ok("mesmo com a ficha recolhida", (await perguntaAoSair()) === true);
  await ctx.close();
}

// ==================================================================
console.log("\n6. A corrida: salvar, sair e voltar antes de a gravação terminar");
{
  // A gravação leva 1,2 s; a leitura, 2,5 s, e devolve o cadastro como
  // estava quando o pedido CHEGOU — antes da gravação. É a ponte que hiberna.
  const { ctx, page, estouros, patches, deusId, outraId } = await abrir({ demoraDaLeitura: 2500, demoraDaGravacao: 1200 });
  await irPara(page, deusId, 3500);
  await garantirFicha(page);
  ok("a ficha abriu", (await valor(page)) === OBS_A, q(await valor(page)));
  await escrever(page, NOVO);
  await clicar(page.getByRole("button", { name: /Salvar no Vantoro/ }), 150);
  await irPara(page, outraId, 200);
  await irPara(page, deusId, 5000);
  await garantirFicha(page);
  ok("a gravação chegou ao Vantoro", patches.length === 1 && patches[0].observacoes === NOVO, q(patches));
  ok("e o texto continua na tela, mesmo com a ficha tendo lido o cadastro de antes",
     (await valor(page)) === NOVO, q(await valor(page)));
  await irPara(page, outraId, 3500);
  await irPara(page, deusId, 3500);
  await garantirFicha(page);
  ok("trocando e voltando de novo, o Vantoro já tem o texto, e não há aviso",
     (await valor(page)) === NOVO && (await estado(page)) === "em-dia", q([await valor(page), await estado(page)]));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
