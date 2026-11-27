// AS ETIQUETAS QUE VÊM DO VANTORO SÓ SERVEM PARA FILTRAR (27/11).
//
// Pedido do Rodrigo: a blindagem e o subsídio de cada cliente viram etiquetas
// que o Zorvin põe e tira sozinho (script 075 da ponte), e "não pode ser
// possível a equipe editar essas etiquetas, não deve ser permitido excluir
// ou incluir. As etiquetas devem aparecer apenas para serem filtradas."
//
// O que esta prova confere, com uma etiqueta automática (`automatica`
// preenchida) plantada ao lado das duas da equipe:
//
//   1. o menu "Etiquetas" da conversa não oferece a automática para marcar,
//      e oferece as da equipe;
//   2. o filtro da seta oferece a automática, e filtra por ela;
//   3. em Configurações → Etiquetas a automática diz "Vem do Vantoro", sem
//      os botões de editar e apagar, e as da equipe continuam com os dois.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const contato = (id, nome, numero) => ({ id, nome, numero, foto_url: null });
const conversa = (id, ct, minutos) => ({
  id, advogado_id: "a7", contato_id: ct.id, nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: iso(AGORA - minutos * 60e3), ultima_mensagem: "Bom dia, tudo bem?",
  esperando_desde: null, frente: null, vantoro_nome: null, digitando_ate: null,
  contato: { nome: ct.nome, numero: ct.numero, foto_url: null },
});
const CT_BL = contato("ev-ct-bl", "CLIENTE BLINDAGEM", "5511930003333");
const CT_OU = contato("ev-ct-ou", "CLIENTE OUTRO", "5511930004444");
const AUTO = "t-blindagem-parcial";
const SEMENTE = {
  tags: [{ id: AUTO, nome: "Blindagem parcial", cor: "#f9a825", automatica: "blindagem:parcial" }],
  contatos: [CT_BL, CT_OU],
  conversas: [conversa("ev-bl", CT_BL, 1), conversa("ev-ou", CT_OU, 2)],
  mensagens: [
    { id: "ev-m-bl", conversa_id: "ev-bl", origem: "contato", tipo: "texto", texto: "Bom dia, tudo bem?", id_uazapi: "EV-M-BL", criado_em: iso(AGORA - 60e3) },
    { id: "ev-m-ou", conversa_id: "ev-ou", origem: "contato", tipo: "texto", texto: "Bom dia, tudo bem?", id_uazapi: "EV-M-OU", criado_em: iso(AGORA - 120e3) },
  ],
  conversa_tags: [{ id: "ev-tag-1", conversa_id: "ev-bl", tag_id: AUTO }],
};

const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]", { timeout: 60000 }).catch(() => {});
await page.waitForSelector('[data-conversa-id="ev-bl"]', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(1500);
const contar = (sel) => page.locator(sel).count();
async function clicar(sel) {
  if (!(await contar(sel))) return false;
  try { await page.locator(sel).first().click({ timeout: 3000 }); return true; } catch (_) { return false; }
}
const opcoes = (sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((b) => b.getAttribute("data-tag-opcao") || b.getAttribute("data-etiqueta-da-seta")), sel);

console.log("\n1. O menu das etiquetas da conversa");
{
  ok("abri a conversa com a etiqueta automática", await clicar('[data-conversa-id="ev-bl"]'));
  await page.waitForTimeout(800);
  const alto = (await contar("[data-etiquetas-do-alto]")) ? await page.locator("[data-etiquetas-do-alto]").first().innerText() : "";
  ok("o alto da conversa mostra a etiqueta automática", /Blindagem parcial/.test(alto), alto);
  ok("abri o menu das etiquetas", await clicar('button[aria-label="Etiquetas"]'));
  await page.waitForTimeout(300);
  ok("o menu abriu", (await contar("[data-menu-marcar-tags]")) > 0);
  const marcar = await opcoes("[data-menu-marcar-tags] [data-tag-opcao]");
  ok("ele NÃO oferece a etiqueta automática para marcar", !marcar.includes(AUTO), JSON.stringify(marcar));
  ok("e oferece as da equipe", marcar.includes("t-urgente") && marcar.includes("t-aguardando"), JSON.stringify(marcar));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
}

console.log("\n2. O filtro da seta");
{
  ok("abri a seta dos filtros", await clicar("[data-mais-filtros]"));
  await page.waitForTimeout(300);
  const seta = await opcoes("[data-etiqueta-da-seta]");
  ok("a seta oferece a etiqueta automática para filtrar", seta.includes(AUTO), JSON.stringify(seta));
  ok("escolhi “Blindagem parcial”", await clicar(`[data-etiqueta-da-seta="${AUTO}"]`));
  await page.waitForTimeout(2000);
  const ids = await page.evaluate(() => [...document.querySelectorAll("[data-conversa-id]")].map((el) => el.getAttribute("data-conversa-id")));
  ok("o filtro acha a conversa pela etiqueta automática, e não a outra", ids.includes("ev-bl") && !ids.includes("ev-ou"), JSON.stringify(ids));
}

console.log("\n3. Configurações → Etiquetas");
{
  await page.getByRole("button", { name: "Menu" }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.getByRole("button", { name: "Configurações" }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Etiquetas", exact: true }).last().click().catch(() => {});
  await page.waitForTimeout(700);
  const linha = (nome) => page.locator(`[data-etiqueta-da-config="${nome}"]`);
  ok("a etiqueta automática está na lista", (await linha("Blindagem parcial").count()) === 1);
  ok("ela diz que vem do Vantoro", (await linha("Blindagem parcial").locator("[data-etiqueta-do-vantoro]").count()) === 1);
  ok("e não tem o botão de editar", (await linha("Blindagem parcial").locator("[data-editar-etiqueta]").count()) === 0);
  ok("nem o de apagar", (await linha("Blindagem parcial").locator("[data-apagar-etiqueta]").count()) === 0);
  ok("a da equipe continua com editar e apagar",
     (await linha("Urgente").locator("[data-editar-etiqueta]").count()) === 1 && (await linha("Urgente").locator("[data-apagar-etiqueta]").count()) === 1);
  ok("e não diz que vem do Vantoro", (await linha("Urgente").locator("[data-etiqueta-do-vantoro]").count()) === 0);
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
