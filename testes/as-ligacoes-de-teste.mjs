// AS LIGAÇÕES DE TESTE (11/11) — a tela que testa as ligações pela Nvoip.
//
// Pedido do Rodrigo: "Pode fazer a tela de teste das ligações", com o
// endereço que o João (Nvoip) passou: wss://app.nvoip.com.br:7443. A tela
// mora numa guia própria (`?tela=ligacoes`), só para quem administra, e a
// senha SIP é digitada nela e só mora na memória da guia.
//
// O SERVIDOR DA NVOIP NÃO ESTÁ AO ALCANCE DA PROVA, e a voz de verdade não se
// mede aqui. São duas metades:
//
//   1. A BIBLIOTECA DE VERDADE (JsSIP) contra um servidor SIP de mentira, que
//      a prova põe no lugar do endereço da Nvoip (`routeWebSocket`): o
//      registro com a senha conferida pelo desafio (digest MD5, como o
//      FreeSWITCH faz), a senha errada, o endereço que não abre, e a ligação
//      que sai, toca e dá ocupado. É o que prova que a tela fala SIP de
//      verdade, com o domínio e o número no formato certo — uma biblioteca de
//      mentira aprovaria qualquer nome de função.
//   2. UMA BIBLIOTECA DE MENTIRA (`__SIP_DE_MENTIRA`), para o que pede uma
//      ligação ATENDIDA: o áudio montado exige um servidor de mídia, e a
//      prova não tem um. Ela mede a tela: o relógio, o mudo, o teclado, a
//      ligação que chega, recusar, a segunda ligação, o microfone negado, e o
//      fechar da guia no meio de uma ligação.
//
// E as duas guardas que não dependem da biblioteca: só quem administra, e a
// senha que não vai a lugar nenhum (nem ao navegador, nem ao registro).
import { createHash } from "node:crypto";
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const md5 = (t) => createHash("md5").update(t).digest("hex");
const SENHA = "Senha#Secreta-9";
const USUARIO = "123456001";
const DOMINIO = "app.nvoip.com.br";

// O microfone de mentira do Chromium, aceito sem perguntar: a ligação de
// verdade pede o microfone antes de sair.
const nav = await abrirNavegador({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const estouros = [];

const esperar = (page, sel, prazo = 15000) =>
  page.waitForSelector(sel, { timeout: prazo }).then(() => true).catch(() => false);
const attr = async (page, sel, nome) => (await page.locator(sel).count()) ? page.locator(sel).first().getAttribute(nome) : null;
const texto = async (page, sel) => (await page.locator(sel).count()) ? (await page.locator(sel).first().innerText()).replace(/\s+/g, " ").trim() : "";
const clicar = async (page, sel) => {
  if (!(await page.locator(sel).count())) return false;
  return page.locator(sel).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
};
const preencher = async (page, sel, valor) => {
  if (!(await page.locator(sel).count())) return false;
  return page.locator(sel).first().fill(valor, { timeout: 5000 }).then(() => true).catch(() => false);
};
async function esperarAttr(page, sel, nome, valor, prazo = 8000) {
  const ate = Date.now() + prazo;
  let v = null;
  while (Date.now() < ate) {
    v = await attr(page, sel, nome);
    if (v === valor) return v;
    await page.waitForTimeout(80);
  }
  return v;
}
async function esperarTexto(page, sel, pedaco, prazo = 8000) {
  const ate = Date.now() + prazo;
  let t = "";
  while (Date.now() < ate) {
    t = await texto(page, sel);
    if (t.includes(pedaco)) return t;
    await page.waitForTimeout(80);
  }
  return t;
}

async function abrir({ init = null, admin = true, viewport = { width: 1280, height: 860 } } = {}) {
  const ctx = await nav.newContext({ viewport, permissions: ["microphone"] });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((a) => { globalThis.__SOU_ADMIN = a; }, admin);
  if (init) await page.addInitScript(init);
  return { ctx, page };
}

// ============================================================
//  O SERVIDOR SIP DE MENTIRA, no lugar de wss://app.nvoip.com.br:7443.
//  Responde como um FreeSWITCH: desafia o REGISTER (401) e o INVITE (407)
//  com digest MD5, confere a resposta com a senha certa, e na ligação manda
//  100, 180 e, por fim, 486 (ocupado).
// ============================================================
function servidorSip(page, { aceitaConexao = true, senha = SENHA } = {}) {
  const visto = { registros: [], autorizados: 0, recusados: 0, convites: [], acks: 0, conectou: 0, mensagens: [] };
  const cab = (msg, nome) => {
    const m = msg.match(new RegExp(`^${nome}:\\s*(.*)$`, "im"));
    return m ? m[1].trim() : "";
  };
  const resposta = (msg, codigo, frase, extras = []) => {
    const linhas = [`SIP/2.0 ${codigo} ${frase}`];
    for (const v of msg.match(/^Via:.*$/gim) || []) linhas.push(v);
    linhas.push(`From: ${cab(msg, "From")}`);
    const para = cab(msg, "To");
    linhas.push(`To: ${para}${codigo > 100 && !/;tag=/.test(para) ? ";tag=srv1" : ""}`);
    linhas.push(`Call-ID: ${cab(msg, "Call-ID")}`);
    linhas.push(`CSeq: ${cab(msg, "CSeq")}`);
    linhas.push(...extras);
    linhas.push("Content-Length: 0", "", "");
    return linhas.join("\r\n");
  };
  const confere = (msg, metodo, nomeCab) => {
    const a = cab(msg, nomeCab);
    if (!a) return null;
    const p = Object.fromEntries([...a.replace(/^Digest\s+/i, "").matchAll(/(\w+)=("([^"]*)"|[^,\s]+)/g)].map((x) => [x[1], x[3] ?? x[2]]));
    const ha1 = md5(`${p.username}:${p.realm}:${senha}`);
    const ha2 = md5(`${metodo}:${p.uri}`);
    const certo = p.qop ? md5(`${ha1}:${p.nonce}:${p.nc}:${p.cnonce}:${p.qop}:${ha2}`) : md5(`${ha1}:${p.nonce}:${ha2}`);
    return { ok: certo === p.response, usuario: p.username, realm: p.realm, uri: p.uri };
  };
  const desafio = (nome) => `${nome}: Digest realm="${DOMINIO}", nonce="n0nc3-zorvin", algorithm=MD5, qop="auth"`;
  return page.routeWebSocket((u) => u.host === `${DOMINIO}:7443`, (ws) => {
    visto.conectou++;
    if (!aceitaConexao) { ws.close({ code: 1006, reason: "fora do ar" }); return; }
    ws.onMessage((m) => {
      const msg = String(m);
      visto.mensagens.push(msg);
      const primeira = msg.split("\r\n")[0];
      const metodo = primeira.split(" ")[0];
      if (metodo === "REGISTER") {
        visto.registros.push(msg);
        const c = confere(msg, "REGISTER", "Authorization");
        if (!c) { ws.send(resposta(msg, 401, "Unauthorized", [desafio("WWW-Authenticate")])); return; }
        if (!c.ok) { visto.recusados++; ws.send(resposta(msg, 403, "Forbidden")); return; }
        visto.autorizados++;
        const contato = cab(msg, "Contact");
        ws.send(resposta(msg, 200, "OK", [`Contact: ${contato.replace(/;expires=\d+/i, "")};expires=600`]));
      } else if (metodo === "INVITE") {
        visto.convites.push(msg);
        const c = confere(msg, "INVITE", "Proxy-Authorization");
        if (!c) { ws.send(resposta(msg, 407, "Proxy Authentication Required", [desafio("Proxy-Authenticate")])); return; }
        if (!c.ok) { ws.send(resposta(msg, 403, "Forbidden")); return; }
        ws.send(resposta(msg, 100, "Trying"));
        setTimeout(() => ws.send(resposta(msg, 180, "Ringing")), 150);
        setTimeout(() => ws.send(resposta(msg, 486, "Busy Here")), 700);
      } else if (metodo === "ACK") {
        visto.acks++;
      } else if (metodo === "OPTIONS" || metodo === "BYE" || metodo === "CANCEL") {
        ws.send(resposta(msg, 200, "OK"));
      }
    });
  }).then(() => visto);
}

const SEM = (p) => `[data-ligacoes-campo="${p}"]`;

// ============================================================
//  1. SÓ PARA QUEM ADMINISTRA
// ============================================================
console.log("\n1. Só para quem administra");
{
  const { ctx, page } = await abrir({ admin: false });
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  const diz = await esperar(page, '[data-tela-da-guia="ligacoes"][data-guia-abrindo="indisponivel"]', 20000);
  ok("quem não administra abre a guia e lê que ela é só para quem administra", diz);
  ok("…com a frase dita", (await texto(page, "[data-tela-da-guia]")).includes("só para quem administra"),
     await texto(page, "[data-tela-da-guia]"));
  ok("…e a tela não é desenhada", (await page.locator('[data-tela="ligacoes"]').count()) === 0);
  await page.goto(ENDERECO);
  await esperar(page, 'button[aria-label="Menu"]', 20000);
  await clicar(page, 'button[aria-label="Menu"]');
  await page.waitForTimeout(300);
  ok("o menu ⋮ de quem não administra não oferece as ligações", (await page.locator("[data-abrir-ligacoes]").count()) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ admin: true });
  await page.goto(ENDERECO);
  await esperar(page, 'button[aria-label="Menu"]', 20000);
  await clicar(page, 'button[aria-label="Menu"]');
  const tem = await esperar(page, "[data-abrir-ligacoes]", 5000);
  ok("o menu ⋮ de quem administra oferece \"Ligações (teste)\"", tem);
  ok("…num link que abre a guia da tela", (await attr(page, "[data-abrir-ligacoes]", "href") || "").includes("tela=ligacoes")
     && (await attr(page, "[data-abrir-ligacoes]", "target")) === "_blank"
     && (await attr(page, "[data-abrir-ligacoes]", "rel") || "").includes("noopener"));
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  ok("quem administra vê a tela", await esperar(page, '[data-tela="ligacoes"]', 20000));
  ok("o título da guia é o da tela", (await page.title()).startsWith("Ligações (teste)"), await page.title());
  ok("o endereço da Nvoip já vem escrito", (await page.locator(SEM("wss")).inputValue()) === "wss://app.nvoip.com.br:7443");
  ok("o campo da senha é de senha (não se lê na tela)", (await attr(page, SEM("senha"), "type")) === "password");
  ok("a conta começa desconectada", (await attr(page, "[data-ligacoes-conta]", "data-ligacoes-conta")) === "desligada");
  ok("e Ligar começa desligado", await page.locator("[data-ligacoes-ligar]").isDisabled().catch(() => false));

  // O que falta é dito antes de conectar, e nada sai para a rede.
  await clicar(page, "[data-ligacoes-conectar]");
  ok("sem usuário, a tela diz o que falta", (await texto(page, "[data-ligacoes-erro]")).includes("Falta o usuário SIP"),
     await texto(page, "[data-ligacoes-erro]"));
  await preencher(page, SEM("usuario"), USUARIO);
  await clicar(page, "[data-ligacoes-conectar]");
  ok("sem senha, a tela diz onde achar a senha", (await texto(page, "[data-ligacoes-erro]")).includes("Configurações > Usuários"),
     await texto(page, "[data-ligacoes-erro]"));
  await preencher(page, SEM("senha"), SENHA);
  await preencher(page, SEM("wss"), "http://app.nvoip.com.br:7443");
  await clicar(page, "[data-ligacoes-conectar]");
  ok("um endereço sem wss:// é recusado (a senha iria aberta)", (await texto(page, "[data-ligacoes-erro]")).includes("wss://"),
     await texto(page, "[data-ligacoes-erro]"));
  ok("…e a conta continua desconectada", (await attr(page, "[data-ligacoes-conta]", "data-ligacoes-conta")) === "desligada");

  // O número é mostrado como vai ser discado.
  await preencher(page, "[data-ligacoes-numero]", "(11) 98765-4321");
  ok("o número mostra como vai ser discado, só com os algarismos",
     (await texto(page, "[data-ligacoes-vai-discar]")).includes("11987654321"), await texto(page, "[data-ligacoes-vai-discar]"));
  await ctx.close();
}

// ============================================================
//  2. A BIBLIOTECA DE VERDADE: o registro com a senha certa
// ============================================================
console.log("\n2. A biblioteca de verdade: o registro com a senha conferida");
{
  const { ctx, page } = await abrir();
  const visto = await servidorSip(page);
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  await esperar(page, '[data-tela="ligacoes"]', 20000);
  await preencher(page, SEM("usuario"), USUARIO);
  await preencher(page, SEM("senha"), SENHA);
  await clicar(page, "[data-ligacoes-conectar]");
  const estado = await esperarAttr(page, "[data-ligacoes-conta]", "data-ligacoes-conta", "registrada", 15000);
  ok("com a senha certa, a conta fica conectada", estado === "registrada", `estado: ${estado}`);
  ok("…e a tela diz que está pronta para ligar e receber", (await texto(page, "[data-ligacoes-estado-da-conta]")).includes("pronta para ligar"));
  ok("a conexão foi ao endereço da Nvoip", visto.conectou >= 1);
  const reg = visto.registros[0] || "";
  ok("o REGISTER vai para o domínio do endereço (sip:app.nvoip.com.br)", /^REGISTER sip:app\.nvoip\.com\.br SIP\/2\.0/.test(reg), reg.split("\r\n")[0]);
  ok("…com o usuário no endereço SIP", new RegExp(`^From:.*sip:${USUARIO}@${DOMINIO.replace(/\./g, "\\.")}`, "im").test(reg));
  ok("o servidor desafiou, e a resposta do desafio confere com a senha (MD5)", visto.autorizados >= 1 && visto.recusados === 0,
     `autorizados ${visto.autorizados}, recusados ${visto.recusados}`);
  ok("a senha nunca vai escrita no que sai para a rede", !visto.mensagens.some((m) => m.includes(SENHA)));
  ok("os campos da conta ficam travados enquanto conectada", await page.locator(SEM("senha")).isDisabled().catch(() => false));
  ok("o registro diz como quem se registrou", (await texto(page, "[data-ligacoes-registro]")).includes(`Registrado como ${USUARIO}@${DOMINIO}`));
  ok("…e não leva a senha", !(await texto(page, "[data-ligacoes-registro]")).includes(SENHA));
  const guardado = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  ok("a senha não fica guardada no navegador (nem local, nem da guia)", !guardado.includes(SENHA));
  ok("Ligar fica ligado com a conta conectada", !(await page.locator("[data-ligacoes-ligar]").isDisabled().catch(() => true)));

  // A LIGAÇÃO DE VERDADE, que o servidor de mentira põe para tocar e dá ocupado.
  await preencher(page, "[data-ligacoes-numero]", "(11) 98765-4321");
  await clicar(page, "[data-ligacoes-ligar]");
  const tocou = await esperarAttr(page, "[data-ligacao]", "data-ligacao", "tocando", 10000);
  ok("a ligação sai e a tela diz que está tocando no outro lado (180)", tocou === "tocando", `estado: ${tocou}`);
  const conv = visto.convites.find((c) => /Proxy-Authorization/i.test(c)) || visto.convites[0] || "";
  ok("o INVITE vai para o número só com os algarismos, no domínio da Nvoip",
     /^INVITE sip:11987654321@app\.nvoip\.com\.br SIP\/2\.0/.test(conv), conv.split("\r\n")[0]);
  ok("…com áudio e sem vídeo", /m=audio /.test(conv) && !/m=video /.test(conv));
  ok("…e o desafio do INVITE respondido com a senha certa", visto.convites.some((c) => /Proxy-Authorization/i.test(c)));
  const fim = await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada", 10000);
  ok("o ocupado encerra a ligação", fim === "encerrada", `estado: ${fim}`);
  ok("…e a tela diz por quê, com o código SIP", (await texto(page, "[data-ligacoes-fim]")).includes("ocupado")
     && (await texto(page, "[data-ligacoes-fim]")).includes("486"), await texto(page, "[data-ligacoes-fim]"));

  // Desconectar desfaz o registro e destrava os campos.
  await clicar(page, "[data-ligacoes-desconectar]");
  ok("Desconectar volta a conta para desconectada", (await esperarAttr(page, "[data-ligacoes-conta]", "data-ligacoes-conta", "desligada")) === "desligada");
  ok("…e destrava os campos", !(await page.locator(SEM("senha")).isDisabled().catch(() => true)));
  await ctx.close();
}

// ============================================================
//  3. A SENHA ERRADA, e o endereço que não abre
// ============================================================
console.log("\n3. A senha errada e o endereço que não abre");
{
  const { ctx, page } = await abrir();
  const visto = await servidorSip(page);
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  await esperar(page, '[data-tela="ligacoes"]', 20000);
  await preencher(page, SEM("usuario"), USUARIO);
  await preencher(page, SEM("senha"), "senha-errada");
  await clicar(page, "[data-ligacoes-conectar]");
  const e = await esperarAttr(page, "[data-ligacoes-conta]", "data-ligacoes-conta", "falhou", 15000);
  ok("com a senha errada, a conta não conecta", e === "falhou", `estado: ${e}`);
  ok("…e a tela diz que a Nvoip recusou o usuário ou a senha, com o código",
     (await texto(page, "[data-ligacoes-frase-da-conta]")).includes("recusou o usuário ou a senha")
     && (await texto(page, "[data-ligacoes-frase-da-conta]")).includes("403"), await texto(page, "[data-ligacoes-frase-da-conta]"));
  await page.waitForTimeout(2500);
  ok("a senha recusada não é tentada de novo (a Nvoip pode bloquear)", visto.recusados === 1, `tentativas recusadas: ${visto.recusados}`);
  ok("…e Conectar volta, para corrigir", (await page.locator("[data-ligacoes-conectar]").count()) === 1);
  await ctx.close();
}
{
  const { ctx, page } = await abrir();
  await servidorSip(page, { aceitaConexao: false });
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  await esperar(page, '[data-tela="ligacoes"]', 20000);
  await preencher(page, SEM("usuario"), USUARIO);
  await preencher(page, SEM("senha"), SENHA);
  await clicar(page, "[data-ligacoes-conectar]");
  const e = await esperarAttr(page, "[data-ligacoes-conta]", "data-ligacoes-conta", "falhou", 15000);
  ok("o endereço que não abre não fica em \"Conectando…\" para sempre", e === "falhou", `estado: ${e}`);
  ok("…e a tela manda conferir o endereço e a internet", (await texto(page, "[data-ligacoes-frase-da-conta]")).includes("Confira o endereço WSS"),
     await texto(page, "[data-ligacoes-frase-da-conta]"));
  await ctx.close();
}
{
  // O DOMÍNIO ESCRITO vence o do endereço, e o usuário colado com o domínio
  // não vira "usuario@dominio@dominio".
  const { ctx, page } = await abrir();
  const visto = await servidorSip(page);
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  await esperar(page, '[data-tela="ligacoes"]', 20000);
  await preencher(page, SEM("usuario"), `sip:${USUARIO}@sip.outro.dominio`);
  await preencher(page, SEM("senha"), SENHA);
  await clicar(page, "[data-ligacoes-conectar]");
  await esperar(page, '[data-ligacoes-conta="registrada"], [data-ligacoes-conta="falhou"]', 15000);
  const reg = visto.registros[0] || "";
  ok("o usuário colado com o domínio usa aquele domínio", /^REGISTER sip:sip\.outro\.dominio SIP\/2\.0/.test(reg)
     && new RegExp(`^From:.*sip:${USUARIO}@sip\\.outro\\.dominio[>;]`, "im").test(reg), reg.split("\r\n").slice(0, 6).join(" | "));
  await ctx.close();
}

// ============================================================
//  4. A BIBLIOTECA DE MENTIRA: a ligação atendida, o mudo e o teclado
// ============================================================
const SIP_DE_MENTIRA = () => {
  class Emissor {
    constructor() { this.h = {}; }
    on(n, f) { (this.h[n] = this.h[n] || []).push(f); return this; }
    emit(n, e) { for (const f of this.h[n] || []) f(e); }
  }
  const S = globalThis.__SIP = { uas: [], sessoes: [], cenario: { microfone: true } };
  class Sessao extends Emissor {
    constructor(direcao, de) {
      super();
      this.direcao = direcao; this.atendida = false; this.fim = false; this.gestos = [];
      this.remote_identity = { uri: `sip:${de}@app.nvoip.com.br`, display_name: "" };
      this.connection = { addEventListener() {}, getReceivers: () => [] };
      S.sessoes.push(this);
    }
    _acabar(tipo, causa, originator) { if (this.fim) return; this.fim = true; this.emit(tipo, { cause: causa, originator }); }
    terminate(o) { this.gestos.push(["terminate", o || null]); if (this.atendida) this._acabar("ended", "Bye", "local"); else this._acabar("failed", this.direcao === "chegando" ? "Rejected" : "Canceled", "local"); }
    answer(o) { this.gestos.push(["answer", o]); setTimeout(() => { this.atendida = true; this.emit("accepted", {}); this.emit("confirmed", {}); }, 40); }
    mute(o) { this.gestos.push(["mute", o]); }
    unmute(o) { this.gestos.push(["unmute", o]); }
    sendDTMF(t) { this.gestos.push(["dtmf", t]); }
  }
  S.atenderDoOutroLado = () => { const s = S.sessoes[S.sessoes.length - 1]; s.atendida = true; s.emit("accepted", {}); s.emit("confirmed", {}); };
  S.desligarDoOutroLado = () => { const s = S.sessoes.find((x) => !x.fim); if (s) s._acabar("ended", "Bye", "remote"); };
  S.chegaLigacao = (de) => { const s = new Sessao("chegando", de); S.uas[S.uas.length - 1].emit("newRTCSession", { originator: "remote", session: s }); return S.sessoes.length - 1; };
  globalThis.__SIP_DE_MENTIRA = {
    WebSocketInterface: class { constructor(url) { this.url = url; } },
    UA: class extends Emissor {
      constructor(cfg) { super(); this.cfg = cfg; this.chamadas = []; this.parou = false; S.uas.push(this); }
      start() { setTimeout(() => this.emit("connecting", {}), 10); setTimeout(() => this.emit("connected", {}), 20); setTimeout(() => this.emit("registered", {}), 40); }
      stop() { this.parou = true; }
      call(alvo, opcoes) {
        this.chamadas.push({ alvo, opcoes });
        const s = new Sessao("saindo", alvo);
        setTimeout(() => {
          if (!S.cenario.microfone) { s._acabar("failed", "User Denied Media Access", "local"); return; }
          s.emit("peerconnection", { peerconnection: s.connection });
          s.emit("progress", { response: { status_code: 180 } });
        }, 30);
        return s;
      }
    },
  };
};

async function conectarDeMentira(page) {
  await page.goto(`${ENDERECO}?tela=ligacoes`);
  await esperar(page, '[data-tela="ligacoes"]', 20000);
  await preencher(page, SEM("usuario"), USUARIO);
  await preencher(page, SEM("senha"), SENHA);
  await clicar(page, "[data-ligacoes-conectar]");
  return esperarAttr(page, "[data-ligacoes-conta]", "data-ligacoes-conta", "registrada");
}

console.log("\n4. A ligação atendida, o mudo, o teclado e o desligar");
{
  const { ctx, page } = await abrir({ init: SIP_DE_MENTIRA });
  ok("a conta conecta (biblioteca de mentira)", (await conectarDeMentira(page)) === "registrada");
  const cfg = await page.evaluate(() => { const u = globalThis.__SIP.uas[0]; return u ? { uri: u.cfg.uri, temSenha: u.cfg.password === "Senha#Secreta-9", sockets: u.cfg.sockets.map((s) => s.url) } : null; });
  ok("a biblioteca recebe a conta montada (uri, senha e endereço)", cfg && cfg.uri === `sip:${USUARIO}@${DOMINIO}` && cfg.temSenha
     && cfg.sockets[0] === "wss://app.nvoip.com.br:7443", JSON.stringify(cfg));
  await preencher(page, "[data-ligacoes-numero]", "11 3333-4444");
  await page.locator("[data-ligacoes-numero]").press("Enter");
  ok("Enter no número liga", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "tocando")) === "tocando");
  const chamada = await page.evaluate(() => globalThis.__SIP.uas[0].chamadas[0]);
  ok("a ligação pede só o áudio, com o STUN", chamada && chamada.alvo === "1133334444" && chamada.opcoes.mediaConstraints.audio === true
     && chamada.opcoes.mediaConstraints.video === false && (chamada.opcoes.pcConfig.iceServers || []).length > 0, JSON.stringify(chamada));
  ok("com uma ligação no ar, Ligar fica desligado", await page.locator("[data-ligacoes-ligar]").isDisabled().catch(() => false));
  await page.evaluate(() => globalThis.__SIP.atenderDoOutroLado());
  ok("atendida do outro lado, a tela diz \"Em ligação\"", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "em_ligacao")) === "em_ligacao");
  await page.waitForTimeout(1300);
  ok("…com o relógio andando", /^00:0[1-9]$/.test(await texto(page, "[data-ligacoes-duracao]")), await texto(page, "[data-ligacoes-duracao]"));

  // A ligação segura a atualização sozinha do Zorvin, e fechar a guia pergunta.
  const fechar = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok("fechar ou recarregar a guia no meio da ligação pergunta antes", fechar === true);

  await clicar(page, "[data-ligacoes-mudo]");
  ok("Mudo põe o microfone no mudo", (await attr(page, "[data-ligacoes-mudo]", "data-ligacoes-mudo")) === "sim"
     && (await page.evaluate(() => globalThis.__SIP.sessoes[0].gestos.some((g) => g[0] === "mute"))));
  await clicar(page, "[data-ligacoes-mudo]");
  ok("…e de novo tira do mudo", (await attr(page, "[data-ligacoes-mudo]", "data-ligacoes-mudo")) === "nao"
     && (await page.evaluate(() => globalThis.__SIP.sessoes[0].gestos.some((g) => g[0] === "unmute"))));
  await clicar(page, "[data-ligacoes-teclado]");
  await clicar(page, '[data-ligacoes-tecla="1"]');
  await clicar(page, '[data-ligacoes-tecla="#"]');
  const dtmf = await page.evaluate(() => globalThis.__SIP.sessoes[0].gestos.filter((g) => g[0] === "dtmf").map((g) => g[1]).join(""));
  ok("o teclado manda as teclas (para a URA)", dtmf === "1#", dtmf);
  await clicar(page, "[data-ligacoes-desligar]");
  ok("Desligar encerra a ligação", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada")) === "encerrada");
  ok("…e a tela diz que foi encerrada", (await texto(page, "[data-ligacoes-fim]")).includes("A ligação foi encerrada"), await texto(page, "[data-ligacoes-fim]"));
  const depois = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok("depois da ligação, fechar a guia não pergunta mais", depois === false);
  ok("e Ligar volta", !(await page.locator("[data-ligacoes-ligar]").isDisabled().catch(() => true)));
  await ctx.close();
}

// ============================================================
//  5. A LIGAÇÃO QUE CHEGA
// ============================================================
console.log("\n5. A ligação que chega");
{
  const { ctx, page } = await abrir({ init: SIP_DE_MENTIRA });
  await conectarDeMentira(page);
  await page.evaluate(() => globalThis.__SIP.chegaLigacao("5511988887777"));
  ok("a ligação que chega aparece, com Atender e Recusar", await esperar(page, "[data-ligacoes-chegando]", 5000)
     && (await page.locator("[data-ligacoes-atender]").count()) === 1 && (await page.locator("[data-ligacoes-recusar]").count()) === 1);
  ok("…e diz de quem é", (await texto(page, "[data-ligacoes-quem-liga]")).includes("5511988887777"), await texto(page, "[data-ligacoes-quem-liga]"));
  await clicar(page, "[data-ligacoes-atender]");
  ok("Atender atende, e a tela diz \"Em ligação\"", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "em_ligacao")) === "em_ligacao");
  const resp = await page.evaluate(() => (globalThis.__SIP.sessoes[0].gestos.find((g) => g[0] === "answer") || [])[1]);
  ok("…pedindo só o áudio", resp && resp.mediaConstraints.audio === true && resp.mediaConstraints.video === false, JSON.stringify(resp));
  // Uma segunda ligação no meio da primeira ouve "ocupado".
  await page.evaluate(() => globalThis.__SIP.chegaLigacao("5521977776666"));
  await page.waitForTimeout(200);
  const segunda = await page.evaluate(() => globalThis.__SIP.sessoes[1].gestos);
  ok("uma segunda ligação no meio da primeira ouve ocupado (486)", segunda.some((g) => g[0] === "terminate" && g[1] && g[1].status_code === 486), JSON.stringify(segunda));
  ok("…e a primeira continua", (await attr(page, "[data-ligacao]", "data-ligacao")) === "em_ligacao");
  await page.evaluate(() => globalThis.__SIP.desligarDoOutroLado());
  ok("o outro lado desliga, e a tela diz que terminou", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada")) === "encerrada");

  // Recusar.
  await page.evaluate(() => globalThis.__SIP.chegaLigacao("5531966665555"));
  await esperar(page, "[data-ligacoes-chegando]", 5000);
  await clicar(page, "[data-ligacoes-recusar]");
  const recusa = await page.evaluate(() => globalThis.__SIP.sessoes[2].gestos);
  ok("Recusar responde ocupado (486)", recusa.some((g) => g[0] === "terminate" && g[1] && g[1].status_code === 486), JSON.stringify(recusa));
  ok("…e o cartão da ligação que chega some", (await page.locator("[data-ligacoes-chegando]").count()) === 0);
  await ctx.close();
}

// ============================================================
//  6. O MICROFONE NEGADO, e sair da guia desliga tudo
// ============================================================
console.log("\n6. O microfone negado, e sair da guia desliga tudo");
{
  const { ctx, page } = await abrir({ init: SIP_DE_MENTIRA });
  await conectarDeMentira(page);
  await page.evaluate(() => { globalThis.__SIP.cenario.microfone = false; });
  await preencher(page, "[data-ligacoes-numero]", "11987654321");
  await clicar(page, "[data-ligacoes-ligar]");
  ok("sem o microfone, a ligação não sai", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada")) === "encerrada");
  ok("…e a tela diz que o navegador não deixou usar o microfone", (await texto(page, "[data-ligacoes-fim]")).includes("microfone"),
     await texto(page, "[data-ligacoes-fim]"));
  // Conectada, a conta segura a atualização sozinha (recarregar apagaria a
  // senha digitada); e sair da guia desliga a conta.
  await page.goto("about:blank");
  await page.waitForTimeout(100);
  ok("sair da guia não deixa nada estourar", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ============================================================
//  7. NO CELULAR
// ============================================================
console.log("\n7. No celular (360)");
{
  const { ctx, page } = await abrir({ init: SIP_DE_MENTIRA, viewport: { width: 360, height: 740 } });
  await conectarDeMentira(page);
  const larg = await page.evaluate(() => document.documentElement.scrollWidth);
  ok("a tela cabe no celular sem rolar de lado", larg <= 360, `largura ${larg}`);
  await ctx.close();
}

ok("nenhum erro de JavaScript na página", estouros.length === 0, estouros.join(" | "));
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
