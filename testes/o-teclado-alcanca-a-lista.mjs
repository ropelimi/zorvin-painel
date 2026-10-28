// O TECLADO ALCANÇA A LISTA (auditoria de 28/10)
//
// Quem atende pelo teclado — por hábito, por um mouse que falhou, por um
// leitor de tela — chegava a metade dos gestos da coluna das conversas:
//
//   * ENTER E ESPAÇO NO ⌄ DA LINHA ABRIAM A CONVERSA, e não o menu. A linha
//     trata as teclas para abrir a conversa e chamava `preventDefault()` para
//     QUALQUER filho — inclusive o ⌄ e os itens do menu dele —, cancelando a
//     ativação do botão. E Fixar, Favoritar e Arquivar só existem nesse menu.
//
//   * ITENS CLICÁVEIS QUE O TAB NÃO ALCANÇAVA: a Mídia da barra (a única
//     entrada para o acervo), entrar e sair das arquivadas, os contatos e as
//     pessoas do Vantoro na "Nova conversa", a barra das mensagens fixadas, a
//     escolha do som do aviso e a caixinha de seleção das mensagens. Eram
//     `div` e `span` com `onClick`, sem foco.
//
// O QUE ESTA PROVA GUARDA: cada um recebe o foco e faz o seu gesto com o
// teclado — e o ⌄ abre o menu sem abrir a conversa.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const AGORA = Date.now();

// UMA CONVERSA PRÓPRIA no telefone que o painel abre: longa (para a barra
// das fixadas ter para onde rolar), com a primeira mensagem fixada e as duas
// últimas nossas (são as que se podem selecionar para apagar).
const NOME = "TECLADO DA PROVA";
const FIXADA = "MENSAGEM FIXADA DA PROVA DO TECLADO";
const SEMENTE = {
  contatos: [{ id: "ct-teclado", numero: "5511970008801", nome: NOME, vantoro_nome: null, nome_zorvin: null, foto_url: null }],
  conversas: [{
    id: "cv-teclado", advogado_id: "a7", contato_id: "ct-teclado", nao_lidas: 0, arquivada: false, fixada: false,
    favorita: false, ultima_atividade: new Date(AGORA + 600e3).toISOString(), ultima_mensagem: "até mais",
    frente: null, vantoro_nome: null, digitando_ate: null, esperando_desde: null,
    contato: { id: "ct-teclado", nome: NOME, numero: "5511970008801", foto_url: null },
  }],
  mensagens: Array.from({ length: 40 }, (_, i) => {
    const nossa = i >= 38;
    return {
      id: `m-tec-${i}`, conversa_id: "cv-teclado", origem: nossa ? "advogado" : "contato", tipo: "texto",
      texto: i === 0 ? FIXADA : (nossa ? `resposta nossa ${i}` : `linha ${i} da conversa longa`),
      criado_em: new Date(AGORA - (40 - i) * 60e3).toISOString(), fixada: i === 0,
      id_uazapi: `ID-TEC-${i}`, ...(nossa ? { enviado_por: "Rodrigo Sousa", enviado_por_id: "u1" } : {}),
    };
  }),
};

async function abrir({ vantoro = false } = {}) {
  const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  const estouros = [];
  page.on("pageerror", (e) => estouros.push(e.message));
  await page.addInitScript((d) => { globalThis.__SEMENTE = d.semente; }, { semente: SEMENTE });
  // A PONTE DE MENTIRA: com o Vantoro, a busca de cadastro devolve alguém.
  await page.route("**/ponte-de-mentira/**", async (rota) => {
    const caminho = new URL(rota.request().url()).pathname.replace("/ponte-de-mentira", "");
    if (caminho === "/vantoro/status") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, configurado: vantoro }) });
    }
    if (caminho === "/vantoro/buscar") {
      return rota.fulfill({ status: 200, contentType: "application/json",
        body: JSON.stringify({ ok: true, clientes: [{ id: "v-77", nome: "CLIENTE DO TECLADO", telefone: "5567999990077" }] }) });
    }
    return rota.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
  await page.goto(ENDERECO);
  await page.waitForSelector("[data-conversa-nome]", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { ctx, page, estouros };
}
/** Dá o foco ao elemento e diz se ele o recebeu — o Tab só para onde o foco
 *  pode ir. */
async function focar(page, alvo) {
  const el = typeof alvo === "string" ? page.locator(alvo).first() : alvo.first();
  if (!(await el.count())) return false;
  await el.focus().catch(() => {});
  return el.evaluate((n) => document.activeElement === n).catch(() => false);
}
const conversaAberta = (page) => page.locator("[data-topo-conversa]").count();
/** Clique GUARDADO: o que não existe (ou está coberto) reprova a conferência,
 *  e não estoura a prova. */
async function clicar(alvo) {
  if (!(await alvo.count())) return false;
  try { await alvo.first().click({ timeout: 3000 }); } catch (_) { return false; }
  return true;
}

// ==================================================================
console.log("\n1. O ⌄ da linha abre o menu pelo teclado — e não a conversa");
{
  const { ctx, page, estouros } = await abrir();
  const chevron = '[data-conversa-id="cv-teclado"] button[aria-label="Opções da conversa"]';
  ok("o ⌄ recebe o foco", await focar(page, chevron));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const menu = page.locator('[data-conversa-id="cv-teclado"] button', { hasText: "Fixar no topo" });
  ok("Enter abre o menu da conversa", (await menu.count()) === 1);
  ok("e não abre a conversa", (await conversaAberta(page)) === 0);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  ok("Enter de novo fecha o menu", (await menu.count()) === 0);
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  ok("e Espaço também abre", (await menu.count()) === 1);
  ok("ainda sem abrir a conversa", (await conversaAberta(page)) === 0);
  const favoritar = page.locator('[data-conversa-id="cv-teclado"] button', { hasText: "Adicionar aos favoritos" });
  ok("“Adicionar aos favoritos” recebe o foco", await focar(page, favoritar));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const favorita = await page.evaluate(() => !!(globalThis.__TABELAS.conversas.find((c) => c.id === "cv-teclado") || {}).favorita);
  ok("Enter nele favorita a conversa", favorita);
  ok("e a conversa continua fechada", (await conversaAberta(page)) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n2. As Mídias da barra");
{
  const { ctx, page, estouros } = await abrir();
  ok("o ícone das Mídias recebe o foco", await focar(page, '[title="Mídias, documentos e links"]'));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  ok("e Enter abre o acervo", (await page.locator("[data-aba-das-midias]").count()) > 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n3. Entrar e sair das arquivadas");
{
  const { ctx, page, estouros } = await abrir();
  ok("fui ao telefone de 1.200 conversas", await clicar(page.locator('[data-telefone="Arquivo"]')));
  await page.waitForTimeout(3000);
  const atalho = page.locator('[role="button"]', { hasText: "Arquivadas" });
  ok("a linha “Arquivadas” recebe o foco", await focar(page, atalho));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  ok("e Enter entra na pasta", (await page.locator("[data-vendo-arquivadas]").count()) === 1);
  ok("o “voltar” da pasta recebe o foco", await focar(page, "[data-vendo-arquivadas]"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  ok("e Enter sai dela", (await page.locator("[data-vendo-arquivadas]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n4. Os contatos e as pessoas do Vantoro na “Nova conversa”");
{
  const { ctx, page, estouros } = await abrir({ vantoro: true });
  ok("abri a “Nova conversa”", await clicar(page.getByRole("button", { name: "Nova conversa" })));
  await page.waitForTimeout(800);
  ok("um contato da agenda recebe o foco", await focar(page, "[data-contato-agenda]"));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  ok("e Enter abre a conversa dele", (await conversaAberta(page)) === 1);

  // Se o Enter não fechou a janela, o Esc fecha — senão ela cobre o botão.
  if (await page.locator("[data-contato-agenda]").count()) await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  ok("abri a “Nova conversa” de novo", await clicar(page.getByRole("button", { name: "Nova conversa" })));
  await page.waitForTimeout(600);
  await page.locator('input[placeholder="Pesquisar nome ou número"]').fill("CLIENTE DO TECLADO");
  await page.waitForTimeout(1800);
  const pessoa = page.locator('button, [role="button"]', { hasText: "CLIENTE DO TECLADO" });
  ok("a pessoa do Vantoro recebe o foco", await focar(page, pessoa));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2000);
  // A CONVERSA ABRE — e a janela fecha. O nome no alto não é conferido: a
  // bancada não junta o contato à conversa que nasce pela tela (o clique do
  // mouse mostra o mesmo "?"), e isso não é do teclado.
  ok("e Enter abre a conversa com ela", (await conversaAberta(page)) === 1
     && (await page.locator("[data-contato-agenda]").count()) === 0);
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n5. A barra das mensagens fixadas, e a caixinha de seleção");
{
  const { ctx, page, estouros } = await abrir();
  ok("abri a conversa longa", await clicar(page.locator('[data-conversa-id="cv-teclado"]')));
  await page.waitForTimeout(2000);
  const fixada = page.locator('[data-msg-id="m-tec-0"]');
  const longe = await fixada.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom < 0 || r.top > window.innerHeight;
  }).catch(() => null);
  ok("a mensagem fixada está fora da vista, lá em cima", longe === true, String(longe));
  // `button` OU `[role="button"]`: antes do conserto a barra era um `div` com
  // o papel escrito; depois, um botão de verdade.
  const barra = page.locator('button, [role="button"]', { hasText: FIXADA });
  ok("a barra das fixadas recebe o foco", await focar(page, barra));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1500);
  const perto = await fixada.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  }).catch(() => null);
  ok("e Enter leva até ela", perto === true, String(perto));

  // A SELEÇÃO PARA APAGAR: começa pelo "Apagar" de uma mensagem nossa.
  await page.locator('[data-msg-id="m-tec-39"]').hover({ timeout: 3000 }).catch(() => {});
  await page.locator('[data-msg-id="m-tec-39"] button[aria-label="Opções da mensagem"]').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(300);
  await page.locator('div[data-menu-msg] button', { hasText: "Apagar" }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
  const contador = () => page.getByText(/\d+ selecionadas?/).innerText().catch(() => "");
  ok("entrei no modo de seleção, com uma marcada", /^1 selecionada$/.test(await contador()), await contador());
  const caixinha = page.locator('[data-msg-id="m-tec-38"] [aria-label="Selecionar esta mensagem"], [data-msg-id="m-tec-38"] > span');
  ok("a caixinha da outra mensagem recebe o foco", await focar(page, caixinha));
  await page.keyboard.press(" ");
  await page.waitForTimeout(300);
  ok("e Espaço a marca", /^2 selecionadas$/.test(await contador()), await contador());
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

// ==================================================================
console.log("\n6. O som do aviso");
{
  const { ctx, page, estouros } = await abrir();
  await clicar(page.getByRole("button", { name: "Menu", exact: true }));
  await clicar(page.getByRole("button", { name: "Configurações" }));
  await page.waitForTimeout(400);
  ok("abri a aba Avisos", await clicar(page.getByRole("button", { name: "Avisos", exact: true })));
  await page.waitForTimeout(400);
  const antes = await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"));
  ok("(o som de agora não é o sino)", antes !== "sino", String(antes));
  ok("a opção do sino recebe o foco", await focar(page, '[data-som-opcao="sino"]'));
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  ok("e Enter a escolhe", (await page.evaluate(() => localStorage.getItem("zorvin_som_do_aviso"))) === "sino");
  ok("sem erro de JavaScript", estouros.length === 0, estouros.join(" | "));
  await ctx.close();
}

await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
