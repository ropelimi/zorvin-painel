// A SUBIDA DAS NOTAS ANTIGAS PARA QUANDO A ABA SAI DE CENA (auditoria de 28/10)
//
// "Subir agora", na aba "Notas no Vantoro", é um laço de fatias (`for (;;)`)
// que só olhava o `parar` do botão "Parar". Trocar de aba ou fechar
// "Departamentos e acessos" desmonta a aba — e o laço seguia sozinho, fatia
// atrás de fatia, martelando a ponte sem ninguém ver o progresso. Voltar à
// aba mostrava o botão "Subir agora" de novo (a aba nova não sabe do laço
// velho), e apertá-lo punha DOIS laços em paralelo sobre os mesmos clientes.
//
// O QUE ESTA PROVA GUARDA:
//   - saindo da aba no meio da subida, as fatias param (no máximo a que já
//     estava no ar termina);
//   - voltando e apertando de novo, a subida anda sozinha: nunca dois pedidos
//     de fatia no ar ao mesmo tempo — e chega ao fim;
//   - fechar a janela inteira também para a subida.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const nav = await abrirNavegador();

// A PONTE DE MENTIRA: quarenta clientes em fatias de dois, cada fatia levando
// o tempo de uma ida ao Vantoro. O laço inteiro leva uns oito segundos —
// tempo de sobra para sair da aba no meio.
const TOTAL = 40;
const FATIA = 2;
const DEMORA = 400;
let chamadas = [];     // cada fatia pedida: { de, quando }
let emVoo = 0;
let maisNoAr = 0;      // o maior número de fatias no ar ao mesmo tempo

async function abrir() {
  const ctx = await nav.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (corpo) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) }).catch(() => {});
    if (url.pathname.endsWith("/vantoro/status")) return json({ ok: true, configurado: true });
    if (url.pathname.endsWith("/vantoro/diagnostico-notas")) {
      return json({ ok: true, contatos: 90, contatos_com_cadastro_no_vantoro: TOTAL, notas: 60, notas_que_ja_subiram: 0,
                    diagnostico: "Existem 40 contato(s) com cadastro e 60 nota(s), e NENHUMA está marcada como subida." });
    }
    if (url.pathname.endsWith("/vantoro/notas/subir-tudo")) {
      const de = Number(url.searchParams.get("de") || 0);
      chamadas.push({ de, quando: Date.now() });
      emVoo += 1;
      maisNoAr = Math.max(maisNoAr, emVoo);
      await espera(DEMORA);
      emVoo -= 1;
      const ate = Math.min(de + FATIA, TOTAL);
      return json({ ok: true, simulacao: false, clientes: ate - de, subiram: ate - de, falharam: 0, jaEstavam: 0,
                    de, ate, total_clientes: TOTAL, fim: ate >= TOTAL, com_problema: [] });
    }
    return json({ ok: true });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: "Menu" }).click();
  await page.getByRole("button", { name: "Departamentos e acessos" }).click();
  await page.waitForTimeout(500);
  return { ctx, page, estouros };
}
async function irParaAsNotas(page) {
  await page.locator("[data-aba-notas]").click();
  await page.waitForSelector("[data-vantoro-subir]", { timeout: 10000 });
  await page.waitForTimeout(400);
}
/** Espera até haver `n` fatias pedidas (ou o prazo acabar). */
async function esperarFatias(n, ms = 8000) {
  const ate = Date.now() + ms;
  while (chamadas.length < n && Date.now() < ate) await espera(50);
  return chamadas.length >= n;
}

// ==================================================================
console.log("\n1. Saindo da aba no meio, a subida para; voltando, ela anda sozinha");
{
  chamadas = []; emVoo = 0; maisNoAr = 0;
  const { ctx, page, estouros } = await abrir();
  await irParaAsNotas(page);
  await page.locator("[data-vantoro-subir]").click();
  ok("a subida começou e andou duas fatias", await esperarFatias(3));
  // SAI DA ABA no meio da subida.
  // A ABA AO LADO, procurada na fileira das abas desta janela.
  await page.locator("[data-aba-banco]").locator("xpath=..").getByRole("button", { name: "Atendentes", exact: true }).click();
  const aoSair = chamadas.length;
  await espera(2500);
  const depois = chamadas.length - aoSair;
  // A FATIA QUE JÁ ESTAVA NO AR pode terminar e ser contada; a seguinte não.
  ok("fora da aba, nenhuma fatia nova sai (no máximo a que já estava no ar)", depois <= 1,
     `${depois} fatias pedidas depois de sair`);

  // VOLTA, e aperta de novo: a aba nova não sabe do laço velho.
  await irParaAsNotas(page);
  maisNoAr = 0;
  const antes = chamadas.length;
  await page.locator("[data-vantoro-subir]").click();
  const fim = await page.waitForSelector("[data-vantoro-fim]", { timeout: 20000 }).then(() => true).catch(() => false);
  ok("a subida de novo chega ao fim", fim);
  ok("e nunca houve duas fatias no ar ao mesmo tempo", maisNoAr === 1, `${maisNoAr} ao mesmo tempo`);
  const segunda = chamadas.slice(antes).map((c) => c.de);
  ok("e ela pediu cada fatia uma vez só, em ordem", segunda.length === TOTAL / FATIA
     && segunda.every((de, i) => de === i * FATIA), q(segunda));
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. Fechar a janela também para a subida");
{
  chamadas = []; emVoo = 0; maisNoAr = 0;
  const { ctx, page, estouros } = await abrir();
  await irParaAsNotas(page);
  await page.locator("[data-vantoro-subir]").click();
  ok("a subida começou", await esperarFatias(2));
  // O X DESTA JANELA, ao lado do título — e não outro "Fechar" do painel.
  await page.locator('b:has-text("Departamentos e acessos") ~ button[aria-label="Fechar"]').first().click();
  await page.waitForTimeout(300);
  ok("a janela fechou", (await page.locator("[data-aba-notas]").count()) === 0);
  const aoFechar = chamadas.length;
  await espera(2500);
  const depois = chamadas.length - aoFechar;
  ok("fechada, nenhuma fatia nova sai (no máximo a que já estava no ar)", depois <= 1, `${depois} fatias depois de fechar`);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
