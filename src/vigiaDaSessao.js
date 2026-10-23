// ============================================================
//  A SESSÃO QUE ACABOU NÃO PODE DEIXAR O PAINEL ABERTO (22/10)
//
//  Medido nos registros do Supabase em 22/10: um navegador do escritório
//  passou das 09:57 às 16:35 pedindo coisas ao banco SEM sessão — 152
//  pedidos, todos recusados (401), com o papel "anon". A lista, as
//  etiquetas, as notas e a conversa aberta, nada carregava, e a tela
//  continuava sendo o painel: nada nela dizia que o acesso tinha acabado.
//
//  A biblioteca do Supabase devolve "sem sessão" SEM AVISAR em alguns
//  caminhos, e o `App` só trocava de tela quando ela avisava:
//
//    - a sessão assinada pela ponte (o caminho de 19/08, com o Auth fora do
//      ar) dura 12 horas e não tem com o que renovar, de propósito. Vencida,
//      a biblioteca ESTOURA ao tentar renovar (`AuthSessionMissingError`), e
//      não emite saída nenhuma;
//    - a renovação que tropeça na rede, com o bilhete já vencido: a
//      biblioteca guarda a sessão para tentar de novo e, enquanto isso,
//      responde "sem sessão" — e cada pedido sai com a chave pública;
//    - a sessão que some do armário por outro caminho.
//
//  Então o `App` passa a PERGUNTAR (`conferirSessao`), e não só a esperar o
//  aviso. As respostas são três, e a terceira é a que evita pôr para fora
//  quem está trabalhando por causa de um soluço:
//
//    "serve"   — há bilhete em dia; nada a fazer;
//    "acabou"  — a biblioteca diz que não há sessão, sem erro de rede no
//                meio, ou estoura dizendo que não há com o que renovar;
//    "talvez"  — a pergunta tropeçou na rede, ou não respondeu a tempo e o
//                que está guardado já venceu. Pode passar sozinho; só vira
//                "acabou" se durar (a tolerância fica no `App`).
//
//  A RÉGUA DE 19/08 CONTINUA VALENDO: o Auth é necessário para NASCER uma
//  sessão, e não para usá-la. Sem resposta a tempo, vale o que está guardado
//  neste navegador — com o bilhete em dia, ninguém sai.
// ============================================================
import { supabase } from "./supabase.js";

/** A sessão guardada no navegador, lida SEM REDE — a chave e o armário são
 *  os da própria biblioteca. `null` para tudo que não seja uma sessão com o
 *  bilhete em dia. */
export async function sessaoGuardadaSemRede() {
  try {
    const armario = supabase.auth && supabase.auth.storage;
    const chave = supabase.auth && supabase.auth.storageKey;
    if (!armario || !chave) return null;
    const cru = await armario.getItem(chave);
    if (!cru) return null;
    const guardada = typeof cru === "string" ? JSON.parse(cru) : cru;
    if (!guardada || !guardada.access_token) return null;
    // `expires_at` é em segundos, como o `exp` de dentro do bilhete.
    const ate = Number(guardada.expires_at || 0);
    if (!ate || ate * 1000 <= Date.now()) return null;
    return guardada;
  } catch (_e) {
    return null;
  }
}

/** Uma promessa que se resolve sozinha depois de `ms`, com `marca`. */
export function prazo(ms, marca) {
  return new Promise((resolve) => setTimeout(() => resolve(marca), ms));
}

/** O tropeço foi de REDE? É o único "sem sessão" que pode passar sozinho:
 *  a biblioteca guardou a sessão e vai tentar renovar de novo. */
function ehDeRede(erro) {
  return Boolean(erro) && (erro.name === "AuthRetryableFetchError"
    || /failed to fetch|network|fetch failed|load failed/i.test(String(erro.message || "")));
}

/** A biblioteca estourou dizendo que não há com o que renovar? */
function ehSemSessao(erro) {
  return Boolean(erro) && (erro.name === "AuthSessionMissingError"
    || /auth session missing/i.test(String(erro.message || "")));
}

/** A sessão ainda serve? Ver o alto deste arquivo. NUNCA estoura, e sempre
 *  responde dentro de `limiteMs`:
 *
 *    { estado: "serve",  sessao, motivo? }  — `motivo: "mudo"` quando quem
 *                                              respondeu foi o armário;
 *    { estado: "acabou", motivo }            — "sem-sessao" (nada guardado,
 *                                              a saída de sempre) ou
 *                                              "sem-renovacao" (havia sessão,
 *                                              e ela não tem como continuar);
 *    { estado: "talvez", motivo }            — "rede" ou "mudo".
 *
 *  O estouro que não é "sem sessão" vale como "não respondeu": é a régua de
 *  19/08, em que a pergunta ficou pendurada — o que está guardado decide. */
export async function conferirSessao(limiteMs) {
  const resposta = await Promise.race([
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        return { respondeu: true, sessao: (data && data.session) || null, erro: error || null };
      } catch (e) {
        return ehSemSessao(e) ? { respondeu: true, sessao: null, erro: e } : { respondeu: false };
      }
    })(),
    prazo(limiteMs, { respondeu: false }),
  ]);
  if (resposta.respondeu) {
    if (resposta.sessao && resposta.sessao.access_token) return { estado: "serve", sessao: resposta.sessao };
    if (ehDeRede(resposta.erro)) return { estado: "talvez", motivo: "rede" };
    return { estado: "acabou", motivo: resposta.erro ? "sem-renovacao" : "sem-sessao" };
  }
  // O Auth não respondeu a tempo: vale o que está guardado aqui.
  const guardada = await sessaoGuardadaSemRede();
  return guardada ? { estado: "serve", sessao: guardada, motivo: "mudo" } : { estado: "talvez", motivo: "mudo" };
}

/** Tira a sessão do armário da biblioteca, SEM REDE.
 *
 *  `signOut` não serve aqui: ele pergunta a sessão à biblioteca antes de
 *  sair — e é justamente a pergunta que está estourando ou voltando vazia —,
 *  e depois vai ao Auth avisar. A sessão que acabou só precisa sair daqui,
 *  para a próxima abertura não tentar usá-la de novo. */
export async function esquecerSessaoGuardada() {
  try {
    const armario = supabase.auth && supabase.auth.storage;
    const chave = supabase.auth && supabase.auth.storageKey;
    if (!armario || !chave) return;
    await armario.removeItem(chave);
    await armario.removeItem(`${chave}-user`);
    await armario.removeItem(`${chave}-code-verifier`);
  } catch (_e) { /* armário que não deixa apagar: a tela de entrada vem assim mesmo */ }
}

/** A falha de leitura PARECE de acesso vencido? Só para pedir uma
 *  conferência na hora, e não para concluir nada: `42501` também é o que
 *  recebe quem entrou e não tem permissão numa coluna (a armadilha nº 3), e
 *  quem decide é `conferirSessao`. */
export function pareceAcessoVencido(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  if (/^PGRST30[123]$/.test(codigo) || codigo === "42501") return true;
  return /jwt|auth session missing|authsessionmissing/i.test(`${erro.name || ""} ${erro.message || ""}`);
}

// ------------------------------------------------------------
//  OS PEDIDOS DE CONFERÊNCIA. O `App` confere de minuto em minuto e quando
//  a aba volta à frente; o painel pede uma conferência NA HORA quando uma
//  leitura falha com cara de acesso vencido — é ali que a pessoa está
//  olhando para uma tela que não carrega.
// ------------------------------------------------------------
const quemOuve = new Set();

export function ouvirPedidosDeConferencia(fn) {
  quemOuve.add(fn);
  return () => quemOuve.delete(fn);
}

export function pedirConferenciaDaSessao() {
  for (const fn of quemOuve) {
    try { fn(); } catch (_e) { /* um ouvinte ruim não cala os outros */ }
  }
}

// ------------------------------------------------------------
//  QUEM SAIU PORQUE QUIS. O "Sair" do painel emite a mesma saída que a
//  biblioteca emite quando a renovação é recusada de vez — e só a segunda
//  merece o recado na tela de entrada. Dizer "sua sessão terminou" a quem
//  acabou de apertar "Sair" seria a tela contando uma história que não
//  aconteceu.
// ------------------------------------------------------------
let saidaPedida = false;

export function marcarSaidaPedida() { saidaPedida = true; }

/** Lê e apaga a marca: ela vale para UMA saída. */
export function foiSaidaPedida() {
  const era = saidaPedida;
  saidaPedida = false;
  return era;
}
