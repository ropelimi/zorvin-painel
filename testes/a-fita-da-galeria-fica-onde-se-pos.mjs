// A FITA DA GALERIA FICA ONDE A PESSOA A PÔS (auditoria de 28/10)
//
// Com uma imagem aberta, a fita de miniaturas embaixo rola sozinha até ela —
// senão, numa conversa de trinta fotos, a marcada fica fora da vista. Quem
// rolava era um `ref` em função escrito ali mesmo: uma função NOVA a cada
// desenho, que o React chama de novo a cada redesenho. E o painel redesenha o
// tempo todo — o tempo real, o "digitando…" e o "estou atendendo" dos
// colegas. Quem rolava a fita para procurar outra foto via a fita voltar ao
// centro sozinha, no meio do gesto.
//
// O QUE ESTA PROVA GUARDA: a fita rolada à mão fica onde está quando o painel
// redesenha; e, trocando a imagem aberta, ela ainda rola até a nova (o
// contraste — senão uma fita que nunca rola passaria).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1000);
  const adv = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return adv;
}
const TEL = await telefoneQueAbre();
ok("aprendi o telefone que abre", Boolean(TEL));
if (!TEL) { await nav.close(); process.exit(1); }

/** Uma imagem pequena e DIFERENTE das outras: a galeria acha a aberta pelo
 *  endereço, e trinta endereços iguais seriam uma foto só. */
const foto = (i) => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60"><rect width="60" height="60" fill="#${(i * 7919).toString(16).slice(-6).padStart(6, "3")}"/><text x="8" y="38" font-size="24">${i}</text></svg>`);
const N = 30;
const NOME = "GALERIA CLIENTE TRINTA FOTOS";
const SEMENTE = {
  contatos: [{ id: "ct-gal", numero: "5511970003311", nome: NOME, vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-gal", advogado_id: TEL, contato_id: "ct-gal", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: "[anexo]", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-gal", nome: NOME, numero: "5511970003311", foto_url: null } }],
  mensagens: Array.from({ length: N }, (_, k) => ({
    id: `m-gal-${k + 1}`, conversa_id: "cv-gal", origem: "contato", tipo: "imagem", texto: null,
    midia_url: foto(k + 1), midia_mime: "image/svg+xml", id_uazapi: `uz-m-gal-${k + 1}`,
    criado_em: new Date(AGORA - (N - k) * 60e3).toISOString() })),
};

const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.locator('[data-conversa-id="cv-gal"]').first().click().catch(() => {});
await page.waitForTimeout(1500);

/** A fita: o pai das miniaturas. */
const fita = () => page.evaluate(() => {
  const f = document.querySelector('button[title="Imagem 1"]')?.parentElement;
  return f ? { rolagem: Math.round(f.scrollLeft), largura: f.scrollWidth, visivel: f.clientWidth } : null;
});
/** Um aviso de tempo real que não muda nada na galeria — um colega
 *  "digitando…" — e redesenha o painel inteiro. */
const redesenhar = () => page.evaluate(() => {
  const c = globalThis.__TABELAS.conversas.find((x) => x.id === "cv-gal");
  const { contato, ...linha } = c;
  globalThis.__EMITIR("UPDATE", "conversas", { ...linha, digitando_ate: new Date(Date.now() + 5000).toISOString(),
                                                atendendo_por: "Colega", atendendo_em: new Date().toISOString() });
});

console.log("\nA fita rolada à mão não volta ao centro quando o painel redesenha");
const abrirA15 = page.locator('[data-msg-id="m-gal-15"] button[aria-label="Abrir a imagem em tela cheia"]');
ok("a foto 15 está na conversa", (await abrirA15.count()) === 1);
await abrirA15.first().click().catch(() => {});
await page.waitForTimeout(600);
const aberta = await fita();
ok("a galeria abriu com a fita", Boolean(aberta) && aberta.largura > aberta.visivel, JSON.stringify(aberta));
ok("e a fita rolou até a 15, no meio dela", Boolean(aberta) && aberta.rolagem > 0, JSON.stringify(aberta));
// A PESSOA ROLA A FITA para o começo, procurando outra foto.
await page.evaluate(() => { document.querySelector('button[title="Imagem 1"]').parentElement.scrollLeft = 0; });
await page.waitForTimeout(150);
ok("rolei a fita até o começo", (await fita())?.rolagem === 0);
await redesenhar();
await page.waitForTimeout(150);
await redesenhar();
await page.waitForTimeout(400);
const depois = await fita();
ok("o painel redesenhou, e a fita CONTINUA no começo", depois?.rolagem === 0, JSON.stringify(depois));

console.log("\nTrocar a imagem aberta ainda rola a fita até ela");
await page.keyboard.press("ArrowRight");
await page.waitForTimeout(500);
const proxima = await fita();
ok("→ abriu a 16, e a fita foi até ela", (await page.locator('button[title="Imagem 16"]').count()) === 1
   && proxima?.rolagem > 0, JSON.stringify(proxima));
ok("a tela não estourou", !estouros.length, estouros.join(" | "));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
