// COPIAR LEVA SÓ O TEXTO (08/10) — relato do Rodrigo: "quando eu copio uma
// mensagem do Zorvin e colo em um documento do Word, a formatação fica com o
// fundo verde".
//
// O botão "Copiar" do menu da mensagem já copiava texto puro. O defeito era o
// outro caminho, o de todo dia: selecionar com o mouse e apertar Ctrl+C. Aí o
// navegador manda o texto E um HTML com as cores da tela, e o Word cola o HTML
// — a bolha verde vai junto.
//
// O QUE ESTA PROVA GUARDA, com Ctrl+C DE VERDADE e lendo a área de
// transferência do navegador (e não um evento fingido, que provaria o
// ouvinte e não o que o Word recebe):
//
//   1. a mensagem copiada chega como TEXTO, e nada de HTML;
//   2. o texto é o da mensagem, com as quebras de linha;
//   3. duas bolhas selecionadas juntas chegam em duas linhas, e não coladas;
//   4. vale para a tela inteira, e não só para as bolhas (o nome no alto da
//      conversa);
//   5. copiar de dentro da caixa de escrever continua funcionando.
//
// E O NOME QUE NÃO VIRA NOME DE ARQUIVO (13/10) — relato do Rodrigo: copiar o
// nome do contato e colar como nome de um .pdf dava erro no Windows, por
// "caracteres especiais". Três cliques no nome copiavam "Deus\n\n": a seleção
// que encosta na borda de um bloco leva a quebra de linha dele. As cenas 6 e 7
// usam os GESTOS de verdade (três cliques, arrastar além do fim, varrer até o
// avatar), porque uma seleção montada por código, letra por letra, nunca tem
// quebra no fim — e foi assim que a cena 3 passou a vida inteira sem ver o
// defeito.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const CAMPO = 'textarea[placeholder*="Digite uma mensagem"]';
const RECEBIDA = "Recebi, obrigada!";
const ENVIADA = "Seu acordo foi registrado.\nO boleto chega amanhã.";

/** O telefone que o painel ABRE — descoberto, e não escolhido a dedo. */
async function telefoneQueAbre() {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  const id = await page.evaluate(() => {
    const cid = document.querySelector("[data-conversa-id]")?.getAttribute("data-conversa-id");
    const c = (globalThis.__TABELAS.conversas || []).find((x) => String(x.id) === String(cid));
    return c ? c.advogado_id : null;
  });
  await ctx.close();
  return id;
}
const ADV = await telefoneQueAbre();
ok("aprendi qual telefone o painel abre", Boolean(ADV));
if (!ADV) { await nav.close(); process.exit(1); }

const agora = Date.now();
const CONTATO = { id: "ct-copia", numero: "5511948230201", nome: "Cliente da Cópia", vantoro_nome: null,
                  nome_zorvin: null, vantoro_cliente_id: null, foto_url: null };
const SEMENTE = {
  contatos: [CONTATO],
  conversas: [{
    id: "cv-copia", advogado_id: ADV, contato_id: CONTATO.id,
    nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
    ultima_atividade: new Date(agora - 60000).toISOString(), esperando_desde: null, tratada_em: null,
    ultima_mensagem: "…", frente: null, digitando_ate: null, vantoro_nome: null, contato: CONTATO,
  }],
  mensagens: [
    { id: "m-cp-1", conversa_id: "cv-copia", origem: "contato", tipo: "texto", texto: RECEBIDA,
      criado_em: new Date(agora - 180000).toISOString() },
    { id: "m-cp-2", conversa_id: "cv-copia", origem: "advogado", tipo: "texto", texto: ENVIADA,
      status: "enviada", criado_em: new Date(agora - 120000).toISOString() },
  ],
};

const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(ENDERECO).origin });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));
await page.addInitScript((semente) => { globalThis.__SEMENTE = semente; }, SEMENTE);
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** Seleciona, na tela, do começo do texto `de` ao fim do texto `ate` — como
 *  quem arrasta o mouse. Devolve se achou os dois. */
const selecionar = (de, ate) => page.evaluate(({ de, ate }) => {
  const acha = (t) => {
    const ida = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = ida.nextNode(); n; n = ida.nextNode()) {
      const i = n.data.indexOf(t);
      if (i >= 0) return { n, i };
    }
    return null;
  };
  const a = acha(de), b = acha(ate);
  if (!a || !b) return false;
  const r = document.createRange();
  r.setStart(a.n, a.i);
  r.setEnd(b.n, b.i + ate.length);
  const s = getSelection();
  s.removeAllRanges();
  s.addRange(r);
  return true;
}, { de, ate });

/** Limpa a área de transferência, aperta Ctrl+C e lê o que ficou lá: os
 *  tipos (é o "text/html" que leva o fundo verde para o Word) e o texto. */
async function copiarELer() {
  await page.evaluate(() => navigator.clipboard.writeText("(nada copiado)"));
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(300);
  return page.evaluate(async () => {
    const itens = await navigator.clipboard.read();
    const tipos = itens.flatMap((i) => i.types);
    let html = "";
    for (const i of itens) {
      if (i.types.includes("text/html")) html = await (await i.getType("text/html")).text();
    }
    return { tipos, html, texto: await navigator.clipboard.readText() };
  });
}

const linha = page.locator('[data-conversa-id="cv-copia"]');
ok("a conversa plantada está na lista", (await linha.count()) > 0);
if (await linha.count()) { await linha.first().click(); await page.waitForTimeout(1000); }

console.log("\n1. Uma mensagem enviada, a da bolha verde");
{
  ok("selecionei o texto da bolha verde", await selecionar("Seu acordo", "chega amanhã."));
  const c = await copiarELer();
  const fundo = (c.html.match(/background(-color)?:[^;"]*/) || [""])[0];
  ok("chega à área de transferência como texto, sem HTML", !c.tipos.includes("text/html"),
     `tipos ${q(c.tipos)}${fundo ? " — e o HTML levava o fundo: " + fundo : ""}`);
  ok("e o texto é o da mensagem, com a quebra de linha", c.texto === ENVIADA, q(c.texto));
}

console.log("\n2. Duas bolhas de uma vez");
{
  ok("selecionei das duas bolhas", await selecionar("Recebi,", "registrado."));
  const c = await copiarELer();
  ok("sem HTML também", !c.tipos.includes("text/html"), q(c.tipos));
  ok("as duas mensagens chegam, cada uma na sua linha",
     /Recebi, obrigada!/.test(c.texto) && /\n[\s\S]*Seu acordo foi registrado\./.test(c.texto)
     && !/obrigada!Seu/.test(c.texto), q(c.texto));
}

console.log("\n3. Fora das bolhas: o nome no alto da conversa");
{
  ok("selecionei o nome do alto", await selecionar("Cliente da Cópia", "Cliente da Cópia"));
  const c = await copiarELer();
  ok("sem HTML fora das bolhas também", !c.tipos.includes("text/html"), q(c.tipos));
  // SEM `.trim()` NA COMPARAÇÃO: ele apagava as pontas antes de comparar, e
  // eram justamente elas o defeito de 13/10.
  ok("e o texto é o nome", c.texto === "Cliente da Cópia", q(c.texto));
}

console.log("\n4. A caixa de escrever continua copiando");
{
  const caixa = page.locator(CAMPO);
  ok("achei a caixa de escrever", (await caixa.count()) === 1);
  if (await caixa.count()) {
    await caixa.fill("texto escrito na caixa");
    await caixa.evaluate((el) => { el.focus(); el.setSelectionRange(0, 5); });
  }
  const c = await copiarELer();
  ok("Ctrl+C na caixa copia o que foi selecionado nela", c.texto === "texto", q(c.texto));
  // NA CAIXA, A CÓPIA É LETRA POR LETRA: a quebra que a pessoa marcou no fim
  // vai junto. Tirar as pontas é para a seleção que atravessa bloco, na tela.
  if (await caixa.count()) {
    await caixa.fill("linha um\n");
    await caixa.evaluate((el) => { el.focus(); el.setSelectionRange(0, el.value.length); });
  }
  const comQuebra = await copiarELer();
  ok("e a quebra de linha marcada no fim, dentro da caixa, vai junto", comQuebra.texto === "linha um\n",
     q(comQuebra.texto));
  if (await caixa.count()) await caixa.fill("");
}

console.log("\n5. Ctrl+C sem nada selecionado");
{
  // O QUE ESTAVA COPIADO NÃO PODE SUMIR. Um Ctrl+C sem querer, sem nada
  // selecionado, não fazia nada; trocar a cópia por texto não pode virar
  // "apaga a área de transferência".
  await page.evaluate(() => { getSelection().removeAllRanges(); document.activeElement?.blur?.(); });
  await page.evaluate(() => navigator.clipboard.writeText("o que estava copiado antes"));
  await page.keyboard.press("Control+C");
  await page.waitForTimeout(300);
  const depois = await page.evaluate(() => navigator.clipboard.readText());
  ok("não apaga o que estava copiado", depois === "o que estava copiado antes", q(depois));
}

/** O que o Windows recusa num nome de arquivo: \ / : * ? " < > | e os
 *  caracteres de controle, entre eles a quebra de linha e a tabulação. */
const proibidosNoWindows = (t) => [...t].filter((ch) => /[\\/:*?"<>|]/.test(ch) || ch.charCodeAt(0) < 32);

/** Copia com um GESTO de verdade e devolve o texto. */
async function copiarComGesto(gesto) {
  await page.evaluate(() => { getSelection().removeAllRanges(); document.activeElement?.blur?.(); });
  await gesto();
  return (await copiarELer()).texto;
}
const arrastar = async (caixa, alemDoFim) => {
  await page.mouse.move(caixa.x + 1, caixa.y + caixa.height / 2);
  await page.mouse.down();
  await page.mouse.move(caixa.x + caixa.width + alemDoFim, caixa.y + caixa.height / 2, { steps: 8 });
  await page.mouse.up();
};

console.log("\n6. O nome copiado vira nome de arquivo no Windows");
{
  const alto = page.locator("[data-nome-do-contato]").first();
  ok("achei o nome no alto da conversa", (await alto.count()) === 1);
  if (await alto.count()) {
    const tres = await copiarComGesto(() => alto.click({ clickCount: 3 }));
    ok("três cliques no nome do alto copiam o nome, e só ele", tres === "Cliente da Cópia", q(tres));
    ok("sem nada que o Windows recuse num nome de arquivo", proibidosNoWindows(tres).length === 0,
       q(proibidosNoWindows(tres)));
    const caixaDoNome = await alto.boundingBox();
    const alem = await copiarComGesto(() => arrastar(caixaDoNome, 60));
    ok("arrastar passando do fim do nome também copia só o nome", alem === "Cliente da Cópia", q(alem));
    // VARRENDO DO FIM DO NOME PARA A ESQUERDA, passando do começo até o
    // avatar: as iniciais ("CC") eram texto, e iam junto, com uma quebra de
    // linha na frente do nome — "CC\nCliente da Cópia".
    const ateOAvatar = await copiarComGesto(async () => {
      await page.mouse.move(caixaDoNome.x + caixaDoNome.width - 1, caixaDoNome.y + caixaDoNome.height / 2);
      await page.mouse.down();
      await page.mouse.move(caixaDoNome.x - 50, caixaDoNome.y + caixaDoNome.height / 2, { steps: 8 });
      await page.mouse.up();
    });
    ok("varrer do fim do nome até o avatar copia só o nome, sem as iniciais", ateOAvatar === "Cliente da Cópia",
       q(ateOAvatar));
  }
  const naLista = page.locator('[data-conversa-id="cv-copia"]').getByText("Cliente da Cópia", { exact: true }).first();
  ok("achei o nome na linha da lista", (await naLista.count()) === 1);
  if (await naLista.count()) {
    const daLista = await copiarComGesto(() => naLista.click({ clickCount: 3 }));
    ok("três cliques no nome da lista copiam só o nome", daLista === "Cliente da Cópia", q(daLista));
  }
  // SÓ A QUEBRA ENTRE DOIS BLOCOS selecionada: tirar o fim não deixa nada, e
  // nada no lugar do que estava copiado seria APAGAR sem querer (a régua da
  // cena 5). Vai o que estava selecionado.
  if (await alto.count()) {
    let selecionado = "";
    const soQuebra = await copiarComGesto(async () => {
      selecionado = await page.evaluate(() => {
        const nome = document.querySelector("[data-nome-do-contato]");
        const ida = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let a = null, b = null;
        for (let n = ida.nextNode(); n; n = ida.nextNode()) {
          if (!a && nome.contains(n)) { a = n; continue; }
          if (a && n.data.trim()) { b = n; break; }
        }
        if (!a || !b) return "";
        const r = document.createRange();
        r.setStart(a, a.length);
        r.setEnd(b, 0);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return String(getSelection());
      });
    });
    ok("(a seleção da cena é só quebra de linha, como diz o nome dela)", /^\s+$/.test(selecionado), q(selecionado));
    ok("selecionar só a quebra entre dois blocos não esvazia a área de transferência", soQuebra === selecionado,
       `${q(soQuebra)} (selecionado: ${q(selecionado)})`);
  }
  // O CURSOR NA CAIXA DE ESCREVER, E O NOME SELECIONADO NA TELA. Quem decide
  // se a cópia é "de campo" é onde está a SELEÇÃO, e não o foco: ao abrir a
  // conversa a caixa fica com o cursor piscando, e a seleção feita na tela não
  // é dela. A seleção daqui é a dos três cliques, escrita à mão: do começo do
  // nome até o começo do bloco seguinte.
  const caixaDeEscrever = page.locator(CAMPO);
  // CONFERIDA ANTES DO `if`: sem a caixa na tela, a cena inteira passaria sem
  // medir nada (o vigia `provas-que-reprovam` pegou).
  ok("(a caixa de escrever está na tela para a cena do cursor)", (await caixaDeEscrever.count()) === 1);
  if ((await caixaDeEscrever.count()) && (await alto.count())) {
    let comoFicou = {};
    const comFoco = await copiarComGesto(async () => {
      await caixaDeEscrever.focus();
      comoFicou = await page.evaluate(() => {
        const nome = document.querySelector("[data-nome-do-contato]");
        const ida = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let a = null, b = null;
        for (let n = ida.nextNode(); n; n = ida.nextNode()) {
          if (!a && nome.contains(n)) { a = n; continue; }
          if (a && n.data.trim()) { b = n; break; }
        }
        if (!a || !b) return {};
        const r = document.createRange();
        r.setStart(a, 0);
        r.setEnd(b, 0);
        getSelection().removeAllRanges();
        getSelection().addRange(r);
        return { foco: document.activeElement?.tagName, selecionado: String(getSelection()) };
      });
    });
    ok("(a cena tem o cursor na caixa e o nome com as quebras selecionado)",
       comoFicou.foco === "TEXTAREA" && /^Cliente da Cópia\n+$/.test(comoFicou.selecionado || ""), q(comoFicou));
    ok("com o cursor na caixa de escrever, o nome selecionado na tela sai sem as quebras do fim",
       comFoco === "Cliente da Cópia", q(comFoco));
  }
  // AS QUEBRAS DO MEIO FICAM: arrastar do nome até a linha do número é pedir
  // as duas coisas, e elas chegam em duas linhas.
  if (await alto.count()) {
    const caixaDoNome = await alto.boundingBox();
    const duas = await copiarComGesto(async () => {
      await page.mouse.move(caixaDoNome.x + 1, caixaDoNome.y + caixaDoNome.height / 2);
      await page.mouse.down();
      await page.mouse.move(caixaDoNome.x + 40, caixaDoNome.y + caixaDoNome.height + 12, { steps: 8 });
      await page.mouse.up();
    });
    ok("do nome até o número, as duas linhas chegam separadas (a quebra do meio fica)",
       /^Cliente da Cópia\n+\S/.test(duas), q(duas));
  }
}

console.log("\n7. Uma tabela com a primeira célula vazia");
{
  // MEDIDO: arrastar sobre uma tabela cuja primeira célula está vazia copia
  // "\tb\tc…". A tabulação do começo É a célula vazia — tirá-la colaria a
  // linha deslocada no Excel. Tabela de mentira, posta na página só para isto:
  // é o ouvinte da tela inteira que está sendo provado.
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.id = "prova-tabela";
    d.innerHTML = "<table><tr><td></td><td>b</td><td>c</td></tr><tr><td>d</td><td>e</td><td></td></tr></table>";
    d.style.cssText = "position:fixed;top:300px;left:500px;background:#fff;z-index:9999";
    document.body.appendChild(d);
  });
  const tabela = await page.locator("#prova-tabela table").boundingBox();
  const t = await copiarComGesto(async () => {
    await page.mouse.move(tabela.x + 1, tabela.y + 2);
    await page.mouse.down();
    await page.mouse.move(tabela.x + tabela.width - 1, tabela.y + tabela.height - 2, { steps: 8 });
    await page.mouse.up();
  });
  ok("a tabulação do começo (a célula vazia) continua lá", t.startsWith("\tb\tc"), q(t));
  ok("e a do fim sai: lá ela não separa nada", t === "\tb\tc\nd\te", q(t));
  await page.evaluate(() => document.getElementById("prova-tabela")?.remove());
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
if (erros.length) falhas += 1;

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
