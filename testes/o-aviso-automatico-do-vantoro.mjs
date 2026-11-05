// O AVISO AUTOMÁTICO DO VANTORO TEM O ROSTO DELE (05/11)
//
// Pedido do Rodrigo, com a foto de um aviso de audiência: "Nos avisos de
// audiência, o ícone tem que mostrar que foi uma mensagem automática enviada
// pelo Vantoro."
//
// O aviso sai sozinho, pedido pelo Vantoro, e a ponte o grava SEM AUTOR e
// marcado como automático (`mensagens.automatica`, script 037 da ponte). Sem
// autor, a bolha caía no nome de QUEM ESTÁ OLHANDO A TELA: o aviso aparecia
// com as iniciais da pessoa ("RS"), como se ela o tivesse mandado. E a
// mensagem antiga sem autor (as de julho, de antes de o Zorvin anotar quem
// escreve) caía no mesmo lugar. Medido em 05/11: 107 avisos e 92 mensagens
// antigas.
//
// O QUE ESTA PROVA GUARDA:
//   1. o aviso automático diz quem o mandou ("Aviso automático do Vantoro"),
//      com um robô no lugar das iniciais — e o robô está PINTADO;
//   2. a mensagem sem autor ganha um rosto neutro, e não as iniciais de quem
//      olha;
//   3. o CONTRASTE: a bolha de uma colega continua com as iniciais dela, e a
//      minha com a minha foto — senão uma tela que apagasse todo rosto
//      passaria;
//   4. o aviso não entra em "quem participou da conversa": ninguém da equipe
//      o escreveu;
//   5. no celular, o mesmo.
//
// Na bancada, quem entra é "Rodrigo Sousa" (u1), COM foto. A mensagem sem
// autor não tem foto, e o desenho antigo mostrava as iniciais dele: "RS".
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

const NOME = "AVISO CLIENTE PROVA";
const atras = (min) => new Date(AGORA - min * 60e3).toISOString();
const doCliente = (id, texto, min) => ({ id, conversa_id: "cv-aviso", origem: "contato", tipo: "texto", texto,
  id_uazapi: "uz-" + id, criado_em: atras(min) });
const nossa = (id, texto, min, extra) => ({ id, conversa_id: "cv-aviso", origem: "advogado", tipo: "texto", texto,
  id_uazapi: "uz-" + id, status: "lida", enviado_por: null, enviado_por_id: null, criado_em: atras(min), ...extra });
const SEMENTE = {
  contatos: [{ id: "ct-aviso", numero: "5511970007711", nome: NOME, vantoro_nome: null, nome_zorvin: null }],
  conversas: [{ id: "cv-aviso", advogado_id: TEL, contato_id: "ct-aviso", nao_lidas: 0, arquivada: false,
    fixada: false, favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(),
    ultima_mensagem: "Às ordens", frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-aviso", nome: NOME, numero: "5511970007711", foto_url: null } }],
  // Cada mensagem nossa fica entre duas do cliente: cada uma é a última do
  // seu grupo, e é nela que o rosto aparece.
  mensagens: [
    doCliente("m-av-1", "Bom dia", 70),
    // O AVISO: sem autor, e marcado como automático, como a ponte grava.
    nossa("m-av-2", "Olá! Sua audiência está marcada. Confirme a ciência e o comparecimento.", 60,
          { automatica: true }),
    doCliente("m-av-3", "Ok, ciente", 55),
    // A MENSAGEM ANTIGA SEM AUTOR: nem autor, nem a marca.
    nossa("m-av-4", "Mensagem antiga, de quando não se anotava quem escreve", 50, { automatica: false }),
    doCliente("m-av-5", "E agora?", 45),
    // O CONTRASTE: uma colega sem foto (as iniciais dela)…
    nossa("m-av-6", "Vou conferir", 40, { enviado_por: "ISABELA GUEDES", enviado_por_id: "u-isabela" }),
    doCliente("m-av-7", "Obrigado", 35),
    // … e eu, com a minha foto.
    nossa("m-av-8", "Às ordens", 30, { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" }),
  ],
};

// O que a linha de uma mensagem desenha no lugar do rosto.
async function rostoDa(page, id) {
  return page.evaluate((id) => {
    const linha = document.querySelector(`[data-msg-id="${id}"]`);
    if (!linha) return null;
    const robo = linha.querySelector("[data-avatar-automatico]");
    const semAutor = linha.querySelector("[data-avatar-sem-autor]");
    const iniciais = [...linha.querySelectorAll("[data-avatar-inicial]")].map((e) => e.getAttribute("data-avatar-inicial"));
    const fotos = [...linha.querySelectorAll("img")].map((e) => e.getAttribute("alt") || "");
    // O QUE ESTÁ PINTADO no centro do rosto: o robô tem de estar à vista, e
    // não só no documento.
    const pintado = (el) => {
      if (!el) return false;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const no = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(no && (no === el || el.contains(no)));
    };
    const autor = linha.querySelector("[data-autor-automatico]");
    // O DESENHO, e não só a marca: um rosto neutro com a marca do robô
    // passaria por todas as outras conferências. O lucide põe o nome do
    // ícone na classe do desenho (`lucide-bot`, `lucide-user-round`).
    const desenho = (el) => (el && el.querySelector("svg") ? el.querySelector("svg").getAttribute("class") || "" : "");
    return {
      roboDesenho: desenho(robo), semAutorDesenho: desenho(semAutor), autorDesenho: desenho(autor),
      robo: Boolean(robo), roboPintado: pintado(robo),
      roboTitulo: robo ? robo.getAttribute("title") || "" : "",
      roboRotulo: robo ? robo.getAttribute("aria-label") || "" : "",
      roboLargura: robo ? Math.round(robo.getBoundingClientRect().width) : 0,
      semAutor: Boolean(semAutor), semAutorPintado: pintado(semAutor),
      semAutorTitulo: semAutor ? semAutor.getAttribute("title") || "" : "",
      iniciais, fotos,
      autor: autor ? autor.innerText.trim() : null,
      autorTitulo: autor ? autor.getAttribute("title") || "" : "",
    };
  }, id);
}

async function abrirAConversa(largura, altura) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, SEMENTE);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.locator('[data-conversa-id="cv-aviso"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForSelector('[data-msg-id="m-av-8"]', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  return { ctx, page, estouros };
}

// ------------------------------------------------------------------
console.log("\n1. O aviso automático diz que é do Vantoro, com um robô no lugar das iniciais (1920)");
{
  const { ctx, page, estouros } = await abrirAConversa(1920, 1000);
  const aviso = await rostoDa(page, "m-av-2");
  ok("a conversa abriu, com o aviso na tela", Boolean(aviso));
  ok("o aviso diz quem o mandou: \"Aviso automático do Vantoro\"",
     aviso && aviso.autor === "Aviso automático do Vantoro", aviso && String(aviso.autor));
  ok("e a linha do autor diz que ninguém da equipe o escreveu",
     aviso && /Vantoro/.test(aviso.autorTitulo) && /ninguém da equipe/.test(aviso.autorTitulo),
     aviso && aviso.autorTitulo);
  ok("no lugar do rosto, o robô", aviso && aviso.robo);
  ok("e o desenho é o do robô", aviso && /\blucide-bot\b/.test(aviso.roboDesenho), aviso && aviso.roboDesenho);
  ok("a linha do autor também leva o robô", aviso && /\blucide-bot\b/.test(aviso.autorDesenho),
     aviso && aviso.autorDesenho);
  ok("e o robô está PINTADO (elementFromPoint)", aviso && aviso.roboPintado);
  ok("do tamanho dos outros rostos (28)", aviso && aviso.roboLargura === 28, aviso && String(aviso.roboLargura));
  ok("o robô diz, no title, que é uma mensagem automática do Vantoro",
     aviso && /automática/.test(aviso.roboTitulo) && /Vantoro/.test(aviso.roboTitulo), aviso && aviso.roboTitulo);
  ok("e no aria-label também", aviso && aviso.roboRotulo === "Aviso automático do Vantoro",
     aviso && aviso.roboRotulo);
  ok("o aviso NÃO tem as iniciais de quem olha a tela (RS), nem iniciais nenhumas",
     aviso && aviso.iniciais.length === 0, aviso && aviso.iniciais.join(","));
  ok("nem a foto de quem olha", aviso && aviso.fotos.length === 0, aviso && aviso.fotos.join(","));

  console.log("\n2. A mensagem sem autor ganha um rosto neutro, e não as iniciais de quem olha");
  const semAutor = await rostoDa(page, "m-av-4");
  ok("a mensagem sem autor está na tela", Boolean(semAutor));
  ok("no lugar do rosto, o rosto neutro", semAutor && semAutor.semAutor);
  ok("e o desenho é um rosto sem traços, e não o robô",
     semAutor && /\blucide-user-round\b/.test(semAutor.semAutorDesenho), semAutor && semAutor.semAutorDesenho);
  ok("e ele está pintado", semAutor && semAutor.semAutorPintado);
  ok("o title diz que quem enviou não ficou registrado",
     semAutor && /não ficou registrado/.test(semAutor.semAutorTitulo), semAutor && semAutor.semAutorTitulo);
  ok("sem as iniciais de quem olha (RS)", semAutor && semAutor.iniciais.length === 0,
     semAutor && semAutor.iniciais.join(","));
  ok("nem a foto de quem olha", semAutor && semAutor.fotos.length === 0, semAutor && semAutor.fotos.join(","));
  ok("e ela não é dita do Vantoro: sem o robô e sem a linha do aviso automático",
     semAutor && !semAutor.robo && semAutor.autor === null);

  console.log("\n3. O contraste: a colega com as iniciais dela, e eu com a minha foto");
  const colega = await rostoDa(page, "m-av-6");
  ok("a colega sem foto aparece com as iniciais dela (IG)",
     colega && colega.iniciais.length === 1 && colega.iniciais[0] === "IG", colega && colega.iniciais.join(","));
  ok("e sem robô nem rosto neutro", colega && !colega.robo && !colega.semAutor);
  const minha = await rostoDa(page, "m-av-8");
  ok("a minha mensagem aparece com a minha foto",
     minha && minha.fotos.length === 1 && minha.fotos[0] === "Rodrigo Sousa", minha && minha.fotos.join(","));
  ok("e sem robô nem rosto neutro", minha && !minha.robo && !minha.semAutor);

  console.log("\n4. O aviso não entra em \"quem participou da conversa\"");
  const botao = page.locator("[data-quem-participou]").first();
  const temBotao = (await botao.count()) === 1;
  ok("o grupinho de quem participou está no cabeçalho", temBotao);
  const rotulo = temBotao ? (await botao.getAttribute("aria-label")) || "" : "";
  ok("ele conta duas pessoas (a colega e eu), e não três", /\(2\)/.test(rotulo), rotulo);
  if (temBotao) {
    await botao.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  const participantes = await page.evaluate(() =>
    [...document.querySelectorAll("[data-participante]")].map((e) => e.getAttribute("data-participante")));
  ok("a lista abriu, com a colega e comigo",
     participantes.length === 2 && participantes.includes("ISABELA GUEDES") && participantes.includes("Rodrigo Sousa"),
     participantes.join(" | "));
  ok("e sem o aviso automático", !participantes.some((p) => /Vantoro/.test(p || "")), participantes.join(" | "));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

// ------------------------------------------------------------------
console.log("\n5. No celular (390), o mesmo");
{
  const { ctx, page, estouros } = await abrirAConversa(390, 844);
  const aviso = await rostoDa(page, "m-av-2");
  ok("a conversa abriu no celular, com o aviso", Boolean(aviso));
  ok("o aviso diz que é do Vantoro", aviso && aviso.autor === "Aviso automático do Vantoro",
     aviso && String(aviso.autor));
  // O aviso fica mais acima: rola até ele antes de perguntar o que está pintado.
  await page.locator('[data-msg-id="m-av-2"]').first().scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  const visto = await rostoDa(page, "m-av-2");
  ok("o robô está pintado no celular", visto && visto.roboPintado);
  ok("sem as iniciais de quem olha", visto && visto.iniciais.length === 0, visto && visto.iniciais.join(","));
  const semAutor = await rostoDa(page, "m-av-4");
  ok("e a mensagem sem autor, com o rosto neutro e sem as iniciais",
     semAutor && semAutor.semAutor && semAutor.iniciais.length === 0, semAutor && semAutor.iniciais.join(","));
  ok("a tela não estourou", !estouros.length, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
