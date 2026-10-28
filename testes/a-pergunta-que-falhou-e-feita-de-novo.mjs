// A PERGUNTA À PONTE QUE FALHOU É FEITA DE NOVO (auditoria de 28/10)
//
// "Existe Vantoro nesta instalação?" (`temVantoro.js`) e "o copiloto está
// ligado?" (`copiloto.js`) são perguntadas UMA vez por abertura, com 8
// segundos de prazo. A ponte da Render acordando leva uns 30: a primeira
// abertura do dia estoura o prazo. A falha vira "não consegui", que MOSTRA —
// certo, para o escritório nunca perder a ficha por um tropeço —, mas a
// resposta ficava guardada até o F5. O comentário do módulo prometia que "a
// resposta seguinte conserta", e não havia resposta seguinte: numa
// instalação sem Vantoro, a primeira abertura do dia mostrava as telas do
// Vantoro o dia inteiro — exatamente o que o módulo existe para evitar; e o
// botão do copiloto ficava numa instalação sem a chave, para dar erro a cada
// clique.
//
// O QUE ESTA PROVA GUARDA (com o intervalo encurtado por
// `__PERGUNTAR_DE_NOVO_EM`, como as outras esperas das provas):
//   - a primeira pergunta falha: tudo aparece (a régua da falha que mostra,
//     de `esconder-o-vantoro`); a pergunta seguinte diz "não tem", e a ficha
//     e a aba "Notas no Vantoro" saem de cena sem F5;
//   - o mesmo com o botão do copiloto;
//   - a ponte que continua sem responder não é perguntada para sempre, e o
//     que aparece continua aparecendo;
//   - a resposta que veio na primeira não é perguntada de novo.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const DE_NOVO = 1500;

/** `status(n)` e `copiloto(n)` dizem o que a ponte responde à n-ésima
 *  pergunta (1, 2, …): "falha" (a chamada não completa), ou o corpo. Podem
 *  devolver uma promessa: é assim que a prova SEGURA a resposta da segunda
 *  pergunta até ter olhado a tela com a primeira. */
async function abrir({ status, copiloto }) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  const perguntas = { status: 0, copiloto: 0 };
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (corpo) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) }).catch(() => {});
    if (url.pathname.endsWith("/vantoro/status")) {
      const r = await status(++perguntas.status);
      return r === "falha" ? rota.abort("failed").catch(() => {}) : json(r);
    }
    if (url.pathname.endsWith("/copiloto/estado")) {
      const r = await copiloto(++perguntas.copiloto);
      return r === "falha" ? rota.abort("failed").catch(() => {}) : json(r);
    }
    // A FICHA NÃO TEM CADASTRO: só a coluna existir já basta para medir.
    if (url.pathname.endsWith("/vantoro/cliente")) return json({ clientes: [], opcoes: {} });
    return json({ ok: true });
  });
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((ms) => { globalThis.__PERGUNTAR_DE_NOVO_EM = ms; }, DE_NOVO);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(900);
  // UMA CONVERSA ABERTA, com a caixa vazia: é onde moram o botão da ficha e
  // o do copiloto.
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForSelector("[data-topo-conversa]");
  await page.waitForTimeout(300);
  return { ctx, page, estouros, perguntas };
}
const temFicha = async (page) => (await page.locator("[data-abrir-ficha]").count()) > 0;
const temCopiloto = async (page) => (await page.locator("[data-copiloto-botao]").count()) > 0;
async function abaDasNotas(page) {
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(800);
  const tem = (await page.locator("[data-aba-notas]").count()) > 0;
  await page.locator('b:has-text("Departamentos e acessos") ~ button[aria-label="Fechar"]').first().click().catch(() => {});
  await page.waitForTimeout(300);
  return tem;
}

// ==================================================================
console.log("\n1. A primeira pergunta falha; a seguinte diz que não há Vantoro");
{
  let liberar = null;
  const liberada = new Promise((r) => { liberar = r; });
  const { ctx, page, estouros, perguntas } = await abrir({
    status: async (n) => (n === 1 ? "falha" : (await liberada, { ok: true, configurado: false })),
    copiloto: () => ({ ok: true, ligado: true, modelo: "claude-haiku-5-5" }),
  });
  ok("a primeira pergunta falhou, e a ficha aparece (a falha mostra)", perguntas.status >= 1 && (await temFicha(page)),
     `${perguntas.status} pergunta(s)`);
  await page.waitForTimeout(DE_NOVO + 1000);
  ok("a ponte foi perguntada de novo", perguntas.status >= 2, `${perguntas.status} pergunta(s)`);
  ok("e, enquanto a resposta não chega, a ficha continua lá", await temFicha(page));
  liberar();
  await page.waitForTimeout(1000);
  ok("com a resposta “não tem”, o botão da ficha saiu de cena sem F5", !(await temFicha(page)));
  ok("e a coluna da ficha também", (await page.locator("[data-ficha]").count()) === 0);
  ok("e a aba “Notas no Vantoro” não está na administração", !(await abaDasNotas(page)));
  const depois = perguntas.status;
  await page.waitForTimeout(DE_NOVO * 2 + 500);
  ok("com a resposta na mão, não pergunta mais", perguntas.status === depois, `${depois} → ${perguntas.status}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. O copiloto: a primeira falha mostra; a seguinte diz que não está ligado");
{
  let liberar = null;
  const liberada = new Promise((r) => { liberar = r; });
  const { ctx, page, estouros, perguntas } = await abrir({
    status: () => ({ ok: true, configurado: false }),
    copiloto: async (n) => (n === 1 ? "falha" : (await liberada, { ok: true, ligado: false, modelo: "claude-haiku-5-5" })),
  });
  ok("a primeira pergunta falhou, e o botão do copiloto aparece", perguntas.copiloto >= 1 && (await temCopiloto(page)),
     `${perguntas.copiloto} pergunta(s)`);
  await page.waitForTimeout(DE_NOVO + 1000);
  ok("a ponte foi perguntada de novo", perguntas.copiloto >= 2, `${perguntas.copiloto} pergunta(s)`);
  ok("e, enquanto a resposta não chega, o botão continua lá", await temCopiloto(page));
  liberar();
  await page.waitForTimeout(1000);
  ok("com a resposta “não está ligado”, o botão saiu", !(await temCopiloto(page)));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. A ponte que continua sem responder: aparece, e não é perguntada para sempre");
{
  const { ctx, page, estouros, perguntas } = await abrir({ status: () => "falha", copiloto: () => "falha" });
  await page.waitForTimeout(DE_NOVO * 8);
  ok("a ficha continua aparecendo", await temFicha(page));
  ok("e o copiloto também", await temCopiloto(page));
  ok("a pergunta foi feita de novo", perguntas.status >= 2 && perguntas.copiloto >= 2,
     `vantoro ${perguntas.status}, copiloto ${perguntas.copiloto}`);
  // UM TETO: a ponte que caiu de vez não pode virar uma pergunta a cada
  // poucos segundos o dia inteiro, de cada aba aberta.
  ok("mas não sem parar (no máximo cinco vezes cada)", perguntas.status <= 5 && perguntas.copiloto <= 5,
     `vantoro ${perguntas.status}, copiloto ${perguntas.copiloto}`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. A resposta que veio de primeira não é perguntada de novo");
{
  const { ctx, page, perguntas } = await abrir({
    status: () => ({ ok: true, configurado: true }),
    copiloto: () => ({ ok: true, ligado: true, modelo: "claude-haiku-5-5" }),
  });
  await page.waitForTimeout(DE_NOVO * 3);
  ok("com Vantoro, a ficha aparece", await temFicha(page));
  ok("e a ponte foi perguntada uma vez só (cada pergunta)", perguntas.status === 1 && perguntas.copiloto === 1,
     `vantoro ${perguntas.status}, copiloto ${perguntas.copiloto}`);
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
