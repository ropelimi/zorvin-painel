// O VOLUME DOS AVISOS — medido, e não estimado.
//
// Quem escreve estes sons aqui não os ouve. O pato de 25/09 saiu com o volume
// no chute; em 28/09 o Rodrigo disse que o volume estava bom e o TIMBRE não —
// e pediu outras vozes para escolher.
//
// Para escolher timbre é preciso que todos toquem na MESMA altura. Em alturas
// diferentes ganha o mais alto, e não o que soa melhor: é o mesmo engano de
// uma sabotagem que o resto do sistema conserta sozinho, com outra roupa.
//
// Então esta prova RENDERIZA cada som num `OfflineAudioContext` — que devolve
// as amostras em vez de mandá-las para a caixa de som — e mede duas coisas:
//
//   RMS   quanto o som é alto em média, que é o que o ouvido chama de volume;
//   pico  a amostra mais forte, que é o que estoura e faz a pessoa pular.
//
// ELA USA `montarSom` DO PRÓPRIO PAINEL, e não uma cópia. Uma segunda escrita
// da receita aqui mediria um som que não é o que toca — o jeito de um teste
// não testar nada, e já aconteceu três vezes nesta casa.
import { abrirNavegador, ENDERECO } from "./navegador.mjs";

let falhas = 0, feitas = 0;
const ok = (nome, cond, det = "") => {
  feitas++;
  if (cond) console.log(`  ok   ${nome}`);
  else { falhas++; console.log(`  FALHA ${nome}${det ? " — " + det : ""}`); }
};

const nav = await abrirNavegador();
const ctx = await nav.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
await page.goto(ENDERECO);
await page.waitForSelector("[data-conversa-nome]");

// A MEDIÇÃO RODA DENTRO DA PÁGINA, onde o módulo do painel existe de verdade.
//
// `comGravacao: false` força o caminho do ENCOSTO — a receita sintetizada que
// sai quando o arquivo não pode ser buscado. Sem medir os dois, a prova
// aprovaria um pato que emudece no dia em que a busca falhar.
const medir = (comGravacao) => page.evaluate(async (comGravacao) => {
  const mod = await import("/src/avisos.js");
  const taxa = 44100;
  const fora = [];
  for (const som of mod.SONS) {
    const rascunho = new OfflineAudioContext(1, 1, taxa);
    const gravado = comGravacao ? await mod.carregarGravado(rascunho, som) : null;
    if (!som.notas.length && !gravado) {
      fora.push({ id: som.id, rms: 0, pico: 0, vazio: true, gravado: false });
      continue;
    }
    const dura = mod.duracaoDoSom(som, gravado);
    const off = new OfflineAudioContext(1, Math.ceil(dura * taxa) + taxa / 10, taxa);
    mod.montarSom(off, som, 0, gravado);
    const buffer = await off.startRendering();
    const dados = buffer.getChannelData(0);
    let soma = 0, pico = 0;
    for (let i = 0; i < dados.length; i++) {
      const v = dados[i];
      soma += v * v;
      if (Math.abs(v) > pico) pico = Math.abs(v);
    }
    fora.push({ id: som.id, rms: Math.sqrt(soma / dados.length), pico, dura,
                gravado: !!gravado });
  }
  return fora;
}, comGravacao);

const medidas = await medir(true);
const semArquivo = await medir(false);

const por = {};
for (const m of medidas) por[m.id] = m;
const porEncosto = {};
for (const m of semArquivo) porEncosto[m.id] = m;

console.log("\nO que saiu da caixa de som (medido):");
for (const m of medidas) {
  console.log(`   ${m.id.padEnd(8)} rms ${m.rms.toFixed(5)}   pico ${m.pico.toFixed(4)}` +
              (m.gravado ? "   (gravação)" : "") +
              (m.vazio ? "   (sem som, de propósito)" : ""));
}

console.log("\n1. Todo som que promete barulho FAZ barulho");
{
  // A conferência mais boba desta prova, e a que pega o pior defeito: uma
  // receita com um `hz` errado ou um filtro que corta tudo sai MUDA, e na
  // tela ela continua parecendo uma opção. Quem a escolher fica sem aviso.
  const comSom = medidas.filter((m) => !m.vazio);
  ok("há sons para medir", comSom.length >= 5, `medi ${comSom.length}`);
  const mudos = comSom.filter((m) => m.rms < 0.001).map((m) => m.id);
  ok("nenhum deles saiu mudo", mudos.length === 0, mudos.join(", "));
  ok('e o "Sem som" saiu mudo mesmo', por.mudo && por.mudo.rms === 0,
     JSON.stringify(por.mudo));
}

console.log("\n2. O pato é a GRAVAÇÃO, e ela chega mesmo");
{
  // A CONFERÊNCIA QUE PEGA O DEFEITO MAIS BOBO E MAIS CARO: o arquivo não
  // sair na publicação. Sem ela, o pato viraria o bipe sintetizado em
  // produção e passaria despercebido aqui — o encosto funciona bem demais
  // para ser notado.
  ok("o arquivo do pato foi buscado e decodificado", por.pato.gravado === true,
     JSON.stringify(por.pato));
  ok("e ele produz som", por.pato.rms > 0.001, `rms ${por.pato.rms.toFixed(5)}`);
}

console.log("\n3. A gravação sai na MESMA altura do encosto sintetizado");
{
  // É a régua do volume, e ela se sustenta sozinha: o encosto é a receita que
  // o Rodrigo aprovou em 25/09 quanto ao VOLUME (o que ele reprovou foi o
  // timbre). Se a gravação sair mais alta, o dia em que a busca falhar vira
  // um susto ao contrário — e vice-versa.
  const razao = por.pato.rms / porEncosto.pato.rms;
  ok(`a gravação e o encosto têm o mesmo volume (${razao.toFixed(2)}x)`,
     razao >= 0.8 && razao <= 1.25,
     `gravação ${por.pato.rms.toFixed(5)} contra encosto ${porEncosto.pato.rms.toFixed(5)}`);
}

console.log("\n4. Sem o arquivo, o pato NÃO emudece");
{
  // O encosto inteiro numa conferência. Um aviso mudo é indistinguível de
  // "ninguém escreveu", que é o defeito que esta casa persegue desde 04/09.
  ok("o encosto sintetizado produz som", porEncosto.pato.rms > 0.001,
     `rms ${porEncosto.pato.rms.toFixed(5)}`);
  ok("e ele não veio de arquivo nenhum", porEncosto.pato.gravado === false,
     JSON.stringify(porEncosto.pato));
}

console.log("\n5. Nenhum aviso estoura o ouvido de quem atende");
{
  // O TETO EXISTE PARA O FUTURO, e não para hoje: um som novo com o volume
  // trocado de 0,2 para 2 passa em qualquer revisão de código e só é
  // descoberto por uma pessoa de fone, no susto. `1.0` é onde o áudio digital
  // satura — acima disso o som distorce, além de doer.
  const altos = medidas.filter((m) => m.pico > 0.9).map((m) => `${m.id} (${m.pico.toFixed(2)})`);
  ok("nenhum chega perto de saturar", altos.length === 0, altos.join(", "));
  const maisAlto = medidas.reduce((a, b) => (b.rms > a.rms ? b : a));
  ok("e o mais alto de todos ainda é discreto", maisAlto.rms < 0.2,
     `${maisAlto.id} com rms ${maisAlto.rms.toFixed(4)}`);
}

console.log("\n6. O pato é UM grasnado, e não dois");
{
  // ESCRITA AO CONTRÁRIO DE PROPÓSITO. Este arquivo exigia DOIS grasnados
  // desde 25/09, por um raciocínio meu sobre um som que eu não ouço. Em 28/09
  // o Rodrigo ouviu e pediu um só. Invertida, a conferência é o que impede o
  // segundo de voltar numa limpeza futura — apagá-la deixaria a decisão dele
  // sem nada segurando.
  const soUm = (m) => m.dura > 0.15 && m.dura < 0.30;
  ok("a gravação toca uma vez só", soUm(por.pato), `${por.pato.dura.toFixed(2)}s`);
  ok("e o encosto também", soUm(porEncosto.pato), `${porEncosto.pato.dura.toFixed(2)}s`);
}

await ctx.close();
await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
