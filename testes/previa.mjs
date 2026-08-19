// A PRÉVIA DA LISTA — a linha embaixo do nome, na lista de conversas.
//
// Relato, com foto e uma seta vermelha: uma conversa em que o contato mandou
// um áudio aparecia como "[anexo]". A conversa logo acima, com um documento,
// aparecia certinha como "📄 Documento".
//
// A diferença entre as duas era só QUANDO a mensagem chegou. O tipo da última
// mensagem de cada conversa era descoberto UMA VEZ, ao abrir o telefone; o que
// chegasse depois trocava o texto da prévia e não trocava o tipo, e a linha
// passava a mostrar o texto cru que o banco guarda.
//
// Esta prova dispara o evento pelo mesmo caminho por onde o Supabase o
// dispararia — o que exigiu a bancada parar de engolir os avisos de tempo
// real. Eram dezenas de tratadores no painel, e nenhum tinha prova nenhuma.
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
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.waitForTimeout(1500);

/** O texto da prévia da primeira conversa da lista. */
async function previaDaPrimeira() {
  return page.evaluate(() => {
    const linha = document.querySelector("[data-conversa-nome]");
    if (!linha) return null;
    const spans = [...linha.querySelectorAll("span")];
    // A prévia é o span de 13px logo abaixo do nome.
    const alvo = spans.find((s) => getComputedStyle(s).fontSize === "13px");
    return alvo ? alvo.innerText.trim() : null;
  });
}

/** Manda um aviso de tempo real, igualzinho ao que o Supabase mandaria. */
async function chegou(tabela, linha, evento = "INSERT") {
  return page.evaluate(([t, l, e]) => globalThis.__EMITIR(e, t, l), [tabela, linha, evento]);
}

console.log("\nA bancada entrega os avisos de tempo real");
{
  // Sem isto, tudo o que vem depois seria teatro: os eventos sairiam e
  // ninguém os receberia, e as conferências passariam por engano.
  const quantos = await page.evaluate(() =>
    typeof globalThis.__EMITIR === "function"
      ? globalThis.__EMITIR("INSERT", "mensagens", { id: "nada", conversa_id: "x", tipo: "texto" })
      : -1);
  ok("o painel está mesmo ouvindo as mensagens", quantos > 0,
     quantos === -1 ? "a bancada não expõe o gatilho" : `${quantos} tratadores ouvindo`);
}

console.log("\nUm áudio que chega AGORA — o do relato");
{
  const conversa = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-nome]");
    return el ? el.getAttribute("data-conversa-id") : null;
  });
  ok("achei a conversa do topo da lista", !!conversa, "sem id não dá para mandar o evento certo");

  if (conversa) {
    // Os DOIS avisos, na ordem em que o banco os manda: a mensagem entra, e o
    // gatilho do banco atualiza a conversa com o texto cru "[anexo]".
    await chegou("mensagens", {
      id: "msg-audio-ao-vivo", conversa_id: conversa, tipo: "audio",
      origem: "contato", texto: null, midia_url: "http://x/a.mp3",
      criado_em: new Date().toISOString(),
    });
    await chegou("conversas", {
      id: conversa, ultima_mensagem: "[anexo]",
      ultima_atividade: new Date().toISOString(), nao_lidas: 1,
    }, "UPDATE");
    await page.waitForTimeout(700);

    const texto = await previaDaPrimeira();
    ok("a prévia NÃO mostra o texto cru do banco", !/\[anexo\]/.test(texto || ""),
       `dizia: "${texto}" — era exatamente isto na foto do relato`);
    ok("e sim que é uma mensagem de voz", /mensagem de voz/i.test(texto || ""),
       `dizia: "${texto}" (sem duração, o rótulo vai por extenso)`);
    ok("com o desenho do microfone, como no WhatsApp", /🎤/.test(texto || ""),
       `dizia: "${texto}"`);
  }
}

console.log("\nE o tempo do áudio, como no WhatsApp");
{
  const conversa = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-nome]");
    return el ? el.getAttribute("data-conversa-id") : null;
  });
  await chegou("mensagens", {
    id: "msg-audio-longo", conversa_id: conversa, tipo: "audio", origem: "contato",
    texto: null, midia_url: "http://x/a.mp3", midia_segundos: 79,
    criado_em: new Date().toISOString(),
  });
  await chegou("conversas", {
    id: conversa, ultima_mensagem: "[anexo]",
    ultima_atividade: new Date().toISOString(), nao_lidas: 1,
  }, "UPDATE");
  await page.waitForTimeout(600);
  const texto = await previaDaPrimeira();
  // NO COMPUTADOR, SÓ O MICROFONE E O TEMPO — é o que o WhatsApp Web mostra,
  // e é o que cabe na coluna estreita ao lado de um nome comprido.
  ok("no computador, o áudio vira só o microfone e o tempo",
     /^🎤\s*1:19$/.test((texto || "").trim()), `dizia: "${texto}"`);

  // E os segundos com zero à esquerda, que é onde este tipo de conta erra.
  await chegou("mensagens", {
    id: "msg-audio-curto", conversa_id: conversa, tipo: "audio", origem: "contato",
    texto: null, midia_url: "http://x/b.mp3", midia_segundos: 7,
    criado_em: new Date().toISOString(),
  });
  await chegou("conversas", {
    id: conversa, ultima_mensagem: "[anexo]",
    ultima_atividade: new Date().toISOString(), nao_lidas: 1,
  }, "UPDATE");
  await page.waitForTimeout(500);
  const curto = await previaDaPrimeira();
  ok("7 segundos viram 0:07, e não 0:7", /0:07/.test(curto || ""), `dizia: "${curto}"`);

  // SEM DURAÇÃO, SEM PARÊNTESES. As mensagens que já estão no banco não têm o
  // tempo, e um "(0:00)" ali seria uma informação errada em vez de uma que
  // falta.
  await chegou("mensagens", {
    id: "msg-audio-antigo", conversa_id: conversa, tipo: "audio", origem: "contato",
    texto: null, midia_url: "http://x/c.mp3", midia_segundos: null,
    criado_em: new Date().toISOString(),
  });
  await chegou("conversas", {
    id: conversa, ultima_mensagem: "[anexo]",
    ultima_atividade: new Date().toISOString(), nao_lidas: 1,
  }, "UPDATE");
  await page.waitForTimeout(500);
  const semTempo = await previaDaPrimeira();
  // SEM TEMPO, O NOME POR EXTENSO. "🎤" sozinho não diz nada; "🎤 0:00" seria
  // mentira. O nome escrito é o único dos três que é verdade.
  ok("áudio antigo aparece por extenso, e nunca com 0:00",
     /mensagem de voz/i.test(semTempo || "") && !/0:00/.test(semTempo || ""),
     `dizia: "${semTempo}"`);
}

console.log("\nE cada tipo tem o seu rótulo");
{
  const conversa = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-nome]");
    return el ? el.getAttribute("data-conversa-id") : null;
  });
  const casos = [["imagem", /foto/i], ["video", /v[ií]deo/i], ["documento", /documento/i]];
  for (const [tipo, esperado] of casos) {
    await chegou("mensagens", {
      id: `msg-${tipo}`, conversa_id: conversa, tipo, origem: "contato",
      texto: null, midia_url: "http://x/f", criado_em: new Date().toISOString(),
    });
    await chegou("conversas", {
      id: conversa, ultima_mensagem: "[anexo]",
      ultima_atividade: new Date().toISOString(), nao_lidas: 1,
    }, "UPDATE");
    await page.waitForTimeout(500);
    const texto = await previaDaPrimeira();
    ok(`${tipo}: a prévia diz o que é`, esperado.test(texto || ""), `dizia: "${texto}"`);
  }
}

console.log("\nA dica ao passar o mouse mostra o texto inteiro");
{
  // A prévia e o nome são cortados com reticências — "Procurações e
  // Documentos(…" não diz de qual pasta é. No WhatsApp Web, parar o mouse em
  // cima mostra o texto inteiro.
  const dicas = await page.evaluate(() => {
    const linha = document.querySelector("[data-conversa-nome]");
    if (!linha) return null;
    const spans = [...linha.querySelectorAll("span[title]")];
    return spans.map((s) => ({ dica: s.getAttribute("title"), visto: s.innerText.trim() }));
  });
  ok("o nome e a prévia têm dica", dicas && dicas.length >= 2,
     JSON.stringify(dicas));
  ok("e a dica é o mesmo texto que está na linha",
     dicas && dicas.every((d) => d.dica && d.dica === d.visto),
     JSON.stringify(dicas));
}

console.log("\nE um texto depois da mídia volta a ser o texto");
{
  // O rótulo não pode grudar: depois de um áudio, a próxima mensagem escrita
  // tem de aparecer escrita. Sem isto, a conversa ficaria "🎤 Mensagem de voz"
  // para sempre, e a lista mentiria sobre o que foi dito por último.
  const conversa = await page.evaluate(() => {
    const el = document.querySelector("[data-conversa-nome]");
    return el ? el.getAttribute("data-conversa-id") : null;
  });
  await chegou("mensagens", {
    id: "msg-texto-depois", conversa_id: conversa, tipo: "texto", origem: "contato",
    texto: "Obrigado, doutor", criado_em: new Date().toISOString(),
  });
  await chegou("conversas", {
    id: conversa, ultima_mensagem: "Obrigado, doutor",
    ultima_atividade: new Date().toISOString(), nao_lidas: 2,
  }, "UPDATE");
  await page.waitForTimeout(600);
  const texto = await previaDaPrimeira();
  ok("a prévia volta a ser o texto escrito", /Obrigado, doutor/.test(texto || ""),
     `dizia: "${texto}"`);
  ok("e o rótulo de mídia não ficou grudado", !/🎤|📷|🎬|📄/.test(texto || ""),
     `dizia: "${texto}"`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));
ok("nenhum erro de JavaScript no caminho todo", erros.length === 0);

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
