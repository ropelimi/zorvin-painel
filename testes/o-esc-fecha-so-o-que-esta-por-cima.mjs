// O ESC FECHA SÓ O QUE ESTÁ POR CIMA (auditoria de 28/10)
//
// O Esc do painel é uma escada: fecha o que está aberto, um degrau por vez, e
// só no último fecha a conversa. Ela ouve a JANELA — então quem trata o Esc
// antes dela e não o segura deixa a tecla descer até o fim. Dois casos:
//
//   8. O MENU DO "/" (as mensagens rápidas). A caixa tratava o Esc —
//      esvaziava o "/" — e deixava a tecla seguir: a escada não conhece esse
//      menu e descia até fechar a conversa;
//   9. O MENU DE DEPARTAMENTOS. Ele está NA escada, mas não nas dependências
//      do efeito que a registra: o ouvinte enxergava o valor de antes de o
//      menu abrir ("fechado") e descia até fechar a conversa, deixando o menu
//      aberto em cima da lista.
//
// O QUE ESTA PROVA GUARDA: nos dois casos, o Esc fecha o menu e a conversa
// continua aberta; e o Esc seguinte, sem nada aberto, fecha a conversa como
// sempre (o contraste — senão uma escada que nunca fecha nada passaria).
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const RAPIDAS = [
  { id: "r-esc-1", titulo: "Saudação da prova", texto: "Bom dia! Aqui é do escritório.", criado_em: "2026-10-01T12:00:00Z",
    midia_url: null, midia_tipo: null, midia_mime: null, midia_nome: null },
  { id: "r-esc-2", titulo: "Documentos da prova", texto: "Faltam o RG e o comprovante.", criado_em: "2026-10-01T12:00:00Z",
    midia_url: null, midia_tipo: null, midia_mime: null, midia_nome: null },
];

async function abrirPainel() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // TODAS AS BANDEIRAS EM TODA ABERTURA — `addInitScript` acumula.
  await page.addInitScript((r) => { globalThis.__SEMENTE = { mensagens_rapidas: r }; }, RAPIDAS);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator("[data-conversa-nome]").first().click().catch(() => {});
  await page.waitForTimeout(1000);
  return { ctx, page, estouros };
}
const conversaAberta = async (page) => (await page.locator("[data-topo-conversa]").count()) === 1;

// ==================================================================
console.log("\n8. Esc no menu do “/” fecha o menu, e não a conversa");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("a conversa está aberta", await conversaAberta(page));
  const caixa = page.locator('[data-campo="mensagem"]');
  await caixa.click().catch(() => {});
  await caixa.fill("/");
  await page.waitForTimeout(300);
  ok("o “/” abriu o menu das mensagens rápidas", (await page.locator("[data-rapida-no-menu]").count()) === 2);
  await caixa.press("Escape");
  await page.waitForTimeout(300);
  ok("Esc fechou o menu", (await page.locator("[data-rapida-no-menu]").count()) === 0);
  ok("e a conversa CONTINUA aberta", await conversaAberta(page));
  // O CONTRASTE: sem nada aberto, o Esc fecha a conversa, como sempre.
  await caixa.press("Escape").catch(() => {});
  await page.waitForTimeout(300);
  ok("o Esc seguinte, sem menu, fecha a conversa como sempre", !(await conversaAberta(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n9. Esc com o menu de departamentos aberto fecha o menu, e não a conversa");
{
  const { ctx, page, estouros } = await abrirPainel();
  ok("a conversa está aberta", await conversaAberta(page));
  const botao = page.locator('button[title="Trocar de departamento"]');
  ok("há o seletor de departamento", (await botao.count()) === 1);
  await botao.first().click().catch(() => {});
  await page.waitForTimeout(300);
  ok("o menu de departamentos abriu", (await page.locator('[role="listbox"]').count()) === 1);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("Esc fechou o menu", (await page.locator('[role="listbox"]').count()) === 0);
  ok("e a conversa CONTINUA aberta", await conversaAberta(page));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("o Esc seguinte, sem menu, fecha a conversa como sempre", !(await conversaAberta(page)));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
