// O ANEXO QUE NÃO VEM MAIS — dito na tela, em vez de "indisponível" para sempre.
//
// A conversa escrevia "indisponível" para duas coisas OPOSTAS: o arquivo que
// chega em dois minutos e o que não existe mais. Quem atende ficava esperando,
// recarregando, esperando mais — e no segundo caso esperava por nada, sem ter
// como saber que precisava pedir ao cliente que mandasse de novo.
//
// MEDIDO em 11/09, resgatando os anexos vazios do escritório. A rota que serve
// naquele servidor respondeu `400 {"error":"Message does not contain
// downloadable media"}` — a rota funcionando e dizendo que a mensagem não tem
// arquivo. A ponte passou a gravar essa resposta em `midia_erro`, e é dela que
// esta tela se serve.
//
// E TEM UM BURACO MAIOR AQUI DENTRO: imagem e vídeo sem arquivo não desenhavam
// NADA. A condição era `tipo === "imagem" && midia_url` — sem arquivo, a bolha
// saía vazia, nem moldura nem palavra. O cliente mandava uma foto e a conversa
// não mostrava que ele mandou. Cinco dos anexos vazios daquela medição eram
// imagens.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1400, height: 900 } });
const page = await ctx.newPage();

await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");
await page.locator("[data-conversa-nome]").first().click();
await page.waitForTimeout(1800);

const conversa = await page.evaluate(() =>
  document.querySelector("[data-conversa-nome]").getAttribute("data-conversa-id"));

/** Põe uma mensagem na conversa aberta pelo mesmo caminho do tempo real. */
const chegar = async (linha) => {
  await page.evaluate(([c, l]) => globalThis.__EMITIR("INSERT", "mensagens", {
    conversa_id: c, origem: "contato", criado_em: new Date().toISOString(), ...l,
  }), [conversa, linha]);
  await page.waitForTimeout(500);
};

const bolha = (id) => page.locator(`[data-msg-id="${id}"]`);
const textoDe = async (id) =>
  (await bolha(id).count()) ? (await bolha(id).innerText()).replace(/\s+/g, " ") : "";

const MOTIVO = 'Uazapi respondeu 400: {"error":"Message does not contain downloadable media"}';


console.log("\n1. O vazio que AINDA PODE encher continua como estava");
{
  // Sem `midia_erro`, nada mudou: o arquivo pode estar a caminho, e mandar
  // alguém pedir de novo seria pedir à toa — o documento chegaria dois minutos
  // depois e o cliente teria mandado duas vezes.
  await chegar({ id: "doc-esperando", id_uazapi: "doc-esperando", tipo: "documento",
                 midia_nome: "contrato.pdf", midia_url: null, midia_erro: null });
  const t = await textoDe("doc-esperando");
  ok("o documento sem resposta definitiva diz 'indisponível'",
     /indisponível/i.test(t), t);
  ok("e NÃO manda pedir de novo",
     !/reenviar/i.test(t), t);
}


console.log("\n2. O vazio que NÃO vem mais diz o que fazer");
{
  await chegar({ id: "doc-perdido", id_uazapi: "doc-perdido", tipo: "documento",
                 midia_nome: "procuracao.pdf", midia_url: null, midia_erro: MOTIVO });
  const t = await textoDe("doc-perdido");
  ok("a bolha diz que o arquivo não veio", /não veio/i.test(t), t);
  // A PARTE ACIONÁVEL. "Não veio" sozinho é a mesma notícia ruim de antes; o
  // que muda o dia de quem atende é saber que o gesto agora é pedir de novo.
  ok("e diz o gesto: pedir para reenviar", /peça para reenviar/i.test(t), t);
  ok("e a palavra 'indisponível' sai de cena", !/indisponível/i.test(t), t);
}


console.log("\n3. O motivo técnico NÃO vai para a bolha");
{
  // Ele é a pista de quem for investigar daqui a um mês, e é ruído para quem
  // está atendendo. Fica no `title`, a um passar de mouse.
  const t = await textoDe("doc-perdido");
  ok("a frase da Uazapi não aparece escrita na conversa",
     !/downloadable media/i.test(t), t);
  const titulo = await page.locator('[data-msg-id="doc-perdido"] [data-anexo-vazio]').getAttribute("title");
  ok("mas está guardada no rótulo, para quem procurar",
     /downloadable media/i.test(titulo || ""), String(titulo));
}


console.log("\n4. A IMAGEM SEM ARQUIVO deixa de ser uma bolha invisível");
{
  // Aqui não é uma frase melhor: é a diferença entre haver e não haver algo na
  // tela. Antes, `tipo === "imagem" && midia_url` fazia a bolha sair vazia — o
  // cliente mandou uma foto e a conversa não mostrava que ele mandou.
  await chegar({ id: "img-vazia", id_uazapi: "img-vazia", tipo: "imagem",
                 midia_url: null, midia_erro: null });
  const t = await textoDe("img-vazia");
  // O AVISO, E NÃO "ALGUM TEXTO". Esta conferência era `t.trim().length > 0`, e
  // passava com a bolha VAZIA: a hora da mensagem ("20:06") já é texto. Uma
  // sabotagem que apagou o desenho inteiro da imagem sem arquivo atravessou por
  // aqui incólume — as outras a pegaram, esta não. Agora ela procura o aviso,
  // que é a coisa cuja existência ela afirma.
  ok("a bolha da imagem sem arquivo tem o aviso, e não só a hora",
     (await bolha("img-vazia").locator("[data-anexo-vazio]").count()) === 1,
     `a bolha trouxe só: "${t}" — sem aviso, é o cliente mandando uma foto e a conversa não dizendo nada`);
  ok("dizendo que é uma imagem", /imagem/i.test(t), t);
  ok("e que ela está indisponível, porque ainda pode chegar",
     /indisponível/i.test(t), t);
}
{
  await chegar({ id: "img-perdida", id_uazapi: "img-perdida", tipo: "imagem",
                 midia_url: null, midia_erro: MOTIVO });
  const t = await textoDe("img-perdida");
  ok("e a imagem que não vem mais manda pedir de novo",
     /não veio/i.test(t) && /reenviar/i.test(t), t);
}


console.log("\n5. O mesmo vale para o áudio e o vídeo");
{
  await chegar({ id: "audio-perdido", id_uazapi: "audio-perdido", tipo: "audio",
                 midia_url: null, midia_erro: MOTIVO });
  const t = await textoDe("audio-perdido");
  ok("o áudio perdido manda pedir de novo", /não veio/i.test(t) && /reenviar/i.test(t), t);

  await chegar({ id: "video-perdido", id_uazapi: "video-perdido", tipo: "video",
                 midia_url: null, midia_erro: MOTIVO });
  const t2 = await textoDe("video-perdido");
  ok("o vídeo sem arquivo também aparece, em vez de sumir", t2.trim().length > 0,
     "o vídeo tinha o mesmo defeito da imagem: não desenhava nada");
  ok("e manda pedir de novo", /não veio/i.test(t2) && /reenviar/i.test(t2), t2);
}


console.log("\n6. O anexo que CHEGOU não vira aviso nenhum");
{
  // A metade que segura tudo: se a frase aparecesse também no anexo que veio,
  // a tela estaria pedindo para reenviar um documento que está ali, aberto.
  await chegar({ id: "doc-inteiro", id_uazapi: "doc-inteiro", tipo: "documento",
                 midia_nome: "extrato.pdf",
                 midia_url: "https://x.supabase.co/storage/v1/object/public/anexos/recebidos/doc-inteiro",
                 midia_erro: MOTIVO });
  const t = await textoDe("doc-inteiro");
  ok("com arquivo na mão, a bolha não fala em reenviar", !/reenviar/i.test(t), t);
  ok("e mostra o nome do documento", /extrato\.pdf/i.test(t), t);
}


await nav.close();
console.log(`\n${feitas - falhas}/${feitas} conferências passaram`);
process.exit(falhas ? 1 : 0);
