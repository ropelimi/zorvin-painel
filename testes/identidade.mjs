// O NOME E A FOTO DE HOJE, NO HISTÓRICO INTEIRO.
//
// O relato: trocar o nome (ou pôr uma foto que não se tinha) só mudava as
// mensagens NOVAS. As antigas continuavam assinadas com o nome velho e sem
// foto, e no grupinho de avatares do topo a mesma pessoa aparecia DUAS vezes.
//
// A montagem está em `bancada.js`: a mesma pessoa (`u1`) escreveu quando se
// chamava "Rodrigo ADMIN" e não tinha foto, e escreveu de novo depois de
// trocar as duas coisas. É a menor montagem que separa "o que está gravado na
// linha" de "quem é a pessoa hoje" — com um nome só, os dois seriam iguais e o
// teste não mediria nada.
//
// E a foto do contato, que abria do tamanho natural no meio da tela preta.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1360, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(PAGINA);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Abre a conversa fixada, onde está a montagem. */
async function abrirAConversa() {
  await page.locator("[data-conversa-nome]").first().click();
  await page.waitForTimeout(2200);
}
await abrirAConversa();

const textoDaConversa = () => page.locator("[data-msg-id]").last().innerText();
const corpo = () => page.locator("body").innerText();

console.log("\nO nome velho não aparece mais");
{
  const t = await corpo();
  ok("a conversa tem a mensagem escrita na época do nome velho",
     /quando eu tinha outro nome/.test(t),
     "sem ela o teste não está olhando a conversa certa");
  ok('"Rodrigo ADMIN" sumiu da conversa', !/Rodrigo ADMIN/.test(t),
     "é o nome de então; a tela tem de mostrar o de hoje");
  ok("e no lugar dele está o nome de hoje", /Rodrigo Sousa/.test(t));
}

console.log("\nA foto entra no que foi escrito antes de ela existir");
{
  // A bolha da mensagem antiga tem de ter a MESMA foto da nova. Conferir pelo
  // atributo `src` do avatar, e não pela presença de um <img> qualquer: a
  // conversa está cheia de imagens, e "tem img" passaria sem provar nada.
  const fotos = await page.evaluate(() => {
    const doTexto = (t) => {
      const bolha = [...document.querySelectorAll("[data-msg-id]")]
        .find((e) => (e.innerText || "").includes(t));
      if (!bolha) return "sem a bolha";
      const img = bolha.querySelector("img[src]");
      return img ? img.getAttribute("src") : null;
    };
    return {
      antiga: doTexto("quando eu tinha outro nome"),
      nova: doTexto("depois de trocar o nome"),
    };
  });
  ok("a mensagem antiga ganhou a foto de hoje",
     !!fotos.antiga && fotos.antiga === fotos.nova,
     `antiga: ${fotos.antiga} · nova: ${fotos.nova}`);
}

console.log("\nA conta que foi apagada");
{
  // A mensagem escrita pela conta de administrador, que depois foi apagada.
  // O id dela não existe mais em `usuarios` e o nome gravado é o antigo — as
  // duas pistas normais falham. Quem responde é o de-para.
  const t = await corpo();
  ok("a conversa tem a mensagem da conta apagada",
     /pela conta de administrador/.test(t),
     "sem ela o teste não está olhando a conversa certa");
  const nome = await page.evaluate(() => {
    const bolha = [...document.querySelectorAll("[data-msg-id]")]
      .find((e) => (e.innerText || "").includes("pela conta de administrador"));
    return bolha ? bolha.innerText.split("\n")[0] : null;
  });
  ok("ela é assinada com a pessoa de hoje, e não com a conta apagada",
     /Rodrigo Sousa/.test(nome || ""), `assinada: "${nome}"`);
}

console.log("\nO histórico sem id, casado pelo nome");
{
  // Mensagem anterior à coluna `enviado_por_id` existir: não há id, mas o nome
  // gravado é o que a pessoa ainda tem. É o único caso em que dá para devolver
  // a foto a uma mensagem antiga.
  const foto = await page.evaluate(() => {
    const bolha = [...document.querySelectorAll("[data-msg-id]")]
      .find((e) => (e.innerText || "").includes("histórico antigo, sem id"));
    const img = bolha && bolha.querySelector("img[src]");
    return img ? img.getAttribute("src") : null;
  });
  // Compara com a foto que está NO CADASTRO da Jenifer, e não com um pedaço
  // de texto: a foto da bancada é uma imagem `data:`, e procurar "jenifer"
  // dentro dela nunca acharia nada — a falha falaria do teste, não da tela.
  const dela = await page.evaluate(() =>
    (globalThis.__TABELAS.usuarios.find((u) => u.id === "u-jenifer") || {}).foto_url);
  ok("mensagem sem id ganha a foto pelo nome", !!foto && foto === dela,
     `veio: ${String(foto).slice(0, 40)}…`);
}

console.log("\nA foto do contato abre grande");
{
  await page.locator("[title='Ver a foto']").click();
  await page.waitForTimeout(700);
  const medida = await page.evaluate(() => {
    const img = document.querySelector('img[data-retrato="1"]');
    if (!img) return null;
    const r = img.getBoundingClientRect();
    return { largura: Math.round(r.width), altura: Math.round(r.height),
             janela: window.innerHeight, natural: img.naturalWidth };
  });
  ok("a foto ampliada aparece", !!medida, "o retrato não abriu");
  ok("e ocupa um pedaço de verdade da tela",
     !!medida && medida.largura >= 300,
     `abriu com ${medida && medida.largura}px de largura`);
  // O SEGUNDO RELATO: "abre grande, porém embaçada". Nenhuma conta de estilo
  // inventa pixel que a imagem não tem — esticar uma miniatura até 520 dá
  // exatamente isso. O teto tem de acompanhar o tamanho de verdade da foto.
  ok("sem esticar além do dobro do que a foto tem",
     !!medida && medida.largura <= medida.natural * 2 + 1,
     `${medida && medida.largura}px a partir de uma foto de ${medida && medida.natural}px`);
  ok("sem estourar a altura da janela",
     !!medida && medida.altura <= medida.janela,
     `${medida && medida.altura}px numa janela de ${medida && medida.janela}px`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("\nA foto da conversa continua como estava");
{
  // A regra nova vale só para o retrato. Uma foto de conversa chega grande e o
  // que importa nela é o teto, não o piso — trocar as duas pela mesma regra
  // ENCOLHERIA as fotos boas.
  const abriu = await page.evaluate(() => {
    const b = document.querySelector('[aria-label="Abrir a imagem em tela cheia"]');
    if (!b) return false;
    b.click();
    return true;
  });
  if (!abriu) { ok("a conversa tem imagem para abrir", false, "sem imagem na bancada"); }
  else {
    await page.waitForTimeout(700);
    const eRetrato = await page.locator('img[data-retrato="1"]').count();
    ok("a foto da conversa não vira retrato", eRetrato === 0,
       "ela usaria a largura fixa do retrato e ficaria menor do que era");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }
}

console.log("\nTrocar o nome agora vale para trás");
{
  // O relato inteiro em um gesto: renomeia no cadastro e recarrega. Toda a
  // conversa tem de passar a dizer o nome novo — inclusive o que foi escrito
  // antes da troca.
  // `addInitScript` e não `evaluate`: a bancada é montada de novo a cada
  // carregamento, então mexer no objeto depois some no F5 — e é o F5 que prova
  // que a troca valeu para o histórico inteiro, e não só para a tela aberta.
  await page.addInitScript(() => { globalThis.__NOME_NOVO_U1 = "RODRIGO DE OUTRO JEITO"; });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrirAConversa();
  const t = await corpo();
  ok("a conversa inteira passa a dizer o nome novo",
     /RODRIGO DE OUTRO JEITO/.test(t));
  ok("e nenhuma bolha ficou com o nome anterior",
     !/Rodrigo Sousa/.test(t) && !/Rodrigo ADMIN/.test(t),
     "sobrou nome antigo em alguma bolha");
}

console.log("\nA mensagem que saiu pelo celular");
{
  // Ela é assinada com o rótulo "WhatsApp", porque o WhatsApp não diz qual
  // atendente escreveu. Escrito assim, em negrito colorido como os nomes de
  // verdade, lia-se como uma pessoa chamada WhatsApp.
  const linha = await page.evaluate(() => {
    const b = [...document.querySelectorAll("[data-msg-id]")]
      .find((e) => (e.innerText || "").includes("direto do aplicativo"));
    return b ? b.innerText.split("\n")[0] : null;
  });
  ok("a conversa tem a mensagem que saiu pelo celular", linha !== null,
     "sem ela o teste não está olhando a conversa certa");
  ok('ela não é mais assinada "WhatsApp"', !/WhatsApp/.test(linha || ""),
     `assinada: "${linha}"`);
  ok("e diz, em português, de onde veio", /celular/i.test(linha || ""),
     `assinada: "${linha}"`);

  const rotulo = await page.evaluate(() => {
    const b = [...document.querySelectorAll("[data-msg-id]")]
      .find((e) => (e.innerText || "").includes("histórico importado"));
    return b ? b.innerText.split("\n")[0] : null;
  });
  ok("o rótulo do importador continua aparecendo na bolha",
     /Cadastro/.test(rotulo || ""),
     `a mensagem existiu e alguém a escreveu; sumir com a assinatura seria pior — veio: "${rotulo}"`);
}

console.log("\nVer quem participou da conversa");
{
  // O grupinho mostra quatro rostos e um "+N". O "+N" DIZ que há mais gente e
  // não dava jeito nenhum de ver quem — era um beco. Havia um `title`, mas
  // title demora a aparecer, some ao mexer o rato, não existe no toque e corta
  // quando cresce: para saber quem atendeu um cliente, não serve.
  await page.locator("[data-quem-participou]").click();
  await page.waitForTimeout(500);
  const lista = await page.locator("[data-participante]").evaluateAll(
    (ns) => ns.map((n) => ({ nome: n.getAttribute("data-participante"),
                             linha: (n.innerText || "").replace(/\s+/g, " ") })));
  ok("a lista abre", lista.length > 0, "clicar no grupinho não abriu nada");
  ok("e traz todo mundo, e não só os quatro que cabem",
     lista.length >= 2, `veio ${lista.length}`);
  ok("cada um com quantas mensagens escreveu",
     lista.every((l) => /\d+ (mensagem|mensagens)/.test(l.linha)),
     `linhas: ${JSON.stringify(lista.map((l) => l.linha).slice(0, 3))}`);

  // A MESMA PESSOA UMA VEZ SÓ. A lista tinha o NOME de chave, então quem
  // trocou de nome entrava duas vezes — e a conta apagada, uma terceira.
  // O nome vem do CADASTRO, e não escrito à mão: a seção anterior renomeia a
  // pessoa, então cravar "Rodrigo" aqui reprovaria por causa do teste.
  const euHoje = await page.evaluate(() =>
    (globalThis.__TABELAS.usuarios.find((u) => u.id === "u1") || {}).nome);
  const vezes = lista.filter((l) => l.nome === euHoje).length;
  ok("a mesma pessoa aparece UMA vez, e não uma por nome que já teve",
     vezes === 1,
     `"${euHoje}" apareceu ${vezes}× em ${JSON.stringify(lista.map((l) => l.nome))}`
     + " — ela escreveu com o nome velho, com o novo e pela conta apagada");
  ok("e ninguém aparece com o nome antigo",
     !lista.some((l) => /Rodrigo ADMIN/.test(l.nome || "")),
     `veio: ${JSON.stringify(lista.map((l) => l.nome))}`);
  // NEM APARELHO NEM RÓTULO. A pergunta do grupinho é "com quem eu falo sobre
  // este cliente", e nenhum dos dois tem a quem perguntar.
  ok("o celular e o rótulo do importador ficam de fora",
     !lista.some((l) => /celular|WhatsApp|Cadastro/i.test(l.nome || "")),
     `veio: ${JSON.stringify(lista.map((l) => l.nome))}`);

  // Fechar tem de funcionar, senão a lista fica por cima da conversa.
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  ok("Escape fecha", await page.locator("[data-participante]").count() === 0);
}

console.log("\nSem a vista no banco");
{
  // O código sobe antes do script — sempre sobe. Nesse intervalo a tela tem de
  // continuar desenhando o que está gravado na mensagem, e não ficar sem
  // assinatura nenhuma.
  await page.addInitScript(() => { globalThis.__SEM_EQUIPE = true; });
  await page.reload();
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1500);
  await abrirAConversa();
  const t = await corpo();
  ok("as mensagens continuam assinadas", /Rodrigo/.test(t),
     "sem a vista, o nome gravado na mensagem é o que há");
  ok("e a conversa não quebra", erros.length === 0,
     erros.slice(0, 2).join(" · "));
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
