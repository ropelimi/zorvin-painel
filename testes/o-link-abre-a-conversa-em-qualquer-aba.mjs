// O LINK ABRE A CONVERSA, EM QUALQUER ABA.
//
// Relato de 22/10, sobre o Controle de atendimento do Vantoro: "quando eu
// clico no ícone do Zorvin, não está abrindo direto na conversa".
//
// O link (`?telefone=…&de=…`) trocava para o telefone certo e achava a
// conversa certa — e a direita dizia "Selecione uma conversa". A tela da
// direita não guarda a conversa aberta: ela a procura na LISTA carregada, e a
// lista é a da aba de agora. O painel abre sempre em "Em Atendimento"; o link
// de uma conversa em "Novos" ou em "Finalizados" não tinha onde ser achado. É
// quase todo link do Controle de atendimento, cuja primeira aba é "Novos".
//
// E não era só a aba: uma conversa da aba certa que não cabe na primeira
// página também não estava na lista, pelo mesmo caminho.
//
// O QUE ESTA PROVA VIGIA:
//   * a conversa abre, nas três situações, no telefone em que o painel abre e
//     noutro — e na aba DELA, que é onde ela mora;
//   * ela continua aberta depois que a lista se recarrega (a troca de aba
//     recarrega; uma recarga que a perdesse a fecharia segundos depois);
//   * a conversa antiga, fora da primeira página, também abre;
//   * nada é criado de novo: é a conversa que já existe;
//   * e a conversa aparece na lista da aba, e não só à direita;
//   * e o "Abrir neste telefone" do histórico do cliente, que é outra porta
//     para o mesmo lugar — e tinha o mesmo defeito.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const H = (n) => new Date(Date.now() - n * 3600e3).toISOString();
const contato = (id, numero, nome) => ({ id, numero, nome, vantoro_nome: null, nome_zorvin: null,
  vantoro_cliente_id: null, foto_url: null });
const conversa = (id, adv, ct, campos) => ({ id, advogado_id: adv, contato_id: ct.id, nao_lidas: 0, arquivada: false,
  fixada: false, favorita: false, frente: null, vantoro_nome: null, digitando_ate: null, tratada_em: null,
  esperando_desde: null, contato: { id: ct.id, nome: ct.nome, numero: ct.numero, foto_url: null }, ...campos });
const msg = (id, conv, origem, texto, criado_em) => ({ id, conversa_id: conv, origem, tipo: "texto", texto,
  criado_em, id_uazapi: `ID-${id}` });

// Os telefones: o painel abre no "Acordos 1"; o SAC é outro telefone, de outro
// departamento; o "Arquivo" tem centenas de conversas (a antiga mora longe).
const TEL = { a7: "5511911112222", a5: "5511969401932", a13: "5511900002222" };
const NOME = { aguardando: "NOVA", aberto: "EM ATENDIMENTO", finalizado: "FINALIZADA" };

const CT = {}, conversas = [], mensagens = [];
let n = 0;
function plantar(adv, situacao, horasAtras = 2) {
  const chave = `${adv}-${situacao}${horasAtras > 100 ? "-antiga" : ""}`;
  const c = contato(`ct-link-${chave}`, `55119800${String(++n).padStart(5, "0")}`, `${NOME[situacao]} DO ${adv}${horasAtras > 100 ? " ANTIGA" : ""}`);
  CT[chave] = { ...c, adv, situacao };
  conversas.push(conversa(`cv-link-${chave}`, adv, c, { situacao, protocolo: `P-${chave}`,
    ultima_atividade: H(horasAtras), ultima_mensagem: "oi",
    esperando_desde: situacao === "finalizado" ? null : H(horasAtras) }));
  mensagens.push(msg(`m-link-${chave}`, `cv-link-${chave}`, "contato", "oi", H(horasAtras)));
}
for (const adv of ["a7", "a5"]) for (const s of ["aguardando", "aberto", "finalizado"]) plantar(adv, s);
plantar("a13", "aberto", 5000);   // a antiga: centenas de conversas mais novas na frente dela

async function abrirPeloLink(chave, { esperar = 5000 } = {}) {
  const c = CT[chave];
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' }));
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, { contatos: Object.values(CT).map(({ adv, situacao, ...x }) => x), conversas, mensagens });
  await page.goto(`${ENDERECO}?telefone=${c.numero}&nome=${encodeURIComponent(c.nome)}&de=${TEL[c.adv]}`);
  await page.waitForTimeout(esperar);
  const estado = () => page.evaluate((id) => ({
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    aba: document.querySelector('[data-aba-da-situacao][data-aba-ativa="sim"]')?.getAttribute("data-aba-da-situacao") || null,
    selecione: document.body.innerText.includes("Selecione uma conversa"),
    naLista: [...document.querySelectorAll("[data-conversa-nome]")].filter((e) => e.offsetParent !== null)
      .map((e) => e.getAttribute("data-conversa-nome")),
    conversasDoContato: (globalThis.__TABELAS.conversas || []).filter((x) => x.contato_id === id).length,
  }), `ct-link-${chave}`);
  return { ctx, page, estouros, estado };
}

// ---- 1. as três situações, nos dois telefones ----
const casos = ["a7-aguardando", "a7-aberto", "a7-finalizado", "a5-aguardando", "a5-aberto", "a5-finalizado"];
// A LISTA VAZIA APROVARIA O VAZIO.
ok("são seis os casos conferidos", casos.length === 6, String(casos.length));
for (const chave of casos) {
  const c = CT[chave];
  const { ctx, estouros, estado } = await abrirPeloLink(chave);
  const e = await estado();
  ok(`${chave}: a conversa abre`, e.topo.includes(c.nome) && !e.selecione, JSON.stringify(e).slice(0, 300));
  ok(`${chave}: na aba dela`, e.aba === c.situacao, `aba ${e.aba}`);
  ok(`${chave}: e aparece na lista da aba`, e.naLista.includes(c.nome), JSON.stringify(e.naLista.slice(0, 5)));
  ok(`${chave}: nada foi criado de novo`, e.conversasDoContato === 1, String(e.conversasDoContato));
  ok(`${chave}: sem erro na tela`, estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ---- 2. ela continua aberta depois das recargas ----
{
  const { ctx, page, estado } = await abrirPeloLink("a5-finalizado");
  await page.waitForTimeout(5000);
  const e = await estado();
  ok("dez segundos depois, a conversa de outra aba continua aberta", e.topo.includes(CT["a5-finalizado"].nome) && !e.selecione,
     JSON.stringify(e).slice(0, 300));
  await ctx.close();
}

// ---- 3. a conversa antiga, fora da primeira página ----
{
  const { ctx, estado } = await abrirPeloLink("a13-aberto-antiga", { esperar: 7000 });
  const e = await estado();
  ok("a conversa antiga, longe da primeira página, também abre", e.topo.includes(CT["a13-aberto-antiga"].nome) && !e.selecione,
     JSON.stringify(e).slice(0, 300));
  ok("e não é criada de novo", e.conversasDoContato === 1, String(e.conversasDoContato));
  await ctx.close();
}

// ---- 4. o "Abrir neste telefone" do histórico do cliente ----
//
// A mesma tela da direita, a mesma lista recortada pela aba, outra porta: o
// histórico troca de telefone e abre a conversa que já existe ali. Relato de
// 22/10, na tela de Audiências do Vantoro: a conversa de audiência quase
// sempre está em "Finalizados" — o aviso do robô abre o atendimento, a equipe
// finaliza depois da confirmação. Aqui o cliente fala com o "Acordos 1", e no
// "Arquivo" a conversa dele já foi finalizada.
{
  const NO_ARQUIVO = "Pelo Arquivo: a audiência foi remarcada.";
  const cliente = contato("ct-hist", "5511980099999", "CLIENTE DO HISTORICO");
  const semente = {
    contatos: [...Object.values(CT).map(({ adv, situacao, ...x }) => x), cliente],
    conversas: [...conversas,
      conversa("cv-hist-a7", "a7", cliente, { situacao: "aberto", protocolo: "P-hist-a7",
        ultima_atividade: H(1), ultima_mensagem: "oi", esperando_desde: H(1) }),
      conversa("cv-hist-a13", "a13", cliente, { situacao: "finalizado", protocolo: "P-hist-a13",
        ultima_atividade: H(30), ultima_mensagem: NO_ARQUIVO })],
    mensagens: [...mensagens,
      msg("m-hist-a7", "cv-hist-a7", "contato", "oi", H(1)),
      { ...msg("m-hist-a13", "cv-hist-a13", "advogado", NO_ARQUIVO, H(30)), enviado_por: "Rodrigo Sousa" }],
  };
  // A ponte devolve o resumo do escritório inteiro, no formato de
  // `/historico/contato/:id`. Com `primeira`: o histórico só lista o telefone
  // em que a equipe já escreveu.
  const ponte = (r) => {
    const linhas = [
      { conversa_id: "cv-hist-a7", advogado_id: "a7", primeira: { enviado_por: "Rodrigo Sousa", criado_em: H(1) },
        ultima: { enviado_por: "Rodrigo Sousa", criado_em: H(1) } },
      { conversa_id: "cv-hist-a13", advogado_id: "a13", advogado_nome: "Arquivo", advogado_numero: TEL.a13,
        primeira: { enviado_por: "Rodrigo Sousa", criado_em: H(30) },
        ultima: { enviado_por: "Rodrigo Sousa", criado_em: H(30) } },
    ];
    const corpo = r.request().url().includes("/historico/contato/") ? { ok: true, linhas } : { ok: true };
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(corpo) });
  };
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.route("**/ponte-de-mentira/**", ponte);
  await page.addInitScript((s) => { globalThis.__SEMENTE = s; }, semente);
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const tela = () => page.evaluate(() => ({
    topo: document.querySelector("[data-topo-conversa]")?.innerText || "",
    aba: document.querySelector('[data-aba-da-situacao][data-aba-ativa="sim"]')?.getAttribute("data-aba-da-situacao") || null,
    selecione: document.body.innerText.includes("Selecione uma conversa"),
    // A BOLHA, e não o texto da página: a lista da aba também mostra a última
    // mensagem da conversa, e o texto passaria com a direita vazia.
    bolhaDoArquivo: Boolean(document.querySelector('[data-msg-id="m-hist-a13"]')),
  }));
  await page.locator('[data-conversa-nome="CLIENTE DO HISTORICO"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const antes = await tela();
  ok("histórico: a conversa do cliente abre no telefone de sempre", antes.topo.includes(cliente.nome) && !antes.selecione,
     `topo "${antes.topo.slice(0, 60)}"`);
  await page.locator('button[title^="Histórico de atendimento"]').first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const botao = page.locator('button:has-text("Abrir neste telefone")');
  const botoes = await botao.count();
  ok("histórico: oferece abrir no Arquivo", botoes === 1, `botões: ${botoes}`);
  await botao.first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(5000);
  const e = await tela();
  ok("histórico: a conversa finalizada do Arquivo abre", e.topo.includes(cliente.nome) && !e.selecione
     && e.bolhaDoArquivo, `topo "${e.topo.slice(0, 60)}", selecione ${e.selecione}, bolha ${e.bolhaDoArquivo}`);
  ok("histórico: na aba dela", e.aba === "finalizado", `aba ${e.aba}`);
  await page.waitForTimeout(5000);
  const depois = await tela();
  ok("histórico: e continua aberta depois das recargas", depois.bolhaDoArquivo && !depois.selecione,
     `selecione ${depois.selecione}, bolha ${depois.bolhaDoArquivo}`);
  ok("histórico: sem erro na tela", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
