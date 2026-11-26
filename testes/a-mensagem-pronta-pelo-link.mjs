// A MENSAGEM PRONTA PELO LINK DO VANTORO (26/11).
//
// Pedido do escritório: *"A Vanda precisa ser amiga do Quazar. Por exemplo,
// se alguém falar para ela enviar uma mensagem no WhatsApp do cliente, ela diz
// que vai pedir para o nosso amigo pato Quazar que é bom de papo melhorar o
// texto e enviar para o cliente, aí abre o Zorvin na conversa com o cliente, e
// ao clicar em qual telefone queremos ter a conversa já abrir com a mensagem
// escrita pronta para enviar ao cliente."*
//
// O link de sempre (`?telefone=…&nome=…&de=…`) ganhou `texto=` e `melhorar=1`.
//
// O QUE ESTA PROVA VIGIA:
//   1. com o `de=` que casa, a conversa abre com o texto NA CAIXA, com o
//      `{nome}` preenchido, e a tela diz que ele veio do Vantoro. NADA é
//      enviado, e sem `melhorar=1` o Quazar não é chamado;
//   2. pela janela "Falar por qual telefone?", o texto espera a escolha e
//      entra na caixa da conversa escolhida. Com `melhorar=1`, o Quazar
//      melhora o texto UMA vez, depois de ele estar na caixa (o pedido leva o
//      texto do link e a conversa certa), o melhorado fica na caixa com a
//      faixa de sempre — e NÃO SAI SOZINHO;
//   3. com `melhorar=1` e a ponte que não melhora, o texto fica como veio,
//      sem erro e sem pedido;
//   4. o texto entra como veio (espaços e quebras de linha), cortado em 2000
//      caracteres sem partir um emoji, também para o contato que ainda não
//      existe;
//   5. sem `texto=`, nada muda: a caixa abre vazia e sem o aviso.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const q = (s) => JSON.stringify(s);

const nav = await abrirNavegador();
const H = (n) => new Date(Date.now() - n * 3600e3).toISOString();
const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
  vantoro_cliente_id: null, foto_url: null });
const conversa = (id, adv, ct, campos) => ({ id, advogado_id: adv, contato_id: ct.id, nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null,
  esperando_desde: null, situacao: "aberto", protocolo: `P-${id}`, ultima_mensagem: "oi",
  contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null }, ...campos });
const msg = (id, conv, origem, criado_em) => ({ id, conversa_id: conv, origem, tipo: "texto", texto: "oi",
  criado_em, id_uazapi: `ID-${id}` });

// Os telefones da bancada: a5 é o SAC, a7 o "Acordos 1" (o que abre na barra).
const TEL = { a7: "5511911112222", a5: "5511969401932" };
const C1 = contato("ct-vanda-1", "5511980077001", "MARIA DA VANDA");
const NOVO = { numero: "5511980077999", nome: "CLIENTE NOVO DA VANDA" };
const semente = {
  contatos: [C1],
  conversas: [
    conversa("cv-vanda-a5", "a5", C1, { ultima_atividade: H(2) }),
    conversa("cv-vanda-a7", "a7", C1, { ultima_atividade: H(3) }),
  ],
  mensagens: [msg("m-vanda-a5", "cv-vanda-a5", "contato", H(2)), msg("m-vanda-a7", "cv-vanda-a7", "advogado", H(3))],
};

const CAMPO = "textarea[data-campo]";
const AVISO_DO_LINK = "A mensagem que veio do Vantoro está na caixa. Confira e envie.";

async function abrir(parametros, { comMelhorar = true } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(8000);
  const estouros = [];
  const pedidos = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // NENHUMA PERGUNTA É ESPERADA: a caixa da conversa que abre está vazia. Uma
  // que aparecesse é aceita e contada.
  const perguntas = [];
  page.on("dialog", (d) => { perguntas.push(d.message()); d.accept().catch(() => {}); });
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const url = new URL(rota.request().url());
    const json = (corpo) => rota.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/copiloto/estado")) {
      return json({ ok: true, ligado: true, modelo: "x", ajustar: true, ...(comMelhorar ? { melhorar: true } : {}) });
    }
    if (url.pathname.endsWith("/copiloto/melhorar")) {
      const corpo = JSON.parse(rota.request().postData() || "{}");
      pedidos.push(corpo);
      return json({ ok: true, sugestao: `MELHORADO: ${corpo.texto}`, igual: false });
    }
    return json({ ok: true });
  });
  // OS AVISOS QUE PASSARAM PELA TELA, e não só o de agora: um aviso seguinte
  // apagaria o que se quer conferir.
  await page.addInitScript((s) => {
    globalThis.__SEMENTE = s;
    globalThis.__AVISOS_VISTOS = [];
    setInterval(() => {
      const t = document.querySelector("[data-aviso]")?.innerText || "";
      if (t && !globalThis.__AVISOS_VISTOS.includes(t)) globalThis.__AVISOS_VISTOS.push(t);
    }, 50);
  }, semente);
  const p = new URLSearchParams(parametros);
  await page.goto(`${ENDERECO}?${p.toString()}`);
  // A FILA E AS MENSAGENS DAS CONVERSAS DESTES CLIENTES, e não as da
  // bancada inteira: a semente se soma às tabelas de sempre, que já têm fila.
  const tela = () => page.evaluate(([campo, numeros]) => {
    const T = globalThis.__TABELAS;
    const contatos = new Set((T.contatos || []).filter((c) => numeros.includes(String(c.numero))).map((c) => String(c.id)));
    const conversas = new Set((T.conversas || []).filter((c) => contatos.has(String(c.contato_id))).map((c) => String(c.id)));
    const deles = (l) => conversas.has(String(l.conversa_id));
    return {
      topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
      caixa: document.querySelector(campo)?.value ?? null,
      modo: document.querySelector(campo)?.getAttribute("data-campo") || null,
      avisos: globalThis.__AVISOS_VISTOS.slice(),
      fila: (T.fila_envio || []).filter(deles).length,
      mensagens: (T.mensagens || []).filter(deles).length,
      pagina: document.body.innerText,
    };
  }, [CAMPO, [C1.numero, NOVO.numero]]);
  // ESPERA A CAIXA TER `trecho` (ou COMEÇAR por ele, com `comeco`).
  const esperarACaixa = (trecho, { comeco = false, prazo = 10000 } = {}) => page.waitForFunction(
    ([campo, t, c]) => {
      const v = document.querySelector(campo)?.value ?? "";
      return c ? v.startsWith(t) : v.includes(t);
    }, [CAMPO, trecho, comeco], { timeout: prazo })
    .then(() => true).catch(() => false);
  return { ctx, page, estouros, pedidos, perguntas, tela, esperarACaixa };
}

// ---- 1. O `de=` que casa: direto, com o texto na caixa ----
console.log("\n1. Com o de= que casa, o texto entra na caixa e nada sai");
{
  // AS VARIÁVEIS SÃO AS DAS RESPOSTAS RÁPIDAS (`variaveis.js`): `{nome}` é o
  // primeiro nome do alto da conversa.
  const TEXTO = "Olá, {nome}! Recebemos o seu comprovante.\nQualquer dúvida, estamos aqui.";
  const ESPERADO = "Olá, Maria! Recebemos o seu comprovante.\nQualquer dúvida, estamos aqui.";
  const { ctx, page, estouros, pedidos, perguntas, tela, esperarACaixa } = await abrir(
    { telefone: C1.numero, nome: C1.nome, de: TEL.a5, texto: TEXTO });
  const chegou = await esperarACaixa("comprovante");
  await page.waitForTimeout(3000);
  const e = await tela();
  ok("a conversa do cliente abre", e.topo.includes(C1.nome), `topo ${q(e.topo.slice(0, 60))}`);
  ok("o texto do link está na caixa", chegou && e.caixa !== null, `caixa ${q(e.caixa)}`);
  // O NOME: `nomeDoContato` dá o primeiro nome, como nas respostas rápidas.
  ok("com o {nome} preenchido, e o resto como veio", e.caixa === ESPERADO, `caixa ${q(e.caixa)}`);
  ok("na caixa de mensagem, e não na de nota", e.modo === "mensagem", String(e.modo));
  ok("a tela diz que a mensagem veio do Vantoro", e.avisos.includes(AVISO_DO_LINK), q(e.avisos));
  ok("nada foi para a fila de envio", e.fila === 0, String(e.fila));
  ok("nenhuma mensagem nova na conversa", e.mensagens === semente.mensagens.length, String(e.mensagens));
  ok("sem melhorar=1, o Quazar não é chamado", pedidos.length === 0, q(pedidos));
  ok("nenhuma pergunta com a caixa vazia", perguntas.length === 0, q(perguntas));
  ok("sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 2. A janela de escolher o telefone, com melhorar=1 ----
console.log("\n2. Pela janela de escolha, o texto espera; com melhorar=1 o Quazar melhora, e nada sai");
{
  const TEXTO = "oi {nome}, precisamos do comprovante de endereço atualizado";
  const ESPERADO = "oi Maria, precisamos do comprovante de endereço atualizado";
  const { ctx, page, estouros, pedidos, tela, esperarACaixa } = await abrir(
    { telefone: C1.numero, nome: C1.nome, texto: TEXTO, melhorar: "1" });
  const janela = await page.waitForSelector("[data-telefones-da-escolha]", { timeout: 10000 }).then(() => true).catch(() => false);
  ok("sem o de=, a janela de escolher o telefone abre", janela);
  await page.waitForTimeout(1500);
  ok("antes da escolha, o Quazar não foi chamado", pedidos.length === 0, q(pedidos));
  const antes = await tela();
  ok("antes da escolha, a mensagem não entrou em caixa nenhuma",
     !antes.avisos.includes(AVISO_DO_LINK) && !String(antes.caixa || "").includes("comprovante"), q({ caixa: antes.caixa, avisos: antes.avisos }));
  await page.locator('[data-telefone-opcao="a7"]').first().click({ timeout: 5000 }).catch(() => {});
  const melhorou = await esperarACaixa("MELHORADO: ", { comeco: true });
  await page.waitForTimeout(3000);
  const e = await tela();
  ok("a conversa abre no telefone escolhido", e.topo.includes(C1.nome), `topo ${q(e.topo.slice(0, 60))}`);
  ok("a tela diz que a mensagem veio do Vantoro", e.avisos.includes(AVISO_DO_LINK), q(e.avisos));
  ok("o Quazar foi chamado uma vez só", pedidos.length === 1, q(pedidos));
  ok("com o texto do link, já preenchido, que estava na caixa",
     pedidos[0] && pedidos[0].texto === ESPERADO, q(pedidos[0]));
  ok("e da conversa escolhida", pedidos[0] && pedidos[0].conversa_id === "cv-vanda-a7", q(pedidos[0]));
  ok("o texto melhorado está na caixa", melhorou && e.caixa === `MELHORADO: ${ESPERADO}`, `caixa ${q(e.caixa)}`);
  ok("com a faixa de sempre do Quazar", e.pagina.includes("o texto melhorado está na caixa"), "sem a faixa");
  ok("e o \"Voltar ao meu texto\"", await page.locator("[data-copiloto-voltar-ao-texto]").count() > 0);
  ok("o texto melhorado NÃO saiu sozinho", e.fila === 0, String(e.fila));
  ok("nenhuma mensagem nova na conversa", e.mensagens === semente.mensagens.length, String(e.mensagens));
  ok("sem erro na tela", estouros.length === 0, estouros.join(" | "));
  // VOLTAR AO MEU TEXTO devolve o que veio do Vantoro.
  await page.locator("[data-copiloto-voltar-ao-texto]").first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const depois = await tela();
  ok("\"Voltar ao meu texto\" devolve a mensagem que veio do Vantoro", depois.caixa === ESPERADO, `caixa ${q(depois.caixa)}`);
  await page.waitForTimeout(1500);
  ok("e o Quazar não é chamado de novo", pedidos.length === 1, q(pedidos));
  await ctx.close();
}

// ---- 3. melhorar=1, e a ponte que não melhora ----
console.log("\n3. Com melhorar=1 e a ponte que não melhora, o texto fica como veio");
{
  const TEXTO = "Bom dia! Pode nos mandar o comprovante?";
  const { ctx, page, estouros, pedidos, tela, esperarACaixa } = await abrir(
    { telefone: C1.numero, nome: C1.nome, de: TEL.a7, texto: TEXTO, melhorar: "1" }, { comMelhorar: false });
  const chegou = await esperarACaixa("comprovante");
  await page.waitForTimeout(3000);
  const e = await tela();
  ok("o texto está na caixa, como veio", chegou && e.caixa === TEXTO, `caixa ${q(e.caixa)}`);
  ok("o Quazar não é chamado", pedidos.length === 0, q(pedidos));
  ok("a faixa do Quazar não aparece", !e.pagina.includes("melhorando o seu texto") && !e.pagina.includes("o texto melhorado está na caixa"));
  ok("nada foi para a fila de envio", e.fila === 0, String(e.fila));
  ok("sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 4. Como veio, cortado em 2000, para o contato novo ----
console.log("\n4. O texto entra como veio, cortado em 2000 caracteres, também para o contato novo");
{
  // 1999 caracteres e um emoji no 2000º: o corte por pedaço do JavaScript
  // partiria o emoji (ele ocupa dois). Depois, sobra que precisa sair.
  const COMECO = "  Bom dia!\n\n  ";
  const recheio = "a".repeat(1999 - COMECO.length);
  const TEXTO = `${COMECO}${recheio}😀SOBRA QUE NÃO ENTRA`;
  const ESPERADO = `${COMECO}${recheio}😀`;
  const { ctx, page, estouros, tela, esperarACaixa } = await abrir(
    { telefone: NOVO.numero, nome: NOVO.nome, de: TEL.a7, texto: TEXTO });
  const chegou = await esperarACaixa("Bom dia!");
  await page.waitForTimeout(2500);
  const e = await tela();
  const { criado, conversasDoNovo } = await page.evaluate((n) => {
    const ct = (globalThis.__TABELAS.contatos || []).find((c) => String(c.numero) === n);
    return { criado: Boolean(ct),
             conversasDoNovo: ct ? (globalThis.__TABELAS.conversas || []).filter((c) => String(c.contato_id) === String(ct.id)).length : 0 };
  }, NOVO.numero);
  // A CONVERSA NOVA, E NÃO O NOME NO ALTO: na bancada, a conversa de um
  // contato que acabou de nascer chega sem o contato junto (com ou sem o
  // `texto=`), e o alto diz "sem número". É da bancada, e não do link.
  ok("o contato novo nasce, com a conversa, e ela abre", criado && conversasDoNovo === 1 && e.topo !== "",
     `criado ${criado}, conversas ${conversasDoNovo}, topo ${q(e.topo.slice(0, 60))}`);
  ok("o texto está na caixa", chegou, `caixa ${q(String(e.caixa).slice(0, 40))}`);
  ok("com os espaços e as quebras de linha do começo", String(e.caixa).startsWith(COMECO), q(String(e.caixa).slice(0, 20)));
  ok("cortado em 2000 caracteres", Array.from(String(e.caixa)).length === 2000, String(Array.from(String(e.caixa)).length));
  ok("sem partir o emoji do fim, e sem a sobra", e.caixa === ESPERADO, q(String(e.caixa).slice(-10)));
  ok("nada foi para a fila de envio", e.fila === 0, String(e.fila));
  ok("sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 5. Sem texto=, nada muda ----
console.log("\n5. Sem texto=, nada muda");
{
  const { ctx, page, estouros, pedidos, tela } = await abrir(
    { telefone: C1.numero, nome: C1.nome, de: TEL.a5, melhorar: "1" });
  await page.waitForSelector("[data-topo-conversa]", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(3000);
  const e = await tela();
  ok("a conversa abre, como sempre", e.topo.includes(C1.nome), `topo ${q(e.topo.slice(0, 60))}`);
  ok("a caixa abre vazia", e.caixa === "", `caixa ${q(e.caixa)}`);
  ok("sem o aviso do Vantoro", !e.avisos.includes(AVISO_DO_LINK), q(e.avisos));
  ok("e o Quazar não é chamado", pedidos.length === 0, q(pedidos));
  ok("sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
