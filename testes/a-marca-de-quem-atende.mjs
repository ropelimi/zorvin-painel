// A MARCA DE QUEM ATENDE É DE QUEM ESTÁ LÁ (auditoria de 28/10)
//
// "Fulana também está nesta conversa" sai de duas colunas da conversa:
// `atendendo_por` (quem) e `atendendo_em` (quando). Abrir a conversa grava as
// duas — quem abriu por último fica com a marca —, sair limpa as duas se a
// marca ainda for minha, e um PULSO de minuto em minuto mantém a marca viva
// enquanto a conversa fica aberta.
//
// O pulso gravava SÓ a hora. Então ele renovava a marca de quem estivesse
// nela, fosse quem fosse:
//
//   - A e B na mesma conversa; B sai, e a limpeza dele zera a marca. A
//     continua lá, o pulso dele só escreve a hora — e os colegas param de ver
//     A atendendo;
//   - B fecha a aba no X, sem limpar. O pulso de A renova a hora do NOME DE B,
//     minuto a minuto, sem fim: B "continua" na conversa para sempre.
//
// O conserto: o pulso grava QUEM atende junto com a hora — renovando a minha
// marca, tomando a vazia ou a vencida (os mesmos 3 minutos que o aviso usa
// para dar alguém por ausente), e sem tocar na marca VIVA de outra pessoa.
//
// O relógio da página é de mentira (`page.clock`): o pulso é de 60 segundos, e
// esperar três minutos de verdade por cena seria uma prova que ninguém roda.
//
// O QUE ESTA PROVA GUARDA:
//   1. a marca zerada pela saída de outra pessoa volta a ser minha no pulso
//      seguinte;
//   2. a marca VENCIDA de quem fechou a aba não ganha hora nova — passa a ser
//      minha;
//   3. a marca VIVA de outra pessoa fica com ela; e quando ela sai, o pulso
//      seguinte toma — o recurso não se desligou por ter achado zero linhas.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const estouros = [];
page.on("pageerror", (e) => estouros.push(e.message));
// O RELÓGIO DE MENTIRA, instalado antes de a página nascer: o tempo corre
// normal, e `fastForward` pula um minuto quando a cena pede.
await page.clock.install();
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1200);

await page.locator("[data-conversa-nome]").first().click();
await page.waitForSelector("[data-topo-conversa]");
await page.waitForTimeout(1500);
const conversa = await page.evaluate(() =>
  document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));
const EU = await page.evaluate(() => {
  const foto = document.querySelector('[title$="— configurações"]');
  return foto ? foto.getAttribute("title").replace(" — configurações", "") : null;
});
ok("descobri com que nome estou entrando", !!EU, String(EU));

/** A marca da conversa no banco de mentira. */
const marca = () => page.evaluate((c) => {
  const l = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(c));
  return l ? { por: l.atendendo_por ?? null, em: l.atendendo_em ?? null } : null;
}, conversa);
/** O que OUTRA pessoa faria no banco: entrar (com a idade da marca, em
 *  segundos) ou sair limpando. A hora é a da página, que é a do relógio. */
const outraPessoa = (por, haSegundos = 0) => page.evaluate(([c, quem, atras]) => {
  const l = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(c));
  l.atendendo_por = quem;
  l.atendendo_em = quem ? new Date(Date.now() - atras * 1000).toISOString() : null;
}, [conversa, por, haSegundos]);
/** Um minuto depois: o pulso dispara, e as idas ao banco dele terminam. */
async function umMinutoDepois() {
  await page.clock.fastForward(61000);
  await page.waitForTimeout(3500);
}

const aoAbrir = await marca();
ok("abrir a conversa deixa a minha marca", aoAbrir?.por === EU, JSON.stringify(aoAbrir));

console.log("\nOutra pessoa entra e sai limpando; eu continuo na conversa");
{
  await outraPessoa("Isabela Guedes", 0);
  await outraPessoa(null);
  await umMinutoDepois();
  const m = await marca();
  ok("no pulso seguinte a marca volta a ser minha", m?.por === EU, JSON.stringify(m));
}

console.log("\nOutra pessoa fechou a aba sem limpar, há 4 minutos");
{
  await outraPessoa("Isabela Guedes", 240);
  const antes = await marca();
  await umMinutoDepois();
  const m = await marca();
  ok("o nome dela NÃO ganha hora nova", !(m?.por === "Isabela Guedes" && m?.em !== antes?.em), JSON.stringify(m));
  ok("a marca vencida passa a ser minha", m?.por === EU, JSON.stringify(m));
}

console.log("\nOutra pessoa está lá de verdade, com a marca viva");
{
  await outraPessoa("Isabela Guedes", 0);
  const antes = await marca();
  await umMinutoDepois();
  const m = await marca();
  ok("o meu pulso não toma a marca viva dela", m?.por === "Isabela Guedes" && m?.em === antes?.em, JSON.stringify(m));
  // ZERO LINHAS ALI ERA O CASO LEGÍTIMO, e não a recusa calada: o recurso tem
  // de continuar ligado, e o pulso seguinte toma a marca quando ela sai.
  await outraPessoa(null);
  await umMinutoDepois();
  const depois = await marca();
  ok("quando ela sai, o pulso seguinte toma a marca", depois?.por === EU, JSON.stringify(depois));
}

ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
