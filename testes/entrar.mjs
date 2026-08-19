// A TELA DE ENTRADA QUANDO A PONTE NÃO RESPONDE.
//
// O relato veio do celular: apertar Entrar, o botão girar por um minuto e
// aparecer "Load failed". Isso é o Safari dizendo, em inglês, que a conexão
// não completou — não diz o que houve nem o que fazer.
//
// E o que costuma haver é conhecido: a ponte roda no plano gratuito da Render
// e hiberna quando fica um tempo sem receber nada. A primeira entrada do dia
// acorda o servidor, e isso leva de trinta segundos a um minuto — mais do que
// o navegador do celular espera antes de desistir.
//
// Esta prova é a primeira a exercitar a tela de entrada. Ela existia desde o
// começo, é a primeira que a equipe vê todo dia, e é a única que fala com a
// ponte antes de haver sessão — e nenhuma prova passava por ela, porque a
// bancada sempre subiu logada.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

const PAGINA = ENDERECO;
let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 420, height: 820 } });
const page = await ctx.newPage();
const erros = [];
page.on("pageerror", (e) => erros.push("pageerror: " + e.message));

// Como a ponte vai se comportar nesta tentativa. Trocado entre uma seção e
// outra, é o que faz esta prova cobrir as três falhas diferentes sem precisar
// de três servidores.
let comoResponder = "ok";

/** Um bilhete assinado, como o que a ponte manda quando o Auth está fora.
 *  Não precisa de assinatura de verdade: quem confere a assinatura é o banco,
 *  lá do outro lado. O que a TELA faz com ele é o que está sendo provado. */
function bilheteDeMentira(segundos = 12 * 3600) {
  const agora = Math.floor(Date.now() / 1000);
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const corpo = {
    // O id é o da pessoa que a bancada conhece: com outro, a recarga abre o
    // painel na tela de "nenhum número liberado" e a conferência mediria a
    // falta de permissão em vez da sessão.
    sub: "u1",
    aud: "authenticated", role: "authenticated",
    email: "rodrigo.sousa@x",
    user_metadata: { nome: "Rodrigo Sousa", foto_url: null },
    app_metadata: { provider: "email" },
    iat: agora, exp: agora + segundos,
  };
  return { access_token: `${b64({ alg: "HS256", typ: "JWT" })}.${b64(corpo)}.assinatura`,
           expira_em: agora + segundos, usuario_id: corpo.sub };
}

await page.route("**/ponte-de-mentira/auth/login", async (rota) => {
  if (comoResponder === "muda")       return;            // nunca responde
  if (comoResponder === "sem-rede")   return rota.abort("failed");
  if (comoResponder === "senha-errada") {
    return rota.fulfill({ status: 401, contentType: "application/json",
      body: JSON.stringify({ ok: false, erro: "Usuário ou senha incorretos." }) });
  }
  // O AUTH NO CHÃO: a ponte não conseguiu o bilhete de uso único e mandou a
  // sessão que ela mesma assinou. Sem `token_hash` nenhum.
  if (comoResponder === "auth-no-chao") {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, token_hash: null, sessao: bilheteDeMentira(),
                             email: "rodrigo.sousa@x" }) });
  }
  // O CASO DO MEIO: a ponte conseguiu o bilhete, mas a troca aqui vai falhar
  // (são duas chamadas ao mesmo serviço doente, e falham separadas). Os dois
  // caminhos vêm na resposta.
  if (comoResponder === "os-dois") {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, token_hash: "hash-de-mentira",
                             sessao: bilheteDeMentira(), email: "rodrigo.sousa@x" }) });
  }
  // A SESSÃO JÁ VENCIDA — uma resposta que não serve para nada e que a tela
  // não pode aceitar em silêncio, senão a pessoa "entra" e é posta para fora
  // na primeira tela.
  if (comoResponder === "sessao-vencida") {
    return rota.fulfill({ status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, token_hash: null, sessao: bilheteDeMentira(-60) }) });
  }
  await new Promise((r) => setTimeout(r, 300));
  rota.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, token_hash: "hash-de-mentira" }) });
});

// A bancada sobe logada. Esta bandeira faz a sessão vir vazia, que é o que põe
// a tela de entrada na frente.
await page.addInitScript(() => { globalThis.__DESLOGADO = true; });
await page.goto(PAGINA);
await page.waitForSelector('button[type="submit"]');

const botao = page.locator('button[type="submit"]');
const aviso = page.locator('[role="alert"]');
const espera = page.locator('[role="status"]');

/** Volta para a tela de entrada limpa.
 *
 *  Depois de uma entrada que DÁ CERTO o botão fica desabilitado de propósito
 *  — no sistema de verdade a tela já trocou para o painel. Na bancada ela não
 *  troca, então a conferência seguinte encontraria um botão morto e o erro
 *  falaria do botão, e não do que estava sendo provado. */
async function recomecar() {
  await page.evaluate(() => { try { localStorage.removeItem("sb-bancada-auth-token"); } catch (_e) {} });
  await page.reload();
  await page.waitForSelector('button[type="submit"]');
}

async function tentarEntrar() {
  await page.locator("input").first().fill("rodrigo.sousa");
  await page.locator('input[type="password"]').fill("uma-senha-qualquer");
  await botao.click();
}

console.log("\nA tela de entrada aparece");
{
  const texto = await page.locator("body").innerText();
  ok("sem sessão, a tela de entrada é a que abre", /Usuário do Vantoro/i.test(texto));
  ok("e o botão está pronto", await botao.isDisabled() === false);
}

console.log("\nOs campos não dão zoom na tela do celular");
{
  // O Safari do iPhone dá zoom na página inteira ao focar um campo com letra
  // menor que 16px — e não desfaz ao sair dele. Aqui são dois campos, e são os
  // primeiros que a equipe toca todo dia: a tela ficaria torta antes mesmo de
  // alguém entrar.
  const pequenos = await page.evaluate(() =>
    [...document.querySelectorAll("input")]
      .filter((el) => el.getBoundingClientRect().width > 0)
      .map((el) => ({ tipo: el.type, tamanho: parseFloat(getComputedStyle(el).fontSize) }))
      .filter((c) => c.tamanho < 16));
  ok("usuário e senha com letra de 16px", pequenos.length === 0,
     pequenos.map((c) => `${c.tipo} ${c.tamanho}px`).join(", "));
}

console.log("\nQuando a ponte está acordando");
{
  // O caso do relato. Enquanto se espera, a tela tem de DIZER o que está
  // havendo: um botão girando sem fim é indistinguível de um travamento, e
  // quem fecha a página perde justamente a segunda tentativa, que entraria na
  // hora.
  comoResponder = "muda";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  ok("logo no começo não enche a tela de aviso",
     await espera.count() === 0,
     "a maioria das entradas responde em menos de um segundo");

  await page.waitForTimeout(3800);
  ok("passados alguns segundos, ela explica a espera", await espera.count() === 1);
  const t = (await espera.innerText()).replace(/\s+/g, " ");
  ok("e diz que é o servidor acordando", /dormindo|acordando/i.test(t), `dizia: "${t}"`);
  ok("e que da próxima vez é rápido", /rápido|minuto/i.test(t), `dizia: "${t}"`);
}

console.log("\nQuando ela não responde de jeito nenhum");
{
  // O limite é de 75 segundos em produção — mais do que a Render leva para
  // acordar. Na bancada são 6, senão esta prova levaria mais de um minuto e
  // ninguém a rodaria.
  await page.waitForTimeout(3500);
  ok("depois do tempo limite, desiste", await aviso.count() === 1,
     "sem limite, o botão gira para sempre e o navegador é que decide a mensagem");
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("em português", /servidor demorou/i.test(t), `dizia: "${t}"`);
  ok("dizendo o que fazer", /tente de novo/i.test(t), `dizia: "${t}"`);
  // O FATO, embaixo da frase: qual endereço e depois de quanto tempo. Sem
  // isso, todo relato de falha de rede volta como "não entrou", e não há por
  // onde começar a investigar.
  ok("e com o endereço que não respondeu e o tempo",
     /127\.0\.0\.1:5199/.test(t) && /\d+s/.test(t), `dizia: "${t}"`);
  ok("e o botão volta a poder ser apertado", await botao.isDisabled() === false,
     "desistir sem devolver o botão é pior do que não desistir");
  ok("o aviso da espera sai da tela", await espera.count() === 0);
}

console.log("\nQuando não há rede — o 'Load failed' do relato");
{
  comoResponder = "sem-rede";
  await tentarEntrar();
  await page.waitForTimeout(1500);
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("não mostra mais o texto do navegador",
     !/Load failed|Failed to fetch/i.test(t), `dizia: "${t}"`);
  ok("e sim uma frase em português", /não consegui falar com o servidor/i.test(t),
     `dizia: "${t}"`);
  ok("que manda conferir a conexão e a quem recorrer",
     /conexão/i.test(t) && /administra/i.test(t), `dizia: "${t}"`);
  ok("e diz onde não chegou, com o tempo",
     /127\.0\.0\.1:5199/.test(t) && /\d+s/.test(t), `dizia: "${t}"`);
}

console.log("\nQuando a ponte responde, ela é quem fala");
{
  // O tratamento novo não pode engolir a resposta do servidor: "senha errada"
  // e "não consegui falar" mandam a pessoa fazer coisas diferentes.
  comoResponder = "senha-errada";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  const t = (await aviso.innerText()).replace(/\s+/g, " ");
  ok("a mensagem da ponte é a que aparece", /senha incorretos/i.test(t), `dizia: "${t}"`);
  // E SEM O RASTRO TÉCNICO: aqui a rede funcionou. Endereço e tempo ao lado de
  // "senha incorreta" mandariam procurar problema onde não há.
  ok("e sem endereço nem tempo pendurados nela",
     !/127\.0\.0\.1:5199/.test(t), `dizia: "${t}"`);
}

console.log("\nQuando tudo dá certo — o caminho de todo dia");
{
  // ESTA CONFERÊNCIA NÃO EXISTIA, e a falta dela escondia um buraco: a
  // bancada não tinha `verifyOtp`, então a entrada que DÁ CERTO estourava e
  // caía na mensagem de "não consegui falar com o servidor". Um teste verde
  // sobre um caminho que nunca chegou a acontecer.
  await recomecar();
  comoResponder = "ok";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  ok("não sobra mensagem de erro na tela", await aviso.count() === 0,
     (await aviso.innerText().catch(() => "")).replace(/\s+/g, " "));
}

console.log("\nQuando o Auth do Supabase está fora do ar");
{
  // O 19/08. A ponte não conseguiu o bilhete de uso único e mandou a sessão
  // que ela mesma assinou. A tela tem de guardá-la e entrar.
  await recomecar();
  comoResponder = "auth-no-chao";
  await tentarEntrar();
  await page.waitForTimeout(1500);

  const guardada = await page.evaluate(() => {
    const cru = localStorage.getItem("sb-bancada-auth-token");
    if (!cru) return null;
    const s = JSON.parse(cru);
    return { temToken: !!s.access_token, temCampoDeRenovar: "refresh_token" in s,
             renova: !!s.refresh_token, expira: s.expires_at,
             id: s.user && s.user.id, nome: s.user && s.user.user_metadata
                                            && s.user.user_metadata.nome };
  });
  ok("a sessão assinada é guardada", !!guardada,
     "sem isto, o escritório fica na porta como ficou em 19/08");
  ok("com o bilhete dentro", guardada && guardada.temToken);
  ok("e dizendo quem é a pessoa", guardada && guardada.id === "u1",
     guardada ? String(guardada.id) : "");
  ok("com o nome que veio do Vantoro", guardada && guardada.nome === "Rodrigo Sousa",
     guardada ? String(guardada.nome) : "");
  // A biblioteca do Supabase EXIGE que este campo exista para considerar a
  // sessão válida — e ele tem de estar vazio, porque não há renovação: seria
  // mais uma chave de vida longa no navegador.
  ok("o campo de renovação existe", guardada && guardada.temCampoDeRenovar,
     "sem ele a biblioteca descarta a sessão como inválida");
  ok("e está vazio, porque não há o que renovar", guardada && !guardada.renova);
  ok("valendo por um expediente inteiro",
     guardada && (guardada.expira - Math.floor(Date.now() / 1000)) > 8 * 3600,
     guardada ? `faltavam ${Math.round((guardada.expira - Date.now() / 1000) / 3600)}h` : "");

  // E o painel abre depois da recarga, que é a prova de que a sessão guardada
  // vale de verdade e não é só um texto bonito no armário.
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  ok("e o painel abre", await page.locator("[data-conversa-nome]").count() > 0,
     "a recarga tinha de encontrar a sessão guardada e passar direto · a tela dizia: "
     + (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 160));
}

console.log("\nQuando a ponte consegue o bilhete mas a troca falha aqui");
{
  // O caso do meio, e o motivo de a resposta trazer os DOIS caminhos:
  // `generateLink` (na ponte) e `verifyOtp` (aqui) são duas chamadas ao mesmo
  // serviço doente, e elas falham separadas.
  await recomecar();
  await page.evaluate(() => { globalThis.__OTP_FALHA = true; });
  comoResponder = "os-dois";
  await tentarEntrar();
  await page.waitForTimeout(1500);
  const entrou = await page.evaluate(() => !!localStorage.getItem("sb-bancada-auth-token"));
  ok("o Auth recusando a troca, a sessão assinada assume", entrou,
     "sem a segunda chance, a entrada morreria com o bilhete na mão");
}

console.log("\nQuando a sessão que chega já veio vencida");
{
  await recomecar();
  await page.evaluate(() => { globalThis.__OTP_FALHA = false; });
  comoResponder = "sessao-vencida";
  await tentarEntrar();
  await page.waitForTimeout(1200);
  const guardou = await page.evaluate(() => !!localStorage.getItem("sb-bancada-auth-token"));
  ok("não guarda uma sessão vencida", !guardou,
     "guardar seria a pessoa 'entrar' e ser posta para fora na primeira tela");
  const t = (await aviso.innerText().catch(() => "")).replace(/\s+/g, " ");
  ok("e diz que não conseguiu abrir a sessão", /não consegui abrir a sessão/i.test(t),
     `dizia: "${t}"`);
}

console.log(`\nerros de página: ${erros.length}`);
erros.slice(0, 4).forEach((e) => console.log("   • " + e.slice(0, 160)));

await ctx.close();
await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
