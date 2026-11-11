// O LINK DA OS NA FICHA DO VANTORO (11/11)
//
// Pedido do Rodrigo, com a foto da ficha: "em 'Ficha no Vantoro', colocar um
// link para abrir a OS do Cliente". A caixa "ORDEM DE SERVIÇO · ABERTA" dizia
// as pendências e não levava a lugar nenhum: para abrir a ordem, era preciso
// abrir a ficha completa no Vantoro e procurar a ordem lá dentro.
//
// O Vantoro já manda o número da ordem (`ordem_servico.id`, em `_resumo`), e a
// tela dela é `/cadastro/ordem/<id>/` (core/urls.py, `core_ordem`, só com
// login: qualquer pessoa entrada vê; mexer é de quem puxou).
//
// ------------------------------------------------------------
// O QUE ESTA PROVA GUARDA
//
//   1. com o número da ordem, o link "Abrir a OS" está NA LINHA do status,
//      pintado, dentro da ficha, e leva a `/cadastro/ordem/<id>/` no endereço
//      do Vantoro (`enderecoNoVantoro`), numa aba nova, com `noopener`;
//   2. o clique abre a aba nova nesse endereço, e o Zorvin fica onde estava;
//   3. sem o número (um Vantoro de antes), a caixa continua, sem link;
//   4. sem ordem, nem caixa nem link;
//   5. a ficha na gaveta (a 1100) e no celular (390) também mostram o link,
//      pintado e dentro da tela.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const OS = { id: 77, status: "ABERTA", pendencias: [
  { id: 1, titulo: "SUBSÍDIO CCR", responsavel: "Fulano de Tal" },
  { id: 2, titulo: "SUBSÍDIO EMENDA", responsavel: null },
] };
const BASE = { id: "v-100", nome: "ANDREIA CRISTINA MARTINS", cpf: "111.111.111-11",
               telefone: "5567992183107", telefone2: "", observacoes: "",
               documentos: 0, processos: [], ordem_servico: OS };
const ESPERADO = "https://app.vantoro.com.br/cadastro/ordem/77/";

const nav = await abrirNavegador();

async function abrirFicha(cliente, largura = 1500, altura = 900) {
  const celular = largura < 768;
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura },
                                     ...(celular ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await ctx.route("https://app.vantoro.com.br/**", (rota) =>
    rota.fulfill({ status: 200, contentType: "text/html", body: "<title>Vantoro</title>OS" }));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    if (url.pathname.endsWith("/vantoro/status")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ligado: true, configurado: true }) });
    }
    if (url.pathname.endsWith("/vantoro/cliente")) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ clientes: [cliente], opcoes: {} }) });
    }
    if (/\/vantoro\/cliente\/[^/]+$/.test(url.pathname)) {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, cliente }) });
    }
    rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const linha = page.locator('[data-conversa-nome*="Deus"]');
  if (await linha.count()) { await linha.first().click(); await page.waitForTimeout(1200); }
  if (!(await page.locator("[data-ficha]").count())) {
    const b = page.locator("[data-abrir-ficha]");
    if (await b.count() && await b.first().isVisible()) await b.first().click();
    else {
      const mais = page.getByRole("button", { name: "Mais opções desta conversa" });
      if (await mais.count()) {
        await mais.first().click().catch(() => {});
        await page.waitForTimeout(300);
        const item = page.locator("[data-menu-ficha]");
        if (await item.count()) await item.first().click().catch(() => {});
      }
    }
  }
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}

/** O link medido: onde está, se está pintado, e onde está o status. */
async function medir(page) {
  return page.evaluate(() => {
    const a = document.querySelector("[data-ficha] [data-abrir-a-os]");
    const ficha = document.querySelector("[data-ficha]");
    const rotulo = [...document.querySelectorAll("[data-ficha] div")]
      .find((d) => d.children.length === 0 && /ORDEM DE SERVIÇO/.test(d.textContent));
    if (!a) return { tem: false, rotulo: !!rotulo };
    a.scrollIntoView({ block: "center" });
    const r = a.getBoundingClientRect(), f = ficha.getBoundingClientRect();
    const l = rotulo ? rotulo.getBoundingClientRect() : null;
    const quem = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return {
      tem: true, rotulo: !!rotulo,
      href: a.getAttribute("href"), alvo: a.getAttribute("target"), rel: a.getAttribute("rel") || "",
      texto: a.textContent.trim(), title: a.getAttribute("title") || "",
      pintado: !!quem && (quem === a || a.contains(quem)),
      dentro: r.left >= f.left - 1 && r.right <= f.right + 1 && r.left >= 0 && r.right <= innerWidth,
      mesmaLinha: !!l && Math.abs((r.top + r.bottom) / 2 - (l.top + l.bottom) / 2) <= 8,
      largura: Math.round(r.width),
    };
  });
}

console.log("\nCom o número da ordem, o link leva à OS");
{
  const { ctx, page, estouros } = await abrirFicha(BASE);
  const m = await medir(page);
  ok("a caixa da ordem está lá", m.rotulo);
  ok("o link \"Abrir a OS\" aparece", m.tem && m.texto === "Abrir a OS", JSON.stringify(m));
  ok("aponta para a OS no Vantoro", m.href === ESPERADO, String(m.href));
  ok("numa aba nova", m.alvo === "_blank");
  ok("com noopener e noreferrer", /noopener/.test(m.rel) && /noreferrer/.test(m.rel), m.rel);
  ok("diz o que faz no title", /ordem de serviço/i.test(m.title), m.title);
  ok("está pintado", m.pintado);
  ok("dentro da ficha", m.dentro);
  ok("na mesma linha do status", m.mesmaLinha);
  if (m.tem) {
    const [aba] = await Promise.all([
      ctx.waitForEvent("page", { timeout: 8000 }).catch(() => null),
      page.locator("[data-ficha] [data-abrir-a-os]").first().click().catch(() => {}),
    ]);
    if (aba) await aba.waitForLoadState().catch(() => {});
    ok("o clique abre a aba nova na OS", !!aba && aba.url() === ESPERADO, aba ? aba.url() : "nenhuma aba");
    ok("e o Zorvin fica onde estava", page.url().startsWith(ENDERECO) && await page.locator("[data-ficha]").count() > 0);
  } else {
    ok("o clique abre a aba nova na OS", false, "sem link");
    ok("e o Zorvin fica onde estava", false, "sem link");
  }
  ok("a ficha completa continua", await page.locator("[data-ficha-completa]").count() === 1);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nSem o número da ordem (um Vantoro de antes), a caixa fica e o link não");
{
  const { ctx, page, estouros } = await abrirFicha({ ...BASE, ordem_servico: { status: "ABERTA", pendencias: [] } });
  const m = await medir(page);
  ok("a caixa da ordem está lá", m.rotulo);
  ok("sem link", !m.tem);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

console.log("\nSem ordem, nem caixa nem link");
{
  const { ctx, page } = await abrirFicha({ ...BASE, ordem_servico: null });
  const m = await medir(page);
  ok("a ficha abriu", await page.locator("[data-ficha]").count() > 0);
  ok("sem caixa", !m.rotulo);
  ok("sem link", !m.tem);
  await ctx.close();
}

console.log("\nO número vai escapado no endereço");
{
  const { ctx, page } = await abrirFicha({ ...BASE, ordem_servico: { ...OS, id: "9/x" } });
  const m = await medir(page);
  ok("a barra do número não vira outro caminho",
     m.href === "https://app.vantoro.com.br/cadastro/ordem/9%2Fx/", String(m.href));
  await ctx.close();
}

for (const [nome, larg, alt] of [["a ficha na gaveta, a 1100", 1100, 800], ["o celular, a 390", 390, 844]]) {
  console.log(`\n${nome}`);
  const { ctx, page, estouros } = await abrirFicha(BASE, larg, alt);
  const m = await medir(page);
  ok("o link aparece", m.tem && m.href === ESPERADO, JSON.stringify(m));
  ok("pintado", !!m.pintado);
  ok("dentro da ficha e da tela", !!m.dentro);
  ok("na mesma linha do status", !!m.mesmaLinha);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
