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
const medidas = await page.evaluate(async () => {
  const mod = await import("/src/avisos.js");
  const fora = [];
  for (const som of mod.SONS) {
    if (!som.notas.length) { fora.push({ id: som.id, rms: 0, pico: 0, vazio: true }); continue; }
    const taxa = 44100;
    const dura = mod.duracaoDoSom(som);
    const off = new OfflineAudioContext(1, Math.ceil(dura * taxa) + taxa / 10, taxa);
    mod.montarSom(off, som, 0);
    const buffer = await off.startRendering();
    const dados = buffer.getChannelData(0);
    let soma = 0, pico = 0;
    for (let i = 0; i < dados.length; i++) {
      const v = dados[i];
      soma += v * v;
      if (Math.abs(v) > pico) pico = Math.abs(v);
    }
    fora.push({ id: som.id, rms: Math.sqrt(soma / dados.length), pico, dura });
  }
  return fora;
});

const por = {};
for (const m of medidas) por[m.id] = m;

console.log("\nO que saiu da caixa de som (medido):");
for (const m of medidas) {
  console.log(`   ${m.id.padEnd(12)} rms ${m.rms.toFixed(5)}   pico ${m.pico.toFixed(4)}` +
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

console.log("\n2. As três vozes novas do pato saem na altura do pato de hoje");
{
  // ESTA É A CONFERÊNCIA QUE A ESCOLHA EXIGE. O Rodrigo aprovou o VOLUME do
  // pato de hoje e reprovou o timbre; as candidatas têm de sair na mesma
  // altura, senão ele escolhe a mais alta achando que escolheu a melhor.
  const ref = por.pato.rms;
  for (const id of ["pato-grave", "pato-rouco", "pato-macio"]) {
    const razao = por[id].rms / ref;
    ok(`${id} está na altura do pato de hoje (${razao.toFixed(2)}x)`,
       razao >= 0.8 && razao <= 1.25, `rms ${por[id].rms.toFixed(5)} contra ${ref.toFixed(5)}`);
  }
}

console.log("\n3. Nenhum aviso estoura o ouvido de quem atende");
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

console.log("\n4. O pato continua sendo DOIS grasnados, e não um");
{
  // "quá-quá" se reconhece; "quá" sozinho, não. Isto se vê na duração: um
  // grasnado só terminaria perto de 0,18s.
  for (const id of ["pato", "pato-grave", "pato-rouco", "pato-macio"]) {
    ok(`${id} dura o bastante para dois grasnados`, por[id].dura > 0.3,
       `${por[id].dura.toFixed(2)}s`);
  }
}

await ctx.close();
await nav.close();
console.log(falhas ? `\n${falhas} de ${feitas} conferências FALHARAM.`
                   : `\n${feitas}/${feitas} conferências passaram.`);
process.exit(falhas ? 1 : 0);
