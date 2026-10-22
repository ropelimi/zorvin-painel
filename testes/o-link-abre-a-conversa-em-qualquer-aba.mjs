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
//   * e a conversa aparece na lista da aba, e não só à direita.
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

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
