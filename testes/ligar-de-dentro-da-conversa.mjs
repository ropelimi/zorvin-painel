// LIGAR DE DENTRO DA CONVERSA (12/11) — o telefone do cabeçalho da conversa e
// a janela de chamada, com o visual do WhatsApp Web.
//
// Pedido do Rodrigo, depois de a primeira ligação pela Nvoip dar certo:
// "monte um visual onde possamos ligar por dentro da conversa", e "o visual
// deve ser o mais parecido possível com o WhatsApp Web".
//
// A biblioteca SIP é a de mentira (`__SIP_DE_MENTIRA`), a mesma metade da
// prova `as-ligacoes-de-teste`: o servidor da Nvoip não está ao alcance da
// prova, e a voz de verdade não se mede aqui. A conversa do SIP de verdade
// (o registro, o desafio da senha, o número na rede) já é provada lá, e a
// linha é a MESMA escrita (`useLinhaSip`).
//
// O que se confere aqui:
//   1. o telefone no cabeçalho (pintado, ao lado da lupa), só para quem
//      administra, e nunca num grupo;
//   2. a primeira ligação pede a conta, liga sozinha quando ela conecta, e a
//      senha não vai a lugar nenhum (o usuário fica guardado; a senha, não);
//   3. o número sai com o 55 e com o nono dígito;
//   4. a janela do WhatsApp: escura, a foto, o nome, "Chamando…", o relógio,
//      mudo, teclado e desligar;
//   5. minimizada numa pílula, a ligação continua com outra conversa aberta;
//   6. a segunda ligação da guia não pede a senha de novo;
//   7. a que não completou diz por quê, e oferece ligar de novo;
//   8. a ligação que chega;
//   9. no celular: pelo ⋮, e a janela na tela inteira.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};
const SENHA = "Senha#Secreta-9";
const USUARIO = "123456001";
const nav = await abrirNavegador();
const FOTOS = process.env.FOTOS_DA_LIGACAO || "";

const attr = async (page, sel, nome) => (await page.locator(sel).count()) ? page.locator(sel).first().getAttribute(nome) : null;
const texto = async (page, sel) => (await page.locator(sel).count())
  ? (await page.locator(sel).first().innerText().catch(() => "")).replace(/\s+/g, " ").trim() : "";
const clicar = async (page, sel) => {
  if (!(await page.locator(sel).count())) return false;
  return page.locator(sel).first().click({ timeout: 5000 }).then(() => true).catch(() => false);
};
const preencher = async (page, sel, valor) => {
  if (!(await page.locator(sel).count())) return false;
  return page.locator(sel).first().fill(valor, { timeout: 5000 }).then(() => true).catch(() => false);
};
const valor = async (page, sel) => (await page.locator(sel).count()) ? page.locator(sel).first().inputValue() : null;
async function esperarAttr(page, sel, nome, alvo, prazo = 8000) {
  const ate = Date.now() + prazo;
  let v = null;
  while (Date.now() < ate) {
    v = await attr(page, sel, nome);
    if (v === alvo) return v;
    await page.waitForTimeout(80);
  }
  return v;
}
const existe = async (page, sel, prazo = 5000) =>
  page.waitForSelector(sel, { timeout: prazo }).then(() => true).catch(() => false);
const sumiu = async (page, sel, prazo = 5000) =>
  page.waitForSelector(sel, { state: "detached", timeout: prazo }).then(() => true).catch(() => false);
/** O elemento está PINTADO no centro dele (nada por cima). */
const pintado = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return false;
  const topo = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return Boolean(topo && (topo === el || el.contains(topo)));
}, sel);
const foto = async (page, nome) => { if (FOTOS) await page.screenshot({ path: `${FOTOS}/${nome}.png` }).catch(() => {}); };

// A BIBLIOTECA DE MENTIRA — a da prova `as-ligacoes-de-teste`.
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
  S.naoAtende = () => { const s = S.sessoes.find((x) => !x.fim); if (s) s._acabar("failed", "Unavailable", "remote"); };
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

// TRÊS CONVERSAS PLANTADAS no telefone que o painel abre: a da cliente com o
// celular na forma antiga (sem o nono dígito), a de um fixo, e um grupo.
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

const AGORA = Date.now();
const antes = (min) => new Date(AGORA - min * 60000).toISOString();
const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null, vantoro_cliente_id: null, foto_url: null });
const CONTATOS = [
  contato("ct-lig-1", "557190012345", "MARIA LIGAÇÃO TESTE"),
  contato("ct-lig-2", "551133334444", "Escritório Fixo Teste"),
  contato("ct-lig-3", "grupo:120363000000000001", "Grupo Ligação Teste"),
];
const conversa = (n) => ({
  id: `cv-lig-${n}`, advogado_id: ADV, contato_id: `ct-lig-${n}`,
  nao_lidas: 0, arquivada: false, fixada: false, favorita: false,
  ultima_atividade: antes(n), esperando_desde: null, tratada_em: null,
  ultima_mensagem: "…", frente: null, digitando_ate: null, contato: CONTATOS[n - 1],
});
const SEMENTE = {
  contatos: CONTATOS,
  conversas: [1, 2, 3].map(conversa),
  mensagens: [1, 2, 3].map((n) => ({ id: `m-lig-${n}`, conversa_id: `cv-lig-${n}`, origem: "contato", tipo: "texto",
                                    texto: `Olá ${n}`, criado_em: antes(n) })),
};

async function abrir({ admin = true, largura = 1400, altura = 900 } = {}) {
  const ctx = await nav.newContext({ viewport: { width: largura, height: altura } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  // QUEM NÃO ADMINISTRA PRECISA DE PERMISSÃO NO TELEFONE: sem nenhuma linha
  // em `permissoes`, a bancada não deixa ver telefone nenhum.
  const semente = admin ? SEMENTE
    : { ...SEMENTE, permissoes: [{ id: 951, usuario_id: "u1", departamento_id: null, telefone_id: ADV }] };
  await page.addInitScript((b) => { globalThis.__SEMENTE = b.semente; globalThis.__SOU_ADMIN = b.admin; },
                           { semente, admin });
  // SEM VANTORO: a ficha fixa estreitaria a conversa, e a fila do cabeçalho
  // recolheria no ⋮ sem nada a ver com o telefone.
  await page.route("**/ponte-de-mentira/**", (rota) => {
    const url = new URL(rota.request().url());
    const json = (status, corpo) => rota.fulfill({ status, contentType: "application/json", body: JSON.stringify(corpo) });
    if (url.pathname.endsWith("/vantoro/status")) return json(200, { ok: true, configurado: false });
    return json(404, {});
  });
  await page.addInitScript(SIP_DE_MENTIRA);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]");
  await page.waitForTimeout(1200);
  return { ctx, page, estouros };
}
async function abrirConversa(page, id) {
  const ok_ = await clicar(page, `[data-conversa-id="${id}"]`);
  if (!ok_) return false;
  return existe(page, "[data-nome-do-contato]", 8000);
}
const nomeAberto = (page) => texto(page, "[data-nome-do-contato]");
const SEM = (c) => `[data-ligacao-campo="${c}"]`;

// ============================================================
console.log("\n1. O telefone no cabeçalho");
{
  const { ctx, page, estouros } = await abrir();
  ok("a conversa da cliente abre", await abrirConversa(page, "cv-lig-1"));
  ok("o telefone aparece no cabeçalho, pintado", await pintado(page, "[data-ligar-na-conversa]"));
  ok("…e diz para quem liga", ((await attr(page, "[data-ligar-na-conversa]", "title")) || "").includes("MARIA LIGAÇÃO TESTE"),
     await attr(page, "[data-ligar-na-conversa]", "title"));
  const lado = await page.evaluate(() => {
    const t = document.querySelector("[data-ligar-na-conversa]");
    const l = document.querySelector('[aria-label="Buscar na conversa"]');
    if (!t || !l) return null;
    return { tel: t.getBoundingClientRect().right, lupa: l.getBoundingClientRect().left };
  });
  const larg = await page.evaluate(() => document.querySelector("[data-ligar-na-conversa]")?.getBoundingClientRect().width);
  ok("o telefone tem a largura que a conta do cabeçalho soma (40)", Math.round(larg) === 40, String(larg));
  ok("…logo antes da lupa, onde o WhatsApp Web o põe", lado && lado.tel <= lado.lupa && lado.lupa - lado.tel < 20, JSON.stringify(lado));
  const nomeLargura = await page.evaluate(() => {
    const el = document.querySelector("[data-nome-do-contato]");
    return el ? el.parentElement.getBoundingClientRect().width : 0;
  });
  ok("o nome do cliente continua com espaço (o piso de 230)", nomeLargura >= 230, String(nomeLargura));
  ok("nenhuma janela de ligação antes de ligar", (await page.locator("[data-ligacao], [data-ligacao-conta]").count()) === 0);
  // O TELEFONE SOMA À CONTA DE LARGURA DO CABEÇALHO: sem a parcela dele, a
  // fila ficaria escrita onde não cabe, e o nome do cliente cairia abaixo do
  // piso de 230 (o defeito da "ELANE GO…"). De 1000 a 1520, de 20 em 20 (a
  // conta da largura se refaz um instante depois de a janela mudar).
  const apertos = [], semTelefone = [];
  for (let w = 1000; w <= 1520; w += 20) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(450);
    const m = await page.evaluate(() => {
      const el = document.querySelector("[data-nome-do-contato]");
      return { nome: el ? el.parentElement.getBoundingClientRect().width : 0,
               tel: Boolean(document.querySelector("[data-ligar-na-conversa]")) };
    });
    if (!m.tel) semTelefone.push(w);
    if (m.nome < 230) apertos.push(`${w}: nome ${Math.round(m.nome)}${m.tel ? " (telefone solto)" : ""}`);
  }
  ok("de 1000 a 1520, o nome do cliente nunca fica abaixo de 230", apertos.length === 0, apertos.join("; "));
  ok("…e o telefone fica à vista em todas, como no WhatsApp", semTelefone.length === 0, semTelefone.join(", "));
  await page.setViewportSize({ width: 1040, height: 900 });
  await page.waitForTimeout(450);
  const recolhida = await page.evaluate(() => {
    const t = document.querySelector("[data-ligar-na-conversa]");
    const m = document.querySelector('[aria-label="Mais opções desta conversa"]');
    if (!t || !m) return null;
    return { distancia: m.getBoundingClientRect().left - t.getBoundingClientRect().right };
  });
  ok("com a fila recolhida no ⋮, o telefone fica ao lado dele", recolhida && recolhida.distancia >= 0 && recolhida.distancia < 20, JSON.stringify(recolhida));
  ok("…pintado", await pintado(page, "[data-ligar-na-conversa]"));
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.waitForTimeout(200);
  await abrirConversa(page, "cv-lig-3");
  ok("num grupo, não há telefone", (await nomeAberto(page)).includes("Grupo") && (await page.locator("[data-ligar-na-conversa]").count()) === 0,
     await nomeAberto(page));
  ok("nenhum erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}
{
  const { ctx, page } = await abrir({ admin: false });
  await abrirConversa(page, "cv-lig-1");
  ok("quem não administra não vê o telefone (a linha ainda é de teste)",
     (await nomeAberto(page)).includes("MARIA") && (await page.locator("[data-ligar-na-conversa]").count()) === 0);
  await ctx.close();
}

// ============================================================
console.log("\n2. A primeira ligação pede a conta, e liga sozinha");
const { ctx, page, estouros } = await abrir();
{
  await abrirConversa(page, "cv-lig-1");
  await clicar(page, "[data-ligar-na-conversa]");
  ok("sem a conta conectada, o clique pede a conta da Nvoip", await existe(page, "[data-ligacao-conta]"));
  ok("…dizendo para quem vai ligar", (await texto(page, "[data-ligacao-conta]")).includes("Ligar para MARIA LIGAÇÃO TESTE"));
  ok("…e nada foi discado ainda", (await page.evaluate(() => globalThis.__SIP.uas.length)) === 0);
  await foto(page, "1-conta");
  await preencher(page, SEM("usuario"), USUARIO);
  await preencher(page, SEM("senha"), SENHA);
  await clicar(page, "[data-ligacao-conectar]");
  ok("conectada, a janela da conta some", await sumiu(page, "[data-ligacao-conta]"));
  ok("…e a ligação sai sozinha", await existe(page, "[data-ligacao]"));
  const cfg = await page.evaluate(() => { const u = globalThis.__SIP.uas[0]; return u ? { uri: u.cfg.uri, temSenha: u.cfg.password === "Senha#Secreta-9", url: u.cfg.sockets[0].url } : null; });
  ok("a conta vai à biblioteca com o endereço da Nvoip", cfg && cfg.uri === `sip:${USUARIO}@app.nvoip.com.br` && cfg.temSenha
     && cfg.url === "wss://app.nvoip.com.br:7443", JSON.stringify(cfg));
  const alvo = await page.evaluate(() => (globalThis.__SIP.uas[0].chamadas[0] || {}).alvo);
  ok("o número sai com o 55 e com o nono dígito (557190012345 → 5571990012345)", alvo === "5571990012345", alvo);
  const guardado = await page.evaluate((s) => {
    const tudo = [];
    for (const area of [localStorage, sessionStorage]) for (let i = 0; i < area.length; i++) tudo.push(area.getItem(area.key(i)) || "");
    return { senha: tudo.some((v) => v.includes(s)), usuario: localStorage.getItem("zorvin-sip-usuario") };
  }, SENHA);
  ok("a senha não fica guardada no navegador", guardado.senha === false);
  ok("…e o usuário fica, para a próxima vez", guardado.usuario === USUARIO, String(guardado.usuario));
}

// ============================================================
console.log("\n3. A janela do WhatsApp");
{
  ok("a janela diz \"Tocando…\"", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "tocando")) === "tocando"
     && (await texto(page, "[data-ligacao] [data-ligacao-status]")) === "Tocando…", await texto(page, "[data-ligacao] [data-ligacao-status]"));
  ok("…com o nome do cliente", (await texto(page, "[data-ligacao-nome]")) === "MARIA LIGAÇÃO TESTE");
  ok("…e o número, escrito como se lê", (await texto(page, "[data-ligacao]")).includes("(71) 99001-2345"), await texto(page, "[data-ligacao]"));
  const visual = await page.evaluate(() => {
    const j = document.querySelector("[data-ligacao]");
    const r = j.getBoundingClientRect();
    const av = j.querySelector("[data-avatar-inicial], img");
    const desligar = j.querySelector("[data-ligacao-desligar]");
    const caixa = document.querySelector("textarea[data-campo]");
    const c = caixa ? caixa.closest("div").getBoundingClientRect() : null;
    return { fundo: getComputedStyle(j).backgroundColor, dir: window.innerWidth - r.right, topo: r.top,
             cobreACaixa: Boolean(c && r.bottom > c.top && r.left < c.right),
             largura: r.width, avatar: av ? av.getBoundingClientRect().width : 0,
             vermelho: desligar ? getComputedStyle(desligar).backgroundColor : null,
             redondo: desligar ? getComputedStyle(desligar).borderRadius : null };
  });
  ok("a janela é escura, como a chamada do WhatsApp", visual.fundo === "rgb(11, 20, 26)", visual.fundo);
  ok("…no alto, à direita, abaixo do cabeçalho, sem cobrir a tela inteira", visual.dir >= 16 && visual.topo >= 64 && visual.largura <= 340, JSON.stringify(visual));
  ok("…e sem cobrir a caixa de escrever (com a ligação no ar, a pessoa escreve ao cliente)", visual.cobreACaixa === false, JSON.stringify(visual));
  ok("…com a foto grande no meio", visual.avatar >= 90, String(visual.avatar));
  ok("…e o botão vermelho e redondo de desligar", visual.vermelho === "rgb(234, 0, 56)" && visual.redondo === "50%", JSON.stringify(visual));
  ok("a janela está pintada (nada por cima)", await pintado(page, "[data-ligacao-desligar]"));
  await foto(page, "2-tocando");
  await page.evaluate(() => globalThis.__SIP.atenderDoOutroLado());
  ok("atendida do outro lado, \"Em ligação\"", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "em_ligacao")) === "em_ligacao");
  await page.waitForTimeout(1300);
  ok("…com o relógio andando", /^00:0[1-9]$/.test(await texto(page, "[data-ligacao] [data-ligacao-status]")),
     await texto(page, "[data-ligacao] [data-ligacao-status]"));
  await clicar(page, "[data-ligacao-mudo]");
  ok("Mudo põe o microfone no mudo", (await attr(page, "[data-ligacao-mudo]", "data-ligacao-mudo")) === "sim"
     && (await page.evaluate(() => globalThis.__SIP.sessoes[0].gestos.some((g) => g[0] === "mute"))));
  await clicar(page, "[data-ligacao-mudo]");
  ok("…e tira do mudo", (await attr(page, "[data-ligacao-mudo]", "data-ligacao-mudo")) === "nao");
  await clicar(page, "[data-ligacao-teclado]");
  await clicar(page, '[data-ligacao-tecla="1"]');
  await clicar(page, '[data-ligacao-tecla="#"]');
  const dtmf = await page.evaluate(() => globalThis.__SIP.sessoes[0].gestos.filter((g) => g[0] === "dtmf").map((g) => g[1]).join(""));
  ok("o teclado manda as teclas (para a URA)", dtmf === "1#", dtmf);
  await foto(page, "3-teclado");
  await clicar(page, "[data-ligacao-teclado]");
  const fechar = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok("no meio da ligação, fechar ou recarregar a guia pergunta antes", fechar === true);
}

// ============================================================
console.log("\n4. Minimizada, a ligação continua com outra conversa aberta");
{
  await clicar(page, "[data-ligacao-minimizar]");
  ok("minimizar troca a janela pela pílula verde", await existe(page, "[data-ligacao-pilula]") && (await page.locator("[data-ligacao]").count()) === 0);
  ok("…com o nome e o relógio", (await texto(page, "[data-ligacao-pilula]")).includes("MARIA LIGAÇÃO TESTE")
     && /\d\d:\d\d/.test(await texto(page, "[data-ligacao-pilula]")), await texto(page, "[data-ligacao-pilula]"));
  ok("o telefone da conversa diz \"Voltar à ligação\"", (await attr(page, "[data-ligar-na-conversa]", "aria-label")) === "Voltar à ligação");
  const pil = await page.evaluate(() => {
    const p = document.querySelector("[data-ligacao-pilula]").getBoundingClientRect();
    const caixa = document.querySelector("textarea[data-campo]").closest("div").getBoundingClientRect();
    const cab = document.querySelector("[data-nome-do-contato]").getBoundingClientRect();
    return { cobreACaixa: p.bottom > caixa.top && p.left < caixa.right, abaixoDoCabecalho: p.top >= cab.bottom };
  });
  ok("a pílula não cobre a caixa de escrever nem o cabeçalho", pil.cobreACaixa === false && pil.abaixoDoCabecalho === true, JSON.stringify(pil));
  await foto(page, "4-pilula");
  await abrirConversa(page, "cv-lig-2");
  ok("abrindo outra conversa, a pílula continua", (await nomeAberto(page)).includes("Fixo") && (await page.locator("[data-ligacao-pilula]").count()) === 1);
  ok("…e a ligação também", (await page.evaluate(() => globalThis.__SIP.sessoes[0].fim)) === false);
  await clicar(page, "[data-ligar-na-conversa]");
  ok("ligar para outra pessoa no meio da ligação não disca", (await page.evaluate(() => globalThis.__SIP.uas[0].chamadas.length)) === 1);
  ok("…e diz que já há uma ligação", await page.waitForFunction(() => document.body.innerText.includes("Já há uma ligação em andamento"), null, { timeout: 4000 }).then(() => true).catch(() => false));
  ok("…trazendo a janela de volta", await existe(page, '[data-ligacao="em_ligacao"]'));
  await clicar(page, "[data-ligacao-minimizar]");
  await clicar(page, '[data-ligacao-pilula] [aria-label="Abrir a ligação"]');
  ok("a pílula abre a janela de novo", await existe(page, '[data-ligacao="em_ligacao"]'));
  await clicar(page, "[data-ligacao-desligar]");
  ok("Desligar encerra a ligação", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada")) === "encerrada");
  ok("…e a janela diz \"Ligação encerrada\" com a duração", /^Ligação encerrada · \d\d:\d\d$/.test(await texto(page, "[data-ligacao] [data-ligacao-status]")),
     await texto(page, "[data-ligacao] [data-ligacao-status]"));
  ok("…e some sozinha depois de uns segundos", await sumiu(page, "[data-ligacao]", 8000));
  const depois = await page.evaluate(() => { const e = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; });
  ok("depois da ligação, fechar a guia não pergunta mais", depois === false);
}

// ============================================================
console.log("\n5. A segunda ligação não pede a senha, e o fixo vai como está");
{
  await clicar(page, "[data-ligar-na-conversa]");
  ok("com a conta já conectada, liga direto", await existe(page, "[data-ligacao]") && (await page.locator("[data-ligacao-conta]").count()) === 0);
  const alvo = await page.evaluate(() => (globalThis.__SIP.uas[0].chamadas[1] || {}).alvo);
  ok("o fixo sai com o 55 e sem nono dígito (551133334444)", alvo === "551133334444", alvo);
  ok("…numa conta só (nenhuma segunda conexão)", (await page.evaluate(() => globalThis.__SIP.uas.length)) === 1);
  await page.evaluate(() => globalThis.__SIP.naoAtende());
  ok("a que não completou diz por quê", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada")) === "encerrada"
     && (await texto(page, "[data-ligacao] [data-ligacao-status]")).startsWith("O número não está disponível"),
     await texto(page, "[data-ligacao] [data-ligacao-status]"));
  await page.waitForTimeout(5600);
  ok("…e não some sozinha (o motivo fica para ler)", (await page.locator("[data-ligacao]").count()) === 1);
  await foto(page, "5-nao-completou");
  await clicar(page, "[data-ligacao-de-novo]");
  const de = await page.evaluate(() => (globalThis.__SIP.uas[0].chamadas[2] || {}).alvo);
  ok("\"Ligar de novo\" disca o mesmo número", de === "551133334444", de);
  await clicar(page, "[data-ligacao-desligar]");
  await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada");
  await clicar(page, "[data-ligacao-fechar]");
  ok("o X fecha a janela da ligação encerrada", await sumiu(page, "[data-ligacao]"));
}

// ============================================================
console.log("\n6. A ligação que chega");
{
  await page.evaluate(() => globalThis.__SIP.chegaLigacao("5511988887777"));
  ok("ela abre a janela, com Recusar e Atender", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "chegando")) === "chegando"
     && (await page.locator("[data-ligacao-atender]").count()) === 1 && (await page.locator("[data-ligacao-recusar]").count()) === 1);
  ok("…dizendo \"Ligação de voz recebida\"", (await texto(page, "[data-ligacao] [data-ligacao-status]")) === "Ligação de voz recebida");
  await foto(page, "6-chegando");
  await clicar(page, "[data-ligacao-recusar]");
  const g = await page.evaluate(() => globalThis.__SIP.sessoes[globalThis.__SIP.sessoes.length - 1].gestos);
  ok("Recusar responde ocupado (486)", g.some((x) => x[0] === "terminate" && x[1] && x[1].status_code === 486), JSON.stringify(g));
  await page.evaluate(() => globalThis.__SIP.chegaLigacao("5511977776666"));
  await esperarAttr(page, "[data-ligacao]", "data-ligacao", "chegando");
  await clicar(page, "[data-ligacao-atender]");
  ok("Atender atende", (await esperarAttr(page, "[data-ligacao]", "data-ligacao", "em_ligacao")) === "em_ligacao");
  await page.evaluate(() => globalThis.__SIP.desligarDoOutroLado());
  await esperarAttr(page, "[data-ligacao]", "data-ligacao", "encerrada");
  ok("nenhum erro de JavaScript na guia inteira", estouros.length === 0, estouros.join(" | "));
}
await ctx.close();

// ============================================================
console.log("\n7. A senha errada não liga, e Cancelar desfaz");
{
  const { ctx: c2, page: p2 } = await abrir();
  await p2.evaluate(() => {
    const UA = globalThis.__SIP_DE_MENTIRA.UA;
    UA.prototype.start = function () { setTimeout(() => this.emit("connecting", {}), 10); setTimeout(() => this.emit("registrationFailed", { cause: "Authentication Error", response: { status_code: 403 } }), 40); };
  });
  await abrirConversa(p2, "cv-lig-1");
  await clicar(p2, "[data-ligar-na-conversa]");
  await preencher(p2, SEM("usuario"), USUARIO);
  await preencher(p2, SEM("senha"), "errada");
  await clicar(p2, "[data-ligacao-conectar]");
  ok("a senha recusada é dita na janela da conta", await p2.waitForFunction(() => (document.querySelector("[data-ligacao-erro-da-conta]") || {}).innerText?.includes("recusou o usuário ou a senha"), null, { timeout: 5000 }).then(() => true).catch(() => false));
  ok("…e nada é discado", (await p2.evaluate(() => globalThis.__SIP.uas[0].chamadas.length)) === 0);
  ok("…e a janela fica, para corrigir", (await p2.locator("[data-ligacao-conta]").count()) === 1);
  await clicar(p2, '[data-ligacao-conta] [aria-label="Cancelar"]');
  ok("Cancelar fecha a janela da conta", await sumiu(p2, "[data-ligacao-conta]"));
  await c2.close();
}

// ============================================================
console.log("\n8. No celular (390)");
{
  const { ctx: c3, page: p3, estouros: e3 } = await abrir({ largura: 390, altura: 844 });
  await abrirConversa(p3, "cv-lig-1");
  ok("no celular, o telefone não ocupa o cabeçalho", (await p3.locator("[data-ligar-na-conversa]").count()) === 0);
  await clicar(p3, '[aria-label="Mais opções desta conversa"]');
  ok("…e mora no ⋮, escrito", (await texto(p3, "[data-ligar-item]")).includes("Ligar (voz)"));
  await clicar(p3, "[data-ligar-item]");
  await preencher(p3, SEM("usuario"), USUARIO);
  await preencher(p3, SEM("senha"), SENHA);
  await foto(p3, "7-celular-conta");
  await clicar(p3, "[data-ligacao-conectar]");
  ok("a ligação sai pelo ⋮", await existe(p3, "[data-ligacao]"));
  const r = await p3.evaluate(() => { const j = document.querySelector("[data-ligacao]").getBoundingClientRect(); return { l: j.width, a: j.height, w: innerWidth, h: innerHeight, rola: document.documentElement.scrollWidth > innerWidth }; });
  ok("a janela ocupa a tela inteira, como no WhatsApp do celular", r.l === r.w && r.a === r.h, JSON.stringify(r));
  ok("…sem a tela rolar de lado", r.rola === false);
  ok("os botões estão pintados", await pintado(p3, "[data-ligacao-desligar]"));
  await foto(p3, "8-celular");
  ok("nenhum erro de JavaScript", e3.length === 0, e3.join(" | "));
  await c3.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
