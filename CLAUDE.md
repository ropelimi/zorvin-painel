# CLAUDE.md — Zorvin Painel (a interface)

> Contexto do projeto para o Claude Code. Leia antes de qualquer alteração.

## Quem é o usuário

Rodrigo (@ropelimi), gerente comercial de um escritório de advocacia. **Não é desenvolvedor** — se descreve como leigo. Explique em linguagem simples, evite jargão, e dê o passo a passo em vez de assumir conhecimento de terminal, Git ou infraestrutura. Fala português (pt-BR).

## O que é o Zorvin

Central de atendimento de WhatsApp da equipe de **Acordos e Execução** do escritório, sob a marca **Ropelimi**. Vários atendentes usam um painel único para responder as conversas de **vários advogados** (hoje ~8, pode crescer até 20).

Sistema **separado** do Vantoro (dashboard comercial do mesmo usuário). Não compartilham banco, login nem código.

## Arquitetura (3 peças)

```
WhatsApp ⇄ Uazapi ⇄ [zorvin-bridge] ⇄ Supabase ⇄ [zorvin-painel]
                     (repo separado)              (ESTE REPO)
```

- **zorvin-painel** (ESTE REPO) — Vite + React. Interface estilo WhatsApp Web. Render **Static Site** (free, não dorme).
- **zorvin-bridge** — Node.js + Express no Render. Faz a ponte com a Uazapi (recebe webhooks, envia mensagens).
- **Supabase** — Postgres + Auth + Realtime + Storage.

## Este repositório

```
index.html
vite.config.js
package.json         — deps: react, @supabase/supabase-js, lucide-react
src/
  main.jsx           — entrada
  App.jsx            — decide entre Login e Painel (checa sessão do Supabase)
  Login.jsx          — e-mail + senha (Supabase Auth)
  Painel.jsx         — a tela principal (99% da lógica está aqui)
  supabase.js        — cliente Supabase (chave anon)
```

Variáveis de ambiente (Render → Static Site):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` — chave **anon** (pública, respeita RLS)
- `VITE_VANTORO` — `desligado` tira o Vantoro da entrada. **Opcional: sem ela,
  tudo como antes.** Ver "A entrada tem dois caminhos" abaixo.
- `VITE_VANTORO_WEB` — o endereço do Vantoro no navegador, para os links que
  abrem telas de lá (a ficha completa e o Controle de atendimento). **Opcional:
  sem ela vale `https://app.vantoro.com.br`.** Ver "O Controle de atendimento do
  Vantoro, a um clique" abaixo.

Build: `npm install && npm run build` · Publish directory: `dist`

**A PUBLICAÇÃO É AUTOMÁTICA.** A Render republica o site sozinha quando a
`main` recebe o merge — não há passo manual, e dizer ao Rodrigo para ir em
"Manual Deploy → Deploy latest commit" é mandá-lo fazer o que já foi feito.
Dito por ele em 25/09, depois de quatro entregas seguidas terminarem com esse
recado. Mesclou, está no ar; o que resta a pedir, quando faz diferença, é o
**Ctrl+Shift+R** — o navegador pode estar com a versão velha em cache.

**Com uma exceção medida em 14/10:** naquele dia a Render não publicou três
PRs da PONTE, e ninguém soube até a manhã seguinte. A regra continua — não
mande o Rodrigo fazer o Manual Deploy por rotina —, mas agora há onde
conferir: a aba **Atualizações do banco** diz qual versão da ponte está no ar,
e a faixa vermelha avisa quem administra quando a Render não publicou. O
Manual Deploy é o conserto quando ELA diz isso. Ver "Qual ponte está no ar".

## Como o painel funciona

- **Autenticação**: Supabase Auth (e-mail/senha). Usuários criados manualmente em Authentication → Users. "Confirm email" está desligado.
- **Seletor de advogado** no topo da coluna esquerda ("ATENDENDO COMO") — troca qual advogado está sendo atendido; a lista de conversas recarrega.
- **Lista de conversas**: `conversas` do advogado, ordenadas por `ultima_atividade`, com prévia e contador de não lidas.
- **Conversa aberta**: `mensagens` em ordem cronológica, bolhas verdes à direita (`origem = 'advogado'`) e brancas à esquerda (`origem = 'contato'`).
- **Realtime**: canal Supabase escuta INSERT em `mensagens` e UPDATE em `conversas` — mensagens novas aparecem sem recarregar.
- **Envio**: NÃO chama a Uazapi diretamente. Faz `insert` em `fila_envio` e a ponte cuida do resto.
- **Tema claro/escuro**: objeto `TEMAS` no topo do `Painel.jsx`, alternado pelo ícone lua/sol na barra lateral. Estilos são inline (sem Tailwind/CSS externo).
- **Avatares**: componente `Avatar` mostra `foto_url` se existir; senão a inicial com cor estável derivada do nome.

## A entrada tem dois caminhos — e o segundo é o que permite vender

A tela de entrada pedia **"Usuário do Vantoro"** e mandava usuário e senha para
a ponte, que perguntava ao Vantoro. Para o escritório isso é o certo: é lá que o
cadastro de pessoa mora, e manter duas listas de gente iguais é coisa que
ninguém faz por muito tempo.

Só que **isso era o portão**. Quem comprasse o Zorvin sem ter Vantoro não
conseguia nem abrir o programa — não era uma integração faltando, era a porta
trancada. Medido em 14/09: `src/Login.jsx` pedia o usuário do Vantoro e
`ponte.js` trocava aquilo pelo token de lá.

Com `VITE_VANTORO=desligado`, a senha é conferida pelo **Auth do próprio
Supabase** (`signInWithPassword`), com as contas criadas em Authentication →
Users. É o desenho original deste painel, de antes de o Vantoro entrar. **Sem a
variável, o padrão é `ligado`** e a tela do escritório não muda uma vírgula.

**E três frases mudam junto, porque duas passariam a mentir:**

- "Usuário do Vantoro" vira "E-mail" (e o campo vira `type="email"`, que no
  outro caminho recusaria "rodrigo.sousa" antes de sair da tela);
- "o servidor estava dormindo" é sobre a **ponte** hibernando na Render, e neste
  caminho a ponte não é chamada — repetir aquilo manda esperar por algo que não
  está acontecendo;
- "pode entrar normalmente: o seu login não depende desse serviço" **se
  inverte**. Com o Vantoro, quem confere a senha é ele, e o Auth calado não
  impede ninguém. Sem o Vantoro, quem confere a senha É o Auth — a frase antiga
  deixaria a pessoa repetindo a senha certa contra um serviço fora do ar até
  concluir que esqueceu a senha.

A ponte continua sendo acordada por `/ping` ao abrir a tela, e isso **não** é
resto do caminho antigo: depois de entrar, o painel fala com ela para etiquetas,
notas e fotos. O que não acontece mais é `/auth/login`, e é isso que a prova
confere — uma tela que diz "E-mail" e continua perguntando ao Vantoro por baixo
pareceria consertada e recusaria todo mundo.

**A linha da pessoa em `usuarios`** (quem ela é, se administra) era criada pela
ponte no login, com o que o Vantoro respondia. Sem Vantoro ela nasce por gatilho
no banco — `sql/automaticos/001-quem-entra-vira-gente.sql`, no repo da ponte —,
e **a primeira conta do banco nasce administradora**, senão ninguém nunca
administraria nada.

~~**Ainda em aberto:** sem Vantoro não há tela para cadastrar gente nem dar
permissão.~~ **Feito** — ver "A equipe sem Vantoro" logo abaixo.

Prova: `entrar-sem-vantoro`, que roda num **servidor próprio** servido com
`VITE_VANTORO=desligado` — ver `SEM_VANTORO` em `testes/rodar.mjs`. Uma bandeira
no navegador seria mais barata e provaria a bandeira: o caminho que a variável
liga continuaria sem ninguém nunca ter visto funcionar.

## A equipe sem Vantoro — a mesma aba, outra fonte

A aba **Atendentes** lia a lista de gente do Vantoro e gravava a permissão lá.
Sem Vantoro, o comprador entrava, era o único administrador e não tinha como
cadastrar mais ninguém: um sistema de atendimento em **equipe** com uma pessoa
só.

A aba **não ganhou uma versão paralela**. Ela aprende em qual dos dois mundos
está pelo **`com_vantoro`** que a PONTE devolve na própria lista — e não por uma
variável do painel. Quem tem as variáveis do Vantoro é a ponte; uma variável
própria aqui poderia ser posta em desacordo com as de lá, e a tela ofereceria
cadastrar gente num sistema que manda o cadastro para outro lugar, sem nada na
tela dizendo isso.

`comVantoro` começa em `null` de propósito. Começando em `true`, a tela piscaria
sem o botão a cada abertura no cliente sem Vantoro; em `false`, ofereceria por um
instante, no escritório, um botão que a ponte recusaria.

**O que aparece só sem Vantoro:** o botão *Adicionar pessoa*, e as chaves
*Administra o Zorvin* e *Conta ativa*. Com Vantoro, `admin` é espelhado do
superusuário de lá a cada entrada — uma chave aqui seria desfeita na entrada
seguinte, sem nada dizendo por quê, e chave que volta sozinha é pior do que
chave nenhuma.

**O id da pessoa vai junto do login** em toda gravação. Sem Vantoro o login
nasce do pedaço do e-mail antes do arroba, e duas pessoas de domínios diferentes
podem ter o mesmo — mexer na permissão da pessoa errada é o engano que ninguém
percebe olhando a tela.

**Cadastrando alguém, a lista é RELIDA do servidor**, e a pessoa não é só
encaixada na tela: encaixar à mão mostraria alguém que talvez não tenha entrado
na lista de verdade, e o erro só apareceria na próxima abertura, longe da causa.

A mensagem de recusa do banco dizia "Só quem é administrador **no Vantoro**".
A regra lê `usuarios.admin`, que é a marca **do Zorvin** — com Vantoro ela é
espelhada de lá, sem Vantoro ela se marca nesta tela. A frase antiga mandava
quem não tem Vantoro procurar a chave num sistema que não usa.

~~**Ainda em aberto:** a aba "Notas no Vantoro" continua aparecendo mesmo sem
Vantoro.~~ **Feito** — ver "O que é do Vantoro some" logo abaixo.

Prova: `a-equipe-sem-vantoro`. Ela endereça as linhas da equipe por
`data-pessoa-da-equipe`, e não pelo nome: atrás desse painel está a lista de
conversas do escritório, cheia de gente com nome de gente — procurar por texto
acaba clicando numa conversa.

## O que é do Vantoro some quando não há Vantoro

Seis lugares da tela só existem por causa da integração. Sem Vantoro eles
ficavam lá: um botão que abre coluna vazia, um "Procurando no Vantoro…" que não
termina em nada, uma aba que não faz nada. Para quem compra o programa aquilo
não é integração de outro cliente — é o programa quebrado.

| Onde | Sem Vantoro |
|---|---|
| Ficha do cliente — botão da barra, item do menu ⋮ e a coluna | some |
| Busca de cadastro em "Nova conversa" | não é feita nem anunciada |
| Busca de cadastro dentro da busca geral | idem, e some o "Vendo no cadastro…" |
| Aba "Notas no Vantoro" | some |
| Processos que a nota oferece, e a nota que sobe para a ficha | somem |
| Link da Esteira ("por qual telefone falar") | nunca chega — degrada sozinho |
| Ícone do Controle de atendimento, na barra lateral (23/10) | some |

**Quem responde é a PONTE**, por `GET /vantoro/status` — que já existia, aberta
e com CORS, e nunca tinha sido chamada. Não é uma variável do painel, pela mesma
razão da aba de atendentes: uma variável daqui poderia ser posta em desacordo
com as de lá, e a tela esconderia a ficha numa instalação que tem Vantoro.

**Pergunta-se uma vez por abertura**, e não uma vez por tela: a promessa fica
guardada em `temVantoro.js`. Seis telas perguntando por si seriam seis idas à
rede para a mesma resposta, numa ponte que hiberna.

**São TRÊS estados, e não dois** — e é isso que evita repetir a armadilha nº 2:

| estado | a tela | por quê |
|---|---|---|
| `null` ainda não perguntei | esconde | é breve, e a resposta vem |
| `false` respondeu que não tem | esconde | é a verdade |
| `true` tem, **ou não consegui** | mostra | ausência no lugar de falha foi o que sumiu com as etiquetas em 04/09 |

Tratar a falha como "não tem" faria o escritório perder a ficha, a busca de
cadastro e a subida da nota sempre que a ponte tossisse, sem uma palavra na
tela. Mostrando, o pior caso é abrir a ficha e ler o erro da própria ponte — que
é uma frase, e não um sumiço.

**Um corte só, na origem.** `clienteDaConversa` e `nomeTravadoPeloCadastro` são
os dois valores derivados de onde saem todos os caminhos. Guardar cada uso
separado seria a mesma decisão escrita em seis lugares, para divergirem no
primeiro conserto.

**E não basta a coluna estar vazia.** Numa instalação que nunca teve Vantoro ela
está mesmo — mas num escritório que **desliga** o Vantoro os `vantoro_cliente_id`
e `vantoro_nome` de antes continuam gravados. Sem o corte, cada nota tentaria
subir para uma ficha que não existe e diria "não subiu agora, tente daqui a
pouco" para sempre; e o lápis de renomear continuaria sumido, mandando usar uma
ficha que agora está escondida — um beco.

**As três frases de erro de `chamarPonte` deixaram de dizer "Vantoro"**, e isso
já era errado antes: aquela função serve etiqueta, nota, foto, histórico e
permissões, e nenhuma passa pelo Vantoro. A etiqueta que não salvava dizia "não
consegui falar com o Vantoro", mandando procurar defeito no sistema errado. Quem
sabe que a chamada era para o Vantoro é a rota que falhou, e o `corpo.erro` da
ponte continua vindo na frente.

**Ainda em aberto:** sem Vantoro não existe ficha de cliente **nenhuma** — nem a
dele, nem uma do Zorvin. Esta etapa esconde; construir a ficha própria (nome,
CPF, telefones, anotações, no banco do Zorvin) é decisão separada e ainda não
tomada.

Prova: `esconder-o-vantoro`. A cena do menu ⋮ roda numa janela **estreita** e
confere os dois mundos — o menu só existe abaixo de 768px, então uma conferência
numa janela larga passaria por não ter achado o menu, e não por o item ter
sumido.

## O Controle de atendimento do Vantoro, a um clique (23/10)

Pedido do Rodrigo: *"Preciso de um ícone que leve para a tela de Controle de
Atendimento, do Vantoro"* (`https://app.vantoro.com.br/cadastro/atendimento/`).
É a tela de lá que lista as conversas abertas pela ordem de quem espera há mais
tempo (ver `POST /vantoro/atendimento` no CLAUDE.md da ponte).

**Um ícone de fone na barra lateral** (`data-controle-de-atendimento`), embaixo
do de Mídias. É um **link**, e não uma tela daqui: abre o Vantoro numa **aba
nova**, com o login de lá, e o Zorvin continua aberto onde estava. Leva
`rel="noopener noreferrer"`, para a aba do Vantoro não alcançar a do Zorvin.

**Só com Vantoro**, pela régua dos três estados de `temVantoro.js`: some sem
Vantoro, espera escondido enquanto a ponte não responde, e aparece quando a
pergunta FALHA. É a armadilha nº 2: falha não é ausência.

**O endereço do Vantoro mora num lugar só** (`enderecoNoVantoro`, em
`temVantoro.js`), e o link "Abrir ficha completa no Vantoro" passou a usá-lo.
Antes, sem `VITE_VANTORO_WEB` esse link simplesmente não aparecia. Daqui não dá
para ver se a variável está na Render, e o ícone pedido sumir por causa de uma
variável que ninguém sabe que existe seria o defeito mais difícil de achar.
**Sem a variável, vale o endereço do escritório.** Quem não tem Vantoro não vê
nenhum dos dois links, então esse endereço só é usado onde há o Vantoro do
escritório.

**O proxy desta sessão não alcança o painel no ar** (`zorvin.ropelimi.com.br`
dá 403), e por isso não deu para ler no arquivo publicado se a variável está
lá. O site do painel no ar foi achado pelos registros do Supabase, só lendo
(o `referer` dos pedidos).

Prova: `o-controle-de-atendimento-do-vantoro`, 19 conferências, com o Vantoro
de mentira respondendo a aba nova. **10 sabotagens e 10 pegas**, todas limpas,
rodadas em cópias e lidas uma a uma:

- o painel de antes inteiro (11 reprovações — é o pedido reproduzido);
- sem a guarda do Vantoro;
- o ícone aparecendo enquanto a ponte não respondeu;
- o caminho errado;
- abrindo na mesma aba (o Zorvin some);
- sem o `noopener`;
- sem o endereço padrão (`undefined/cadastro/…`);
- a ficha de antes (o link some sem a variável);
- o ícone sumindo no celular;
- a falha da ponte virando "não tem Vantoro".

**Fica de fora, e é decisão:** a troca do endereço pela variável não é
provada. `VITE_VANTORO_WEB` é lida quando o Vite serve a página, e a bancada
sobe sem ela; provar a troca pediria um servidor só para isso, como o do
`entrar-sem-vantoro`.

## A ficha virou uma coluna fixa — e antes ela ESCONDIA a lista

Pedido do Rodrigo em 28/09, com a tela do DataCrazy ao lado: o cadastro à
vista em toda conversa, numa terceira coluna.

**O que havia não era uma coluna escondida.** O botão da ficha TROCAVA a lista
de conversas pela ficha — eram duas colunas, não três. Quem quisesse ver o
cadastro perdia de vista a fila de quem está esperando, que é a tela inteira
do SAC. Por isso a conferência que mais importa nesta rodada não é *"a ficha
apareceu"*, e sim **"a ficha apareceu E a lista continua lá"**.

**E havia um segundo defeito, mais silencioso:** trocar de conversa FECHAVA a
ficha (um `setFichaAberta(false)` no efeito da conversa). Fixa, isso faria o
pedido valer só até o segundo clique.

### São DOIS estados, e não um — por causa do celular

Abaixo de 768px não cabem três colunas: lá a ficha toma a tela inteira, e
nascer aberta faria **abrir uma conversa mostrar o cadastro no lugar da
conversa**. Então:

| | o que vale |
|---|---|
| computador | `fichaFixa` — preferência guardada no navegador, padrão LIGADO |
| celular | `fichaAberta` — o gesto desta vez, que não se guarda |

`fichaVisivel` é derivado dos dois. **Derivar, em vez de corrigir um estado só
num efeito ao redimensionar**, é o que evita o piscar: girar o celular ou
encostar a janela nos 768px não faz a ficha abrir e fechar sozinha.

**A preferência é por navegador, como o som do aviso:** quem atende do monitor
grande quer a ficha à vista; quem atende do notebook de 1280 talvez não — ali
a conversa cai para ~510px. Padrão **ligado** (`!== "nao"`), pela mesma razão
da chave da tarja: ausência é "ninguém escolheu ainda", e o pedido era que ela
ficasse fixa.

**O "X" virou uma seta.** "Fechar" fazia pensar que ela não volta; ela é uma
coluna, como a lista. No celular continua um X, porque lá voltar é o gesto
natural. E **Esc não a recolhe no computador** — Esc fecha o que está POR
CIMA, e uma coluna não está.

### O cache de cinco minutos, e por que ele não é enfeite

Fixa, a ficha passa a consultar o Vantoro **em toda conversa aberta**: numa
manhã de trinta conversas são trinta idas, contra três ou quatro antes. E
essas idas são caras — o Vantoro fica atrás da ponte, que hiberna na Render, e
demora segundos (foi por isso que a ponte ganhou `/vantoro/tempos` em 14/09).

Cinco minutos sai do uso: quem atende volta à mesma conversa várias vezes
enquanto resolve um caso, e é essa ida repetida que o cache corta. Meia hora
seria mostrar cadastro velho depois de alguém tê-lo corrigido noutra tela.

**O botão Atualizar fura o cache**, senão passaria a devolver a resposta
guardada e pareceria quebrado justamente para quem sabe que o cadastro mudou
agora. **E toda gravação esquece a linha** — sem isso, salvar o CPF e voltar
cinco minutos depois mostraria o CPF antigo, a tela desmentindo o que a pessoa
acabou de fazer.

### Duas armadilhas de prova que esta rodada rendeu

**Abrir a ficha RENOMEIA a linha da conversa.** `ligarContatoAoCadastro` grava
o nome do cadastro no contato e a lista acompanha na hora — a conversa que se
chamava "Deus" passa a se chamar "ANDREIA CRISTINA MARTINS" no instante em que
a ficha carrega. Escrevi a prova endereçando por nome e ela ficou esperando
para sempre por um texto que a própria ficha tinha apagado. **Dentro da lista,
endereçar por posição ou por `data-`.**

**E `.count()` não mede o que se vê.** A sabotagem que devolvia o defeito — a
ficha escondendo a lista — **passou**, porque o painel esconde a coluna com
`display:none` e as linhas continuam no documento. É o mesmo engano registrado
em 16/09 na prova da busca, com outra roupa. Hoje a prova pergunta
`isVisible()`.

**E uma terceira, sobre o meu próprio script de sabotagem:** ele contava
linhas "FALHA" e dizia VAZOU para uma sabotagem que **derrubava a prova
inteira** com um estouro. Prova que estoura também reprovou — e eu quase fui
consertar o painel por causa disso.

Prova: `a-ficha-fica-fixa`, 17 conferências, 7 sabotagens e 7 pegas.

### E a conversa ganhou espaço, dois dias depois de a ficha chegar

Com a ficha fixa, o Rodrigo usou um dia e voltou com duas coisas.

**A lista encolheu de 380 para 360px — e eu tinha escrito 320.** Os 380 foram
medidos em 16/09, quando a tela tinha DUAS colunas; com três, a conversa tinha
caído para ~590px a 1360. Pus 320 afirmando neste arquivo que era *"o menor
valor que ainda não corta nada"*, **e a prova me desmentiu**: a 320 a marca
ficava com 96px para um nome que pede 134, e a tela voltou a dizer
**"Ropelimi Zo"** — o mesmo defeito registrado em 16/09, reintroduzido por eu
não ter medido de novo depois de encolher a coluna.

**Quem manda na largura da coluna é a LINHA DA MARCA**, e a conta é esta, a
1360:

| | px |
|---|---|
| a marca | 134 |
| "Nova conversa" + filtro de quem + menu ⋮ | 34 cada |
| a pílula da ordem, **sem o ícone** | 82 |
| quatro vãos de 3 | 12 |
| **total** | **330**, mais 20 de recheio = **350 de piso** |

**E a pílula da ordem NÃO tem largura fixa:** "Recentes" custa 53 de texto,
"Antigas" 44 e **"Esperando" 62**. Quem manda é a mais larga — medir com a de
hoje e concluir que cabe é o defeito voltando no dia em que alguém trocar a
ordem, sem ninguém ligar uma coisa à outra. A prova passou a somar a
diferença da mais larga antes de comparar.

**O ícone da pílula saiu**, e é ele que paga 17px dos 38 que faltavam. O que
não podia sair é a PALAVRA: o controle sempre escreve a ordem, contrato antigo
com prova própria. O enfeite era o desenho.

**Por que não dá para ir a 320:** não há de onde tirar os 38px. A fita de
filtros tem **18px livres** e a ordem pede 95; a linha da marca já está no
menor tamanho que o ponteiro acerta. Abaixo de 350 é preciso **tirar** algo do
topo, e isso é decisão do Rodrigo.

O número está num lugar só (`LARGURA_DA_LISTA`), porque duas provas o medem.

**E o cabeçalho da conversa invadia a ficha.** Relato com foto: a lupa da busca
aparecia POR BAIXO da coluna. Medido: o bloco do nome **já tinha encolhido a
zero** (na foto vê-se o avatar e nenhum nome) e os botões sozinhos passavam da
borda — os dois ESCRITOS, "Marcar como não lida" e "Já tratei", custam ~280px
dos ~550 que a fila precisa.

Apertado, os dois viram **ícone** (`cabecalhoApertado`). Não somem: continuam
com `title` e `aria-label`, e no celular continuam escritos dentro do menu ⋮.
A conta é de LARGURA, e não de medir o DOM — medir exigiria desenhar, medir e
redesenhar, e os rótulos piscariam a cada conversa aberta.

**E o `overflow: hidden` do cabeçalho é ENCOSTO, não o conserto.** Quem faz
caber é a conta acima; ele existe para que um botão novo, num dia em que
ninguém refez essa conta, seja **cortado na borda** em vez de ir pintar por
cima da ficha — que é o defeito relatado, e que ninguém lê como "falta espaço
aqui".

**E foi ele que fez uma sabotagem VAZAR.** Eu tinha escrito a conferência como
*"o cabeçalho termina antes de a ficha começar"* — e a sabotagem que nunca
aperta **passou**. Duas razões, e as duas dizem a mesma coisa: a fila é
`flex`, então faltando espaço ela **espreme o bloco do nome** em vez de
empurrar alguém para fora; e o que ainda sobrasse o `overflow` cortaria ali
dentro. A borda nunca tem como estourar.

**O que se mede é o NOME**, que é o que a foto mostrava: o avatar e nada ao
lado. Medido a 1280, com os rótulos escritos à força, o último botão terminava
**16px antes** da ficha e o nome tinha ficado com **39px** (apertado ele fica
com 166). É a régua de sempre desta casa — *medir a coisa certa, e não a coisa
próxima* —, e valeu para as duas provas que mediam a borda.

**E a 1360 com a ficha aberta o cabeçalho passou a ser o apertado** — a
conversa fica com 610px, abaixo dos 620. Os dois botões viram ícone, e o
bloco do nome ganha 246px em vez de 119. É a troca certa: o que está nesse
bloco é o número que o cliente vê chegar, e **responder pelo número errado
não tem desfazer**; o que os botões perdem é o rótulo à vista, que continua
no `title`, no `aria-label` e escrito por extenso no menu ⋮ do celular.

**A prova `lida` pegou isso, e ela estava certa.** Ela nasceu antes de existir
a terceira coluna e exige *"a palavra escrita, não só um tique"* a 1360. Hoje
ela roda as cenas de sempre com a ficha **recolhida** — onde a palavra cabe —
e ganhou uma cena com a ficha **aberta**, que confere o outro mundo: o botão
continua lá, continua clicável e continua DIZENDO a palavra. Sem essa cena,
apertar o cabeçalho poderia um dia virar "some o botão" sem nenhuma prova ver
diferença.

### E o cabeçalho passou a cortar coisa — dois relatos no dia seguinte

**O primeiro era o encosto que eu tinha acabado de pôr.** *"Quando clico em
marcar tags não estão aparecendo as tags, está com algum erro no layout."*
O `overflow: hidden` do cabeçalho recorta **todos** os descendentes, e os
menus ancorados nele são descendentes. **Medido:** o menu de etiquetas pedia
**139px de altura e mostrava 21** — só a faixa "MARCAR TAGS".

E ele **nunca chegou a ser necessário**: a fila é `flex` e, faltando espaço,
ela espreme o nome em vez de transbordar (é o que a própria medição de 28/09
já mostrava, com o último botão terminando 16px ANTES da ficha). O encosto só
cobrava. **Régua que fica: `overflow: hidden` não é encosto numa barra que
ancora menus** — ele não escolhe o que corta.

**O segundo:** *"com a ficha aberta o nome do cliente está sendo cortado"* —
a tela dizia **"ELANE GO…"**. E a medição mostrou um degrau que piorava:

| janela | conversa | rótulos | o nome recebia |
|---|---|---|---|
| 1280 | 528 | ícones | **166** |
| 1366 | 614 | ícones | 252 |
| 1440 | 688 | **escritos** | **199** |

**Alargar a janela de 1366 para 1440 PIORAVA o nome**, porque os rótulos
voltavam e custavam ~127px — tirados de quem não podia pagar. O teto de 620
decidia isso sem perguntar nada sobre o nome.

**Hoje a conta parte do nome**, que tem piso de **230px** (medido na fonte da
tela: "ANDREIA CRISTINA MARTINS" pede 225, "ELANE GOMES TEIXEIRA" 194). São
TRÊS formas, e é o piso que escolhe:

| espaço | a fila |
|---|---|
| sobra | os dois botões **escritos** |
| aperta | os mesmos, em **ícone** (`cabecalhoApertado`) |
| não cabe | **recolhe no ⋮** (`cabecalhoRecolhido`) |

```
1180 → conversa  428 | ⋮ recolhido | nome 344
1280 → conversa  528 | ⋮ recolhido | nome 444   (era 166)
1366 → conversa  614 | ícones      | nome 252
1440 → conversa  688 | ícones      | nome 326   (era 199)
1600 → conversa  848 | escritos    | nome 359
1920 → conversa 1168 | escritos    | nome 679
```

**Recolher NÃO é esconder, e essa é a decisão.** O menu ⋮ já existia no
celular com TODAS as ações escritas por extenso; trazê-lo para o computador
troca seis ícones mudos por um menu que diz o nome de cada coisa. O que não
podia continuar sendo espremido é o bloco do nome, porque é nele que está **o
número que o cliente vê chegar**.

**Uma cópia só**, pelo mesmo motivo do controle da ordem: o conteúdo do ⋮ é o
mesmo nos dois mundos. Duas escritas divergiriam, e divergir aqui é uma ação
existir num tamanho de janela e sumir no outro.

**E "recolher não é esconder" foi mais fácil de dizer do que de fazer.** A
prova `o-cliente-e-um-so` roda a 1280 e reprovou: o selo verde do histórico —
o que avisa que **outro telefone atende este mesmo cliente** — ficou de fora
do menu na primeira escrita. Recolhido, ele sumia, e duas pessoas voltariam a
atender a mesma pessoa sem saber uma da outra. Hoje o número vai junto do
item escrito. **Ao mover um controle para o menu, o que precisa ir junto é o
que ele DIZ, e não só o que ele faz.**

### O menu de filtros abria fora da tela

Terceiro relato do dia: *"ao clicar em Grupo e depois clicar novamente para
voltar para Todas as conversas, as opções estão cortadas"* — na foto, lia-se
"…versas", "…Concluída".

**Geometria, e só aparece com a fita QUEBRADA.** O menu era `right: 0`
ancorado na própria pílula. Com as 181 não lidas do escritório a fita quebra
em duas linhas e a pílula passa a começar colada na borda da coluna; um menu
de 250px que TERMINA ali começa fora da tela. **Medido, com a fita forçada a
quebrar: antes `left −63`, agora `left 72`.**

**E `left: 0` na pílula não serve:** com a fita numa linha só ela fica a
~258px da borda, e 258+250 estoura a coluna pelo outro lado. Quem ancora é a
**fita**, que tem a largura da coluna e não se move.

**O menu continua sendo FILHO da pílula no documento** — é isso que faz o
clique dentro dele contar como "dentro" e não fechar o que a pessoa acabou de
abrir. Mudou só o ponto de referência, via `position: relative` na fita.

### Três coisas que as provas me ensinaram nesta rodada

**`null < 70` é verdade em JavaScript.** A conferência de `a-ficha-fica-fixa`
perguntava `larguraDoMarcar < 70` para dizer "o botão virou ícone". Com o
botão recolhido no ⋮ aquilo virou `null < 70`, que é `0 < 70` — ela **passou
sem medir nada**. Hoje pergunta a FORMA, pelo nome.

**Eu escrevi uma conferência que proibia o comportamento certo.** Pedi que
alargar a janela nunca encolhesse o espaço do nome — mas de 1280 para 1366 o
nome cai de 444 para 252, e está certo: ali a fila sai do ⋮ e volta solta.
O que não pode é o nome abaixo do piso, ou a forma ANDAR PARA TRÁS. É isso
que está conferido.

**E um erro meu de processo, que quase me fez consertar o que não estava
quebrado:** rodei `cp src/Painel.jsx /tmp/P.bak` **enquanto** um lote de
sabotagens ainda escrevia nesse arquivo. O backup guardou uma sabotagem, e
todo "restaurar" depois disso a devolvia — a prova passou a reprovar falando
de um botão que a sabotagem tinha tirado. **Backup de sabotagem se tira antes
de começar, de uma cópia conferida, e nunca com outra rodada em voo.**

**E os cliques dela são GUARDADOS**, o que não é zelo: `locator.click()` num
elemento que não existe estoura a prova inteira depois de 30 segundos, e uma
prova que estoura não diz QUAL conferência pegou o defeito — some a lista
toda. Duas das cinco sabotagens tinham "pego" assim, e aquilo é uma pega que
não se pode ler.

Prova: `o-cabecalho-nao-corta-o-que-importa`, 25 conferências, **5 sabotagens
e 5 pegas** (3, 9, 2, 6 e 2 conferências reprovando, todas limpas). Ela mede
**o que está PINTADO** (`elementFromPoint`), e não o retângulo: foi exatamente
por isso que o menu de tags media 139px de altura enquanto a pessoa via 21 —
`getBoundingClientRect` não sabe que um ancestral está recortando.

### As observações do cadastro (01/10)

Pedido do Rodrigo em 30/09: *"Na Ficha do Vantoro, no Zorvin, precisa
aparecer as Observações também"*.

**Não precisou de nada no Vantoro nem na ponte.** Lido no código do Vantoro
antes de mexer: `Cliente.observacoes` já saía na ficha (`_resumo`) e já
estava em `CAMPOS_EDITAVEIS`; a ponte só repassa. O Zorvin simplesmente não
desenhava o campo.

**Uma seção própria, ABERTA**, que nasceu logo depois da identificação e
**subiu para o alto da ficha em 13/10**, a pedido do Rodrigo (ver "A ordem da
ficha", mais abaixo). É onde o escritório escreve o que não cabe em campo
nenhum, e observação que ninguém vê não serve de aviso — uma seção fechada
no fim da ficha seria o mesmo que não ter trazido o campo.

**Caixa de várias linhas** (`multilinha`), e não um campo de uma linha: as
observações vêm do Vantoro em parágrafos, e um `<input>` as juntaria numa
linha só — e gravaria assim de volta, apagando os parágrafos de quem
escreveu lá. A sabotagem que troca a caixa pelo campo de uma linha é pega
por cinco conferências.

**O campo que não veio não vira caixa vazia.** Um cadastro aberto sem a
chave desenharia a caixa em branco, e o que se digitasse ali SOBRESCREVERIA
no Vantoro as observações que existem e não chegaram. Então a ficha diz que
o campo não veio e não deixa editar — a régua das senhas, que para quem não
pode vê-las não vêm vazias: não vêm.

**Gravar manda só o que mudou**, pela conta que já existia (`salvar`):
editar a profissão não regrava as observações, e vice-versa.

Prova: `as-observacoes-na-ficha`, 21 conferências, **6 sabotagens e 6
pegas** (o campo que não existe; a seção fechada; o campo de uma linha; sem
a guarda da chave ausente; gravar mandando tudo; as quebras de linha
sumindo).

**Ainda em aberto, e é decisão:** o visual POR DENTRO da ficha não mudou. Ela
já é sanfonada como a do DataCrazy (hoje Observações, Identificação, Endereço
e Origem — a seção Acessos saiu em 13/10);
apertar as linhas em rótulo-e-valor na mesma linha foi deixado para depois de
o Rodrigo ver a coluna fixa na tela — em vez de eu adivinhar o que "parecido
com o DataCrazy" quer dizer por dentro.

### O que foi digitado na ficha não some na troca de conversa (09/10)

Relato do Rodrigo: *"quando eu salvo algo nas observações dentro da Ficha do
Vantoro, tudo o que eu escrevi não está ficando salvo depois que eu saio da
ficha e entro novamente"*.

**Gravar funcionava**, e isso foi conferido nos três lados antes de mexer: o
Vantoro grava `observacoes` (`editar`, `CAMPOS_EDITAVEIS`), a ponte repassa, e
a prova `as-observacoes-na-ficha` manda o texto inteiro. **O que se perdia era
o que NÃO tinha chegado a ser gravado**, por dois caminhos:

| o caminho | o que acontecia |
|---|---|
| escrever e trocar de conversa sem salvar | a ficha é REMONTADA a cada conversa (07/10), e o digitado ia junto, sem uma palavra — o "Salvar no Vantoro" fica depois de todas as seções, fora da vista de quem escreve nas observações, lá no alto |
| salvar e trocar de conversa ANTES de a gravação terminar | a ficha nova lia o cadastro de antes da gravação, mostrava o texto velho — e o guardava no cache de cinco minutos |

O segundo é exatamente *"saio e entro novamente, e não está salvo"* com o
texto **gravado** no Vantoro — e com a ponte hibernando, a gravação leva
segundos. **Foi a prova que o achou**, ao montar a cena da corrida.

**Hoje o que não foi salvo fica guardado, POR CADASTRO** (`rascunhosDaFicha`),
enquanto a página estiver aberta, e volta quando a ficha abre de novo — com a
frase *"Você deixou alterações sem salvar nesta ficha"*. **O botão de salvar
gruda no pé da coluna** (`data-salvar-ficha="pendente"`) enquanto há algo por
salvar, com **Descartar** ao lado, que pergunta; sem nada por salvar ele volta
a ser o botão de sempre, no lugar de sempre.

**Recolher a ficha não descarta mais, e por isso não pergunta** — a frase
antiga (*"fechar agora descarta o que foi digitado"*) passaria a mentir.
**Atualizar continua descartando, e perguntando**: é o gesto de trocar o
digitado pelo que está no Vantoro.

**Só na memória, e não no navegador:** a ficha tem as senhas do SERASA e do
GOV, e elas não podem ficar no disco de uma máquina do escritório. Recarregar,
fechar a aba ou sair com algo por salvar **pergunta antes** (`beforeunload`) —
de qualquer ficha, mesmo recolhida, porque o rascunho mora no módulo e não
nela.

**O rascunho é do cadastro, e não da conversa:** o da ANDREIA não aparece na
ficha do JOSÉ. **E só voltam os campos que vieram** no cadastro: o que não veio
não vira campo editável (a régua das observações de 01/10), e um rascunho não
pode furar isso.

**"Mudou" é UMA conta** (`camposMudados`): o que vai ao Vantoro ao salvar, o
que o rascunho guarda e quando o botão avisa. Três contas discordariam na hora
errada.

**A corrida tem duas peças, e as duas são provadas:**

- **o rascunho só some com a ficha montada**, quando ela vê o cadastro igual
  ao digitado — `salvar` não o apaga por conta própria. Se a ficha nova leu o
  cadastro de antes, é o rascunho que mantém o texto na tela, com o aviso;
- **a resposta perguntada antes de uma gravação não vai para o cache**
  (`geracaoDaFicha`: cada gravação conta uma, e a resposta que chega depois
  dela é usada pela tela que perguntou, sem ser guardada). E a gravação
  esquece o cache **ao começar e ao terminar**: só no começo, a leitura feita
  no meio dela seria guardada.

Prova: `a-ficha-guarda-o-que-nao-foi-salvo`, 44 conferências, com uma ponte de
mentira que demora (1,2 s para gravar, 2,5 s para ler) e devolve o cadastro
**como estava quando o pedido chegou** — o que um banco faz com uma leitura
começada antes da gravação. **12 sabotagens e 12 pegas**, todas limpas: o
painel de antes inteiro (23 reprovações — é o relato reproduzido); o rascunho
que não volta; o que não é guardado; `salvar` apagando o rascunho (a
corrida); recolher descartando; Descartar sem perguntar; o botão que não
gruda; sair sem perguntar; o rascunho de um cadastro aparecendo noutro; o
Atualizar que não descarta; a resposta de antes da gravação guardada; e a
gravação que só esquece o cache ao começar.

**A cena 3 da prova `ficha` foi INVERTIDA, e não apagada.** Ela exigia que
recolher a ficha com algo digitado perguntasse antes — certo quando recolher
descartava. Hoje ela confere que recolher NÃO pergunta e que o digitado VOLTA
ao abrir de novo: o que ela protege continua o mesmo, o digitado não sumir
sem aviso.

**E uma armadilha de prova que este conserto criou:** com algo por salvar,
recarregar a página pergunta antes (`beforeunload`), e o Playwright RECUSA
essa pergunta sozinho quando ninguém está ouvindo — o `page.reload()` da cena
seguinte esperou 30 segundos por uma página que não ia recarregar, e a prova
estourou. **Cena que deixa a ficha com algo por salvar descarta ao terminar**
(e tira antes o ouvinte de `dialog` que ficou sem uso, senão ele recusa a
pergunta do Descartar primeiro).

### A ordem da ficha: as senhas embaixo do nome, as observações no alto (13/10)

Pedido do Rodrigo: *"em 'Ficha no Vantoro', os acessos preciso colocar
embaixo do Nome completo do cliente, antes do E-mail. As Observações podem
ficar mais acima, antes da Identificação."*

**A ordem agora:** Observações → Identificação (… CPF, Nome completo,
**Senha SERASA, Senha GOV**, E-mail …) → Endereço → Origem. **A seção
"Acessos" saiu**: as duas senhas eram tudo o que ela tinha.

**O que muda para quem olha a tela:** para quem o Vantoro manda as senhas,
elas ficam à vista em toda ficha aberta. Antes era preciso abrir a seção.

**À vista, as senhas precisaram da guarda do campo que não veio.** O Vantoro
não manda as senhas a quem não pode vê-las (a régua de 01/10), e a ficha, no
lugar delas, desenhava uma caixa VAZIA e editável — escondida, até aqui,
numa seção fechada no fim da ficha. No alto, ela convidaria a digitar por
cima da senha que está lá, e o que se digitasse ia ao Vantoro ao salvar. Se
o Vantoro aceita essa gravação de quem não pode ver a senha, não conferi: o
código dele não estava ao alcance desta sessão. A guarda vale do mesmo
jeito.

**A senha que não veio é uma caixa cinza** escrita "Não veio do Vantoro", no
desenho do "WhatsApp desta conversa", que é o jeito da ficha de dizer "isto
não se edita aqui". O porquê vai no `title`. Uma frase de três linhas por
senha, no alto de toda ficha de quem não pode vê-las, seria ruído que se
aprende a pular.

**A conta da seção não conta o que não veio**: "3/7", e não "3/9". Contar
diria "falta preencher" sobre uma senha que talvez esteja lá. Seção sem nada
que se edite daqui não mostra conta.

**Só as senhas e as observações têm a guarda** (`naoVeio`). Estendê-la a
todo campo mudaria a ficha de quem recebe um cadastro sem alguma chave — e,
sem ler o Vantoro, não dá para saber quais chaves ele deixa de mandar.

Prova: `a-ordem-da-ficha`, 29 conferências, **11 sabotagens e 11 pegas**,
todas limpas, rodadas em cópias:

- a ficha de antes inteira (21 reprovações — é o pedido reproduzido);
- as senhas de volta numa seção fechada;
- as senhas depois do e-mail;
- as senhas antes do nome;
- as observações de volta para depois da identificação;
- sem a guarda das senhas;
- a conta contando o que não veio;
- a identificação nascendo fechada;
- a caixa cinza sem o porquê;
- salvar mandando tudo;
- a senha que não veio com a frase longa das observações.

A conferência de `as-observacoes-na-ficha` que pedia a seção logo depois da
identificação foi **INVERTIDA, e não apagada**.

## As palavras da casa — "advogado" não serve para todo comprador

O painel dizia **"advogado" em nove frases**. Para o escritório está certo; para
uma clínica, uma imobiliária ou uma equipe de vendas, o programa fala de uma
profissão que não é a deles.

**Onde elas ficam, medido em 15/09:** Configurações → *Importar histórico* e
Configurações → *Contatos*. **Não na primeira tela** — ela diz "ATENDENDO COMO"
e lista nomes de telefone. Escrevi a prova supondo o contrário e ela reprovou
três vezes, falando de um rótulo que não existe lá. Ao mexer nisso, **olhe onde
a palavra aparece de verdade antes de escrever a conferência.**

**Uma delas quase ficou para trás:** "No celular **do advogado**: abra a
conversa → ⋮ → Mais…". Um extrator de texto visível baseado em `>…<` não a
pegou, porque ela tem um `<b>` no meio. Varrer por `grep` de `advogado` foi o
que a achou — e é a frase da tela de instruções, onde o comprador mais presta
atenção.

**E o que NÃO se troca:** `origem === "advogado"` aparece vinte vezes no
`Painel.jsx` e é **valor gravado no banco** — é o que separa mensagem da equipe
de mensagem do cliente. Trocar junto quebraria as bolhas de todas as conversas.

A palavra mora em `zorvin_palavras` (script 003, no repo da ponte) e é trocada
numa seção da tela de administração — **não por SQL**, porque quem compra o
programa não cola SQL, e palavra que exige chamar o fornecedor para ser trocada
é palavra fixa.

**Sem a tabela, tudo como antes**: `vocabulario.js` cai em "advogado", e a seção
de administração nem aparece (sem a linha, o "Salvar" não teria o que
atualizar). Esta é a **única** leitura do painel que pode desenhar ausência sem
avisar, e por um motivo que não vale para nenhuma outra: a ausência aqui é uma
palavra igual à de sempre, e não um dado que sumiu.

**O gênero é guardado, não deduzido.** "o advogado" / "a médica", "dono" /
"dona", "selecionado" / "selecionada". Deduzir da terminação erraria em
"gerente", "assistente", "representante".

**"Processo" não entrou, e é decisão**: toda frase visível com essa palavra está
atrás de uma porta do Vantoro, que é o sistema do próprio escritório — onde a
palavra é sempre "processo". Um botão para trocá-la seria um botão que ninguém
pode usar.

**Sobra da etapa anterior, consertada junto:** a caixa de busca dizia "Buscar
por nome, mensagem, CPF ou processo", e CPF e processo vinham **só** do cadastro
do Vantoro (o que vai ao banco é nome, os dois nomes alternativos e número).
Escondido o cadastro, ela prometia duas coisas que não faz — e prometer busca
por CPF é pior do que não oferecer: quem digita o CPF e não acha conclui que o
cliente não está no sistema.

Prova: `o-vocabulario`.

## O aviso de mensagem nova — o som, e a quem ele interessa

Pedido da equipe em 15/09: poder **escolher o som**, e ser avisado **das
conversas em que a pessoa interagiu**.

**O que havia:** um bipe fixo de 880 Hz, e o aviso filtrado pelo **telefone
aberto** na barra lateral. A atendente que respondeu um cliente ontem na linha
do Dr. B não era avisada quando ele voltava a escrever — bastava ela estar
olhando a linha do Dr. A. O aviso chegava a quem estava **à vista**, e não a
quem estava **atendendo**.

### As regras (eram três; a do responsável entrou em 13/10)

| Situação | Avisa? | Por quê |
|---|---|---|
| Eu já respondi nessa conversa | **sim**, em qualquer telefone | é o pedido |
| **A conversa tem responsável** | **só o responsável** | é dele; ver "O aviso vai para o responsável (13/10)", mais abaixo |
| Outra pessoa atende | não | aviso que não pede ação de quem lê se aprende a ignorar, e aí o próximo passa batido junto |
| **Ninguém atendeu ainda, e sem responsável** | **sim, todo mundo** | é a primeira mensagem de um lead: sem dono, e sem aviso ela fica sem resposta |

A última é o **contrapeso**, decidida pelo Rodrigo: "só as minhas" ao pé da
letra calaria justamente a mensagem que ninguém pode perder.

**"Participei" sai das próprias mensagens** (`enviado_por_id`), e não de uma
função nova no banco — que exigiria um script a mais para rodar. No dia em que
isto foi escrito o Supabase estava fora do ar, o que deixa claro o valor de um
recurso de tela não depender de um passo manual.

**Uma pergunta por CONVERSA, não por mensagem**, guardada em
`deQuemEhAConversa`. E o próprio tempo real mantém o guardado em dia: quando um
colega responde, essa mensagem chega a todos os painéis, então dá para marcar
ali que a conversa deixou de ser órfã sem perguntar nada ao banco. Responder
marca na hora (`inserirNaFila`), porque o tempo real levaria segundos e nesse
intervalo o cliente pode responder.

**A leitura que falha AVISA assim mesmo.** Sem saber de quem é a conversa, o
erro barato é um som a mais; o caro é calar a mensagem de um cliente por causa
de uma oscilação de rede. É a armadilha nº 2 aplicada a um aviso.

### O som

`avisos.js`, cinco opções **sintetizadas pelo navegador** — nenhum arquivo,
nenhuma ida à rede. Um MP3 baixado por pessoa a cada abertura é a mesma conta
que zerou a franquia de banda e suspendeu o workspace em 21/08 (armadilha nº 6
do CLAUDE.md da ponte).

A escolha mora no **navegador** (`localStorage`), e não no banco: é preferência
de quem está sentado ali, e responde na hora mesmo com o banco fora do ar.
**"Sem som" não desliga o aviso**, só o barulho — a notificação e o selo
continuam, e é isso que separa a opção de simplesmente baixar o volume da
máquina.

### O pato, e a chave da tarja

Dois pedidos do Rodrigo em 25/09: um **som de pato**, e poder **desligar as
notificações** que aparecem quando chega mensagem.

**O pato obrigou a receita a crescer.** Os quatro sons eram frequências fixas;
um grasnado é uma **descida** de tom — começa agudo e cai depressa. Tocado como
os outros sai um bipe grave, que não é um pato. Entraram dois campos
**opcionais**: `ate` (a descida, por rampa exponencial na frequência) e
`filtro` (um passa-baixa que tira o áspero da onda dente de serra, que sozinha
soa mais a campainha quebrada do que a bicho). **Sem eles, os quatro sons de
sempre saem exatamente como saíam** — e a prova tem uma cena só para isso.

E são **dois** grasnados: "quá-quá" se reconhece, "quá" sozinho não.

Continua valendo o que já estava escrito aqui: **nenhum arquivo**. O pato é
sintetizado como os outros, e custa zero byte — um MP3 por pessoa a cada
abertura é a mesma conta que zerou a franquia de banda em 21/08.

**A chave da tarja NÃO é o "Sem som", e não podia ser.** "Sem som" tira o
barulho e deixa a notificação; a chave tira a notificação e deixa o barulho.
São duas incomodações diferentes — quem trabalha de fone quer o contrário de
quem senta numa sala silenciosa —, e uma opção só obrigaria a desligar as duas
para se livrar de uma. **O selo verde de não lidas continua nos dois casos:**
desligar o aviso é escolher não ser interrompido, não escolher não ser avisado.

**O padrão é LIGADO**, e a leitura é `!== "nao"`: armazenamento vazio (primeira
abertura, janela anônima, cache limpo) é "ninguém escolheu ainda", e isso
avisa. Tratar a ausência como desligado calaria justamente quem nunca pediu
para ser calado.

**A chave é perguntada dentro de `notificarDesktop`**, e não em quem chama: é a
única porta por onde a tarja sai, e num lugar só ela não é esquecida no dia em
que aparecer um segundo motivo para notificar. Ela lê o **armazenamento**, e
não um estado do React — a função vive fora do componente, e vale também para
uma segunda aba do Zorvin aberta na mesma máquina.

**A chave de liga/desliga virou `Chave.jsx`.** Ela morava dentro de
`Departamentos.jsx`; copiá-la para a tela de Avisos seria plantar a próxima
divergência, pela mesma razão que tirou `numeros.js` de dentro do painel.

### O "quac" — a segunda tentativa, e por que a primeira era um bipe

Relato do Rodrigo em 28/09: *"preciso que seja um 'Quac', que é mais parecido
com um pato mesmo"*. Ele estava certo, e dá para dizer o que faltava sem
recorrer a gosto — são **três** coisas que separam um grasnado de um bipe, e a
primeira receita tinha uma:

| | 1ª versão | agora |
|---|---|---|
| onda áspera | dente de serra | igual |
| **contorno do tom** | só **desce** (560→250) | **salta** 240→620 e despenca a 190 |
| **ressonância** | passa-**baixa** | passa-**faixa** em 1 kHz, Q 2 |

**O contorno é o que mais importa.** Num grasnado o tom pula para cima num
piscar e cai — a subida é o "qua", a queda é o "c". Só descendo, o ouvido lê
"bipe grave": é a mesma nota com outra pressa. O `pico` é alcançado em **12%**
da duração, e esse número é o que faz dela um SALTO; esticada, vira sirene.

**E o passa-baixa era o filtro errado para a tarefa.** Ele só abafava — tirava
o áspero e não punha nada no lugar. O que dá o timbre nasalado é uma
ressonância estreita perto de 1 kHz, que realça os harmônicos de cima e apaga
o resto: isso é passa-**faixa**, e o `Q` é a largura dela. O volume subiu
junto, e não é gosto: um passa-faixa joga fora quase toda a energia fora da
banda.

**O espião da prova precisou crescer junto, e nos dois pontos.** Ele guardava
`desceuAte` e **cada rampa sobrescrevia a anterior** — com duas rampas, a
subida ficava invisível. E contava filtros sem olhar o **tipo**, então
passa-baixa e passa-faixa eram a mesma coisa para ele. Sem as duas correções,
a prova aprovaria de volta exatamente o som que o Rodrigo pediu para trocar —
e a sabotagem confirma: devolvendo a receita antiga, as quatro conferências
novas reprovam.

**Um limite que fica escrito: quem escreve isto não ouve.** Dá para garantir
pelos números que a onda, o contorno e a ressonância são os de um grasnado;
não dá para garantir que soa como um. O julgamento é de quem aperta a prévia,
e o volume em especial foi estimado.

Prova: `o-pato-e-a-chave-do-aviso`, 31 conferências, 7 sabotagens e 7 pegas.
Ela **espiona o feitio do som**, e não só "tocou": contar osciladores diria que
houve som, e um bipe também é som — o que separa o pato é a onda, a descida e o
filtro, então é isso que fica registrado. E o vigia `provas-que-reprovam` pegou
uma conferência minha que usava `.every` sem conferir o tamanho: numa lista
vazia ela diria "não houve filtro" num cenário em que não houve nada.

### O pato virou uma gravação, e isso foi uma rendição medida

**Quatro tentativas de sintetizar um grasnado, quatro reprovadas** — e a
rodada das três vozes de uma vez saiu, nas palavras do Rodrigo, *"pior que o
primeiro"*.

A causa não é ajuste de número: um oscilador com filtro faz **tom moldado**, e
um grasnado de verdade é em boa parte **chiado**, que nenhum oscilador produz.
Insistir era continuar na família "campainha" gastando as tentativas de quem
tem de ouvir por mim. **Quando quem escreve o som não pode ouvi-lo, o caminho
é pedir o arquivo.**

**O arquivo que chegou não é o que foi usado.** Medido antes de mexer:

| | |
|---|---|
| duração | **3,0 s** — o grasnado vai de 0,22 s a 0,39 s |
| ou seja | **94% era silêncio** |
| canais | estéreo, inútil num aviso e o dobro do tamanho |
| pico | **0,94**, perto de estourar, contra 0,07–0,20 dos outros avisos |

Ficou: **185 ms, mono, 22 kHz, 8 KB**.

**E é um "quá" SÓ — decisão do Rodrigo, contra o que estava escrito aqui.**
Desde 25/09 este arquivo afirmava, em três lugares, que *"quá-quá se reconhece
e quá sozinho não"*. Era raciocínio meu sobre um som que eu não ouço; ele
ouviu a gravação repetida e pediu um só. As conferências foram **invertidas, e
não apagadas** — escritas ao contrário, são o que impede o segundo grasnado de
voltar numa limpeza futura. **O encosto perdeu o segundo junto**, senão a
falha do arquivo devolveria exatamente o que ele pediu para tirar, e ninguém
ligaria uma coisa à outra.

**Por que um arquivo não repete o desastre de 21/08.** Lá a franquia do
Supabase zerou porque cada atendente rebaixava fotos e áudios **das conversas**
de hora em hora. Aqui são 8 KB servidos pelo **próprio site** — não passa pelo
Supabase —, baixados uma vez e guardados pelo navegador até a próxima
publicação, **e só por quem escolhe o pato**: a busca acontece no primeiro
toque, não na abertura do painel. A régua que fica: **som de aviso pode ser
arquivo, desde que servido daqui, pequeno, e buscado só quando usado.**

**A receita sintetizada FICOU, como encosto.** Falhando a busca — rede caída,
publicação pela metade —, o aviso sai sintetizado em vez de não sair. Aviso
mudo é indistinguível de "ninguém escreveu".

**E os ids que saíram continuam sendo entendidos** (`APELIDOS`): quem tivesse
escolhido uma das três candidatas cairia no "Toque" em silêncio. Som trocado
sem avisar é pequeno e tem um sintoma que não aponta para a causa — "meu som
mudou sozinho".

#### O volume deixou de ser palpite, e me corrigiu DUAS vezes

Para comparar timbres é preciso que todos toquem na **mesma altura**: em
alturas diferentes ganha o mais alto, e não o melhor. Então `montarSom` saiu de
dentro de `tocarAviso`, e a prova `o-volume-dos-avisos` desenha **o mesmo
grafo** num `OfflineAudioContext` — que devolve as amostras em vez de
mandá-las para a caixa de som — e mede RMS e pico. Uma segunda escrita da
receita dentro da prova mediria um som que não é o que toca.

| o que eu estimei | o que era | erro |
|---|---|---|
| `pato-macio` a 0,16 | 0,077 | **2,08x alto** |
| a gravação a 0,12 | 0,051 | **2,35x alto** |

Duas vezes, e nas duas eu errei para o **mesmo lado**. Ouvido não se substitui
por intuição.

**A régua do volume se sustenta sozinha:** a gravação tem de sair na mesma
altura do **encosto**, que é a receita cujo volume o Rodrigo aprovou em 25/09
(o que ele reprovou foi o timbre). Assim o dia em que a busca falhar não é um
susto ao contrário.

E a prova põe um **teto** para o futuro (nada perto de saturar, nada acima de
0,2 de RMS): um som novo com o volume trocado de 0,2 para 2 passa em qualquer
revisão de código e só é descoberto por uma pessoa de fone, no susto.

Provas: `o-volume-dos-avisos` (12 conferências) e `o-pato-e-a-chave-do-aviso`
(37), com **5 sabotagens e 5 pegas**. A conferência que mais importa é *"e
NENHUM oscilador"*: o defeito mais provável agora é o arquivo não sair na
publicação, e **o encosto funciona bem demais para alguém notar sozinho**.

### A galinha — e a quinta tentativa de sintetizar bicho (01/10)

Pedido do Rodrigo depois do pato: vaca, porco, galinha e gato. **A galinha
ele mandou** (um trecho de 4,45 s do clipe "Pó Pó Pó", pedindo "um único
pó"); os outros três ele não tinha, e pediu que eu fizesse.

**Vaca, porco e gato foram reprovados — "não gostei dos sons" — e saíram.**
Desta vez não foram oscilador: foram sintetizados fora do navegador por
**fonte-e-filtro** (pulsos de pregas vocais com o tom subindo e caindo, as
ressonâncias da boca abrindo e fechando, aspereza e sopro), gravados em
arquivo, com o espectro conferido — o arco do "miau", o grave do mugido, as
fungadas do porco. **O feitio estava certo e não bastou.** É a quinta
tentativa de fabricar bicho nesta casa, depois das quatro do pato, e a régua
é a mesma de 28/09, agora sem exceção: **quem não ouve o som não o fabrica —
pede a gravação.** Serve qualquer coisa de onde se ouça o bicho (vídeo,
áudio de WhatsApp, desenho); cortar e limpar é comigo. A prova
`os-bichos-do-aviso` tem uma conferência para eles não voltarem do mesmo
jeito numa limpeza futura.

**Os arquivos foram mandados para ele ouvir ANTES de mesclar**, e é isso que
fica como processo: a reprovação chegou antes de ir para a equipe, e não
depois. (A primeira tentativa de mandar foi como anexo no chat, e ele
perguntou *"como vou ouvir se você ainda não mesclou?"* — o anexo passou
despercebido. Ao mandar som para ouvir, **diga onde ele está**.)

**A galinha é UM "pó", e SÓ A VOZ** — o segundo pedido dele, depois de ouvir
a primeira versão com a música por baixo. A música saiu por um **separador
de voz** (UVR, modelo `Kim_Vocal_2`, rodado pelo `audio-separator` com o
modelo baixado do GitHub), e não por filtro: a voz e as notas da música
ocupam as mesmas frequências, e filtro que tira uma tira a outra.

**E o separador corrigiu uma leitura minha.** O trecho tem dois "pó"
alternados, e eu supus que os dois eram a galinha. A faixa da voz trouxe só
o de ataque seco: **o "ó" grave era instrumento.** Dos sete "pó" da voz
ficou o de 0,91 s — o de mais voz e menos música no original (63%, contra
41% do que eu tinha usado na primeira versão) e que começa depois de
silêncio. **300 ms, mono, 22 kHz, 13 KB.** O trecho inteiro não foi para o
repositório. A receita era `sons/cortar-a-galinha.py`, que refazia o arquivo
**byte por byte** a partir da faixa da voz.

**O volume sai do pato**, que é o volume aprovado: a galinha toca a 1,08x a
altura dele, e o encosto na mesma altura do arquivo (0,99x). A prova
`o-volume-dos-avisos` deixou de conferir "o pato" e passou a conferir **todo
som que é arquivo**, lido da própria receita (`arquivo`): o próximo bicho
entra nas conferências sem ninguém lembrar de acrescentá-lo.

Prova: `os-bichos-do-aviso`, 19 conferências, **8 sabotagens e 8 pegas**
(o arquivo com nome errado; a galinha que some da lista; ela dez vezes mais
alta; o encosto vazio; o "Sem som" antes dela; a vaca sintetizada de volta;
a mensagem nova tocando o pato no lugar do escolhido; **o arquivo antigo,
com música**). A do nome errado importa porque o encosto toca no lugar, e
funciona bem demais para alguém notar sozinho.

**A última vazou primeiro, e ensinou o de sempre:** devolver a galinha com
música passava em tudo — mesma duração, mesmo tamanho, mesmo volume. O que a
separa da certa é o CONTEÚDO, e nenhuma medida de tela o vê. Hoje a prova
confere a **impressão digital** do arquivo que a receita faz; trocá-lo de
propósito é refazer pela receita e trocar o número na prova.

### A galinha e o gato gravados (02/10) — e por que o "pó" saiu

**O "pó" de 01/10 não ficou.** O Rodrigo pediu *"mais agudo"*; mandei três
versões (subindo 3, 5 e 7 semitons) e ele respondeu *"nenhuma ficou boa"* —
e mandou **outra gravação de galinha**, pedindo *"use ele"*. No meio do
trabalho mandou também **uma de gato**. As duas entraram nesta rodada, e o
miado sintetizado de 01/10 voltou como gravação.

**O tratamento é pouco, de propósito.** As duas vêm limpas (fundo 70–80 dB
abaixo do som, sem música) e são o som que ELE escolheu; mexer no timbre seria
trocar o som dele por um palpite de quem não ouve. **Fica o som inteiro** — as
duas partes do cacarejo ("có" curto e "cóóó" longo, 723 ms) e o miado desde o
"m" baixinho (711 ms) —, sai só o silêncio das pontas, estéreo vira mono e
24 kHz vira 22,05. Uma receita só para as duas: `sons/cortar-gravacao.py`,
que refaz os arquivos **byte por byte**.

**As pontas se medem em relação ao trecho mais alto DO PRÓPRIO arquivo**, e
não por uma régua fixa: o gato veio gravado bem mais baixo que a galinha
(pico 0,05 contra 0,14), e a régua fixa da primeira escrita (-50 dB) cortaria
o "m" do miado. Pela régua relativa (32 dB abaixo do mais alto) o miado
começa no "m" e fica de fora um estalinho que a gravação tinha depois dele.

**A lição das tentativas, agora com sete:** quatro do pato, a rodada de
vaca/porco/gato sintetizados, o "pó" cortado de um clipe e as três versões
mais agudas dele — todas reprovadas. **O que ele aprova é gravação que ele
mesmo escolheu.** Quando o pedido for "outro bicho" ou "mudar este", o
primeiro passo é pedir a gravação, e o trabalho daqui é cortar, limpar e
acertar o volume — não fabricar.

**O volume sai do pato**: galinha e gato tocam a 1,19x a altura dele, e cada
encosto na mesma altura do seu arquivo (1,06x e 1,01x). O encosto da galinha
ganhou **duas notas**, como as duas partes do cacarejo.

Prova: `os-bichos-do-aviso`, 29 conferências, **8 sabotagens e 8 pegas** (o
arquivo do gato com nome errado; o gato que some da lista; **os arquivos da
galinha e do gato trocados um pelo outro**; o gato sem encosto; a galinha dez
vezes mais alta; a vaca sintetizada de volta; o "pó" antigo de volta; a
mensagem nova tocando o pato). A troca entre os dois só a impressão digital
pega: eles têm a mesma duração, e tudo o mais que se mede de fora passaria.

**E o assobio, no mesmo dia** — o primeiro aviso que não é bicho, e entrou
pelo mesmo caminho: gravação que ele mandou, cortada pela mesma receita
(`sons/cortar-gravacao.py`), um "fiu-fiuuu" de 771 ms entre 1 e 2,3 kHz.
Toca na altura do pato como os outros (1,19x), com o encosto em duas notas
de onda pura (0,96x). **Um limite que fica escrito:** RMS igual não é altura
igual para o ouvido, que é mais sensível em 1–2 kHz do que no grave do
miado — o assobio pode soar mais agudo de ouvir na mesma medida. Se ele
achar alto, o número é o `volume` da receita, e a prova `o-volume-dos-avisos`
aceita de 0,67x a 1,5x do pato. Na prova `os-bichos-do-aviso` ele entrou na
lista `BICHOS`; trocar o arquivo dele pelo do gato é pego pela duração e
pela impressão digital.

**E o cachorro, logo depois**, pelo mesmo caminho: um latido só, 365 ms — o
rosnadinho grave do começo (~450 Hz) fica, porque é o começo do latido. Na
altura do pato (1,19x), encosto em duas notas ásperas (0,98x). Com ele,
`os-bichos-do-aviso` tem 49 conferências e `o-volume-dos-avisos` 40.

### A etiqueta da notificação

Era `tag: "zorvin"` para tudo: cada aviso **substituía** o anterior, então dois
clientes escrevendo ao mesmo tempo viravam **um** aviso — o segundo apagando o
primeiro sem deixar rastro. Hoje a etiqueta é por conversa, e o título traz o
nome de quem escreveu (dois avisos dizendo "Nova mensagem" não dizem a qual
conversa ir).

Prova: `o-aviso-de-mensagem-nova`, 15 conferências, 5 sabotagens e 5 pegas. Ela
**espiona** o som e a notificação em vez de desligá-los — uma bancada que os
silenciasse aprovaria um painel que nunca avisa ninguém.

**E a cena do cliente novo usa uma conversa que ainda não existe.** Escrevi
primeiro reaproveitando uma conversa da bancada, e ela reprovou: aquela já tinha
histórico com autor, então era de alguém. A conferência dizia medir "cliente
novo" e media outra coisa — e o cenário de verdade é este mesmo, porque cliente
novo escrevendo cria uma conversa que nenhum painel conhece.

### O aviso vai para o responsável (13/10)

Pedido do Rodrigo logo depois de a distribuição entrar: *"pode fazer o aviso
só para quem recebeu"*. Com a distribuição ligada o cliente novo já chega com
dono, e avisar a equipe inteira de uma conversa que tem dono é o aviso que
não pede ação de quem lê.

**Uma pergunta nova entre as de 15/09, e é a ORDEM que decide**
(`esteAvisoMeInteressa`): participei → avisa; tem responsável → só ele;
outra pessoa participou → não; ninguém e sem dono → todo mundo. **Participar
vem primeiro**, porque é o pedido de 15/09: quem respondeu numa conversa da
colega continua sendo avisado nela.

**Vale para TODO responsável**, e não só o que a distribuição pôs — e isso
fechou um buraco que ninguém tinha relatado: quem recebia uma conversa
**passada adiante** ficava calado, porque outra pessoa tinha respondido nela.

**O dono é perguntado a cada aviso, e não guardado** como a participação: ele
muda (passar adiante, assumir, a distribuição), e um dono guardado e velho
calaria a pessoa errada.

#### A corrida, e a espera de 2,5 segundos

A ponte grava a mensagem e **só depois** pergunta ao banco quem a recebe
(antes disso ela ainda desarquiva a conversa). A primeira mensagem de um
cliente novo chega aos painéis **antes do dono** — e sem cuidado ela avisaria
todo mundo, que é exatamente o que o pedido quer calar.

Então, **num departamento com a distribuição ligada**, a conversa órfã e sem
dono espera `ESPERA_DA_DISTRIBUICAO_MS` e pergunta de novo. Chegou o dono, vale
ele; não chegou (ninguém no rodízio, a ponte lenta), **avisa todo mundo** —
o lead sem aviso é o pior desfecho. **A espera é SÓ onde a distribuição está
ligada**: sem ela o dono não vem, e esperar atrasaria à toa o aviso de todo
cliente novo.

**Os 2,5 s são estimados, e não medidos em produção**: entre a mensagem e o
dono a ponte faz duas idas ao banco (desarquivar e distribuir), de ~100 a
300 ms cada. Errando para menos, o custo é um som a mais para a equipe — o
comportamento de antes —, e não um aviso calado.

**A decisão corre POR FORA do tratador do tempo real**, e sai **antes** da
consulta do telefone. Esperada no tratador, ela seguraria pelos segundos da
espera a entrada da conversa nova na lista — o cliente novo apareceria
atrasado justamente para quem vai atendê-lo. E depois da consulta do telefone,
as duas idas ao banco somariam os seus tempos antes do som: foi a prova de
15/09 (`o-aviso-de-mensagem-nova`) que pegou, na primeira escrita.

**Uma pergunta por conversa de cada vez** (`decisoesEmVoo`). Perguntar o dono
a cada aviso tem um custo: um cliente que manda vinte fotos seguidas seriam
vinte perguntas iguais no mesmo instante, por cada pessoa da equipe. Enquanto
a pergunta de uma conversa está em voo — e ela inclui a espera —, as
mensagens seguintes dela usam a mesma resposta; terminada, a próxima pergunta
de novo. **Juntar não é guardar.** Medido na cena "sem a função" de
`selos-em-rajada` (a que vem depois de recarregar a página): **56 idas** ao
banco para 20 mensagens sem a junção, **18** com ela.

**E a cena principal da `selos-em-rajada` NÃO vê isto**, o que eu supus ao
contrário: a conversa que ela acompanha é uma em que a sessão já respondeu, e
a participação guardada responde sem ir ao banco — 20 mensagens, **2 idas**,
com ou sem a junção. Quem cobra a junção é a cena 9 da prova nova, numa
conversa da colega.

**Aberta durante a espera, a conversa não avisa** — a pessoa já está vendo a
mensagem. **E a leitura que falha avisa**, nas três perguntas: a do dono, a da
participação e a da distribuição (esta não espera: avisa na hora). É a
armadilha nº 2 aplicada a um aviso. **Sem a coluna do 008, a regra de antes.**

**O limite, dito ao Rodrigo:** a conversa de quem está de férias só avisa essa
pessoa. A chave *"recebe conversas novas"* para as NOVAS; as que já são dela
continuam sendo dela — o caminho é passar adiante.

#### Duas mentiras da bancada, e uma minha

**`not()` era cano vazio.** O painel pergunta *"alguém da EQUIPE já escreveu
aqui?"* com `.not("enviado_por_id", "is", null)`; devolvendo tudo, a mensagem
do próprio cliente contava como resposta da equipe, e **o cliente novo deixava
de avisar**. O painel estava certo. A prova de 15/09 nunca viu isso porque o
cliente novo dela nasce sem mensagem nenhuma na tabela.

**A bancada lê a linha ao RESPONDER, e não ao perguntar** — o atraso vem antes
da leitura. Com os 700 ms das conversas, a primeira pergunta pelo dono já
voltava com o dono gravado 400 ms depois da mensagem, e a cena da corrida
passava **sem a espera existir**. Hoje ela roda com `__ATRASO_UNIFORME = 60`
e a ponte de mentira leva 1 s para gravar o dono: só a espera separa o certo
do errado. **Uma corrida só é medida se o evento cair DEPOIS da resposta da
primeira pergunta.**

**E o texto da aba Avisos saiu grudado na primeira escrita**: no JSX a quebra
de linha colada a um `<b>` some, e "numa conversa" + quebra + `<b>sem
responsável</b>` virava **"numa conversasem responsável"**. Uma busca pela
palavra "responsável" passava; a prova confere a frase.

Prova: `o-aviso-vai-para-o-responsavel`, 25 conferências, **12 sabotagens e 12
pegas**, todas limpas, rodadas em cópias junto com `o-aviso-de-mensagem-nova`:

- o dono ignorado;
- sem a espera;
- a espera sempre;
- a decisão esperada no tratador;
- a decisão depois da consulta do telefone;
- a falha do dono calando o aviso;
- sem reler depois da espera;
- o dono perguntado antes da participação;
- o dono guardado;
- sem conferir a conversa aberta;
- o texto antigo da aba;
- a rajada sem junção.

**A decisão depois da consulta do telefone só a prova de 15/09 pega**, com
quatro reprovações. É o defeito da primeira escrita: o aviso chega atrasado e
cai na cena seguinte dela.

## O áudio em 2x (02/10)

Pedido da equipe (Jenifer): *"colocar x2 nos áudios do Zorvin"*. Um botão ao
lado do tocador de cada bolha de áudio, que anda **1x → 1,5x → 2x → 1x**, como
o do WhatsApp, e sempre escreve a velocidade de agora.

**Uma escolha só, para todos os áudios** (`velocidadeDoAudio.js`), guardada no
navegador como o som do aviso. Trocada numa bolha, todas acompanham na hora;
cada bolha com o seu estado faria duas bolhas da mesma conversa tocarem em
velocidades diferentes.

**A velocidade é posta DUAS vezes, e as duas importam juntas:** o navegador
devolve `playbackRate` ao `defaultPlaybackRate` sempre que carrega o arquivo —
e o arquivo só carrega no primeiro play. Então a bolha põe as duas, e põe de
novo no `loadedmetadata`. **As duas sabotagens que tiram uma delas VAZAM, com
razão**: uma cobre a outra. A que tira as duas é pega ("continua em 2x depois
de carregar o arquivo").

Prova: `o-audio-em-2x`, 15 conferências, **7 sabotagens de verdade e 7 pegas**
(o rótulo que muda sem o tocador; sem aplicar ao trocar; sem guardar; só 1x e
2x; qualquer valor guardado aceito; cada bolha por si; as duas camadas do
carregamento tiradas juntas). Os áudios são plantados pela prova
(`__SEMENTE`): a bancada não tem nenhum.

### A transcrição, ao clicar (05/10) — e sozinha desde 31/10

Pedido da equipe junto com o 2x. Decidido com o Rodrigo: pelo **Groq**
(Whisper, ~US$ 0,04 por hora de áudio), **ao clicar** no botão
**"Transcrever"** embaixo do tocador. Quem fala com o Groq é a **ponte**
(`POST /transcrever`), onde mora a chave `GROQ_API_KEY`; a bolha só pede.

**O texto guardado aparece direto.** A ponte grava em `mensagens.transcricao`
(script 015), e a conversa lida com `*` traz o campo: quem abrir depois lê o
texto sem botão e sem pagar de novo. O estado da bolha é só o desta sessão,
para o texto aparecer na hora do clique.

**O erro é dito na bolha**, com a frase da ponte (que diz o que fazer — a chave
que falta, o limite do Groq), e o botão fica, oferecendo tentar de novo. **A
bolha provisória e o áudio sem arquivo não oferecem transcrever**: a ponte não
teria o que ler.

Prova: `transcrever-o-audio`, 22 conferências, com a ponte fingida pela prova.

**E a PR saiu com uma sabotagem dentro — a terceira vez desta forma.** Uma
rodada de sabotagens foi interrompida no meio, e o `catch` da bolha ficou
`void e`: o erro da ponte sumia calado, e o botão continuava dizendo
"Transcrever" como se nada tivesse acontecido. Eu conferi o arquivo depois da
interrupção e não vi; **a integração contínua viu**, nas duas conferências da
cena do erro. A régua escrita em 30/09 vale também para o commit, e não só
para a cópia de referência: **depois de uma rodada de sabotagens
interrompida, rode a prova inteira ANTES de fazer o commit.**

### E sozinha, assim que chega (31/10)

Pedido do Rodrigo, da lista de recomendações: *"Vamos trabalhar nas suas
recomendações! Pode mandar bala na primeira"*. Desde 31/10 **a ponte
transcreve sozinha todo áudio que chega** (os dos últimos sete dias, de 20 em
20 segundos — ver o CLAUDE.md dela). A medição que derrubou o "só ao clicar"
de 05/10: nos 14 dias até 31/10, 161 dos 388 áudios de clientes (41%) já
tinham sido transcritos no clique, e transcrever todos custava uns US$ 0,10.

O painel acompanha em três lugares:

| onde | o que mudou |
|---|---|
| a bolha do áudio | o texto aparece **sozinho**, pelo tempo real: o tratador de UPDATE de `mensagens` passou a copiar `transcricao` (e `transcrita_em`). Sem isso, o texto só apareceria para quem reabrisse a conversa, e o botão continuaria oferecendo pagar de novo |
| a lupa da conversa | procura também no que foi **dito** (`casaNaMensagem`, em `buscaNaConversa.js`): no banco, numa segunda pergunta ao mesmo tempo (`imatch` em `transcricao`), e na tela |
| a busca da lista | a conversa achada por um áudio (o motivo `'audio'` do script 040 da ponte) mostra o trecho com **🎤** no lugar do 💬, e abre no áudio |

**O botão "Transcrever" continua**, para o áudio de antes da janela da rodada
e para quando ela não conseguiu. O clique durante a rodada não paga duas
vezes: a ponte junta os dois pedidos.

**Duas perguntas, e não um `or`.** O padrão sem acento tem colchetes, barras e
vírgulas, que dentro de um `or` do PostgREST precisariam de aspas e escapes —
e um escape errado ali seria uma busca que não acha nada, calada. As duas
respostas viram uma lista só (`juntarAchados`), sem repetir a mesma mensagem.

**Três desfechos da parte dos áudios**, e cada um diz o seu:

| o banco | a lupa |
|---|---|
| sem a coluna (o 015 não rodou) | procura só no texto, **calada** — a coluna que falta não é uma falha (`TRANSCRICAO_NO_BANCO`, pela régua de `TEM_NOME_DO_CADASTRO`) |
| a pergunta dos áudios falha | `data-busca-sem-os-audios`: o escrito foi procurado inteiro, e os áudios só na tela — "procurei só na tela" seria mentira pela metade |
| a do texto falha | a frase de sempre (`data-busca-so-na-tela`) |

**No ícone da lista, o 🎤 sai do banco, e não da tela.** O trecho guardado em
`achadosMsg` já leva o 💬 ou o 🎤, e a linha o mostra como veio: o 💬 escrito
na hora de desenhar daria "💬 🎤 …". **Sem o 040 da ponte, nada muda**: o banco
nunca diz `'audio'`.

Prova: `a-transcricao-chega-sozinha`, 32 conferências, com uma conversa
plantada — um áudio de 400 dias atrás já transcrito, 130 mensagens depois dele
(a conversa abre com as 120 últimas, então ele fica fora da tela), uma
mensagem escrita e um áudio novo sem texto. A bancada ganhou
`__TRANSCRICAO_PELA_PONTE` (a ponte grava a transcrição, com o UPDATE do tempo
real), a busca nos áudios na `buscar_conversas` de mentira e
`__QUEBRAR_A_BUSCA_NOS_AUDIOS` (só a pergunta pela transcrição falha).

**12 sabotagens e 12 pegas**, todas limpas, rodadas em cópias e lidas uma a
uma:

- **a bolha:** o tempo real sem copiar a transcrição;
- **a lupa:** sem a pergunta pela transcrição (7 reprovações); a tela sem a
  transcrição; o contorno da bolha só pelo texto; a coluna que falta virando
  falha; a falha dos áudios calada; a falha dos áudios virando falha inteira
  ("procurei só na tela"); sem procurar na tela quando só os áudios falham;
- **a lista:** o motivo `'audio'` tratado como nome; o áudio com o 💬; o 💬
  junto do 🎤;
- **e a bancada** sem o áudio na busca de mentira: sem ele, as cenas da lista
  não mediriam nada.

## As respostas rápidas com o nome do cliente (08/10)

Pedido do Rodrigo, escolhido da lista de ideias de 08/10: a resposta pronta
que diz o nome de quem está do outro lado. Quatro variáveis, em
`variaveis.js`:

| variável | vira |
|---|---|
| `{saudacao}` | Bom dia (5h às 12h), Boa tarde (12h às 18h), Boa noite |
| `{nome}` | o primeiro nome do cliente |
| `{nome_completo}` | o nome inteiro do cliente |
| `{atendente}` | o primeiro nome de quem está atendendo |

**Preenche-se ao ESCOLHER a rápida, e não ao enviar.** O texto entra na caixa
já preenchido, e a pessoa o lê antes do Enter: o que se vê é o que sai.
Preencher no envio mandaria ao cliente um texto que ninguém leu — e o nome do
WhatsApp nem sempre é nome ("Deus", "Eu", o nome da loja). **O menu do "/" já
mostra a rápida preenchida**, e é ali que se vê o nome antes de escolher.

**O cliente é o nome do ALTO da conversa** (`nomeDoContato`: a ficha, o nome
que a equipe deu, o do WhatsApp, nessa ordem). Uma regra que se vê, em vez de
uma segunda escolha de nome que divergiria da primeira; e quando o nome está
errado, o conserto é o lápis de renomear, que já existe. **Grupo não tem "o
cliente"**: ali a variável fica vazia, e não "Olá, Mutirão!".

**O cadastro grita.** "ANDREIA CRISTINA MARTINS" vira "Andreia", e o nome
inteiro "Maria das Graças de Souza". Só se refaz a palavra TODA maiúscula ou
TODA minúscula: quem escreveu "McDonald" sabia o que escrevia. Emoji, o til de
enfeite e o tratamento saem — "Dr. João" daria "Olá, Dr!".

**O cliente sem nome não vira "Olá, !".** A variável vazia sai levando a
vírgula e o espaço que a prendiam: "Olá!", "Oi, tudo bem?", "Seu documento
chegou.". A limpeza mexe SÓ em volta do que foi tirado (uma marca invisível
fica no lugar dele até a limpeza): o espaço duplo de quem escreveu continua
duplo. **Texto sem variável volta igual, byte por byte** — a rápida de sempre
não pode mudar só porque passou por aqui.

**A saudação tem maiúscula só no começo da frase**: "{saudacao}, {nome}!" dá
"Bom dia, Andreia!", e "Olá, {saudacao}!" dá "Olá, bom dia!". E "{saudação}"
com acento, "{ NOME }", "{nome completo}" e "{{nome}}" (o jeito de outros
programas) também valem: a variável que não pegasse por causa do acento iria
para o cliente com as chaves.

**Na configuração** (Configurações → Mensagens rápidas): as quatro em
botões que põem a variável ONDE ESTÁ O CURSOR; a prévia preenchida, com uma
cliente de exemplo escrita em maiúsculas, como o Vantoro escreve; e o aviso
âmbar da variável que o Zorvin não conhece ("{processo}"), que avisa e não
impede. **A rápida é guardada com a variável, nunca preenchida**: ela é da
equipe inteira.

**O rascunho com o nome não atravessa de conversa.** Os rascunhos já eram por
conversa (`rascunhosRef`), e a prova confere assim mesmo: agora um rascunho
esquecido carrega o nome de um cliente, e ir parar na caixa de outro seria
mandar "Olá, Andreia!" para quem não é a Andreia.

Prova: `as-variaveis-das-respostas-rapidas`, 68 conferências — a conta direto
na função (`../src/variaveis.js`) e a tela com o relógio fixado
(`page.clock`, no fuso de São Paulo, às 9h e às 14h: a saudação depende da
hora, e a prova que roda às 11:59 não pode reprovar às 12:00). **17
sabotagens e 17 pegas**, todas limpas: o texto cru na caixa; o menu mostrando
o cru; o nome em maiúsculas; o "Olá, !"; o meio-dia ainda "bom dia"; a
saudação sempre maiúscula; o grupo emprestando o nome; o texto sem variável
mexido; o aviso da desconhecida calado; a variável no fim em vez do cursor;
o acento na chave; o "Dr." virando nome; o atendente com o nome do cliente;
a rápida guardada preenchida; o rascunho atravessando de conversa; a prévia
sumida; a chave dobrada.

**E a sabotagem que não aplicou achou caractere invisível no código.** A do
acento procurava `/[̀-ͯ]/` e não achou: o arquivo tinha sido gravado
com os PRÓPRIOS caracteres de acento dentro dos colchetes, e não com a
escrita `̀`. Funcionava igual, e era invisível em qualquer editor — o
tipo de linha que um conserto futuro apaga sem saber o que apagou. Hoje está
escrito como no resto do código. **Sabotagem que "não aplicou" é informação:
o código não é o que se pensa que é.**

**E as cópias de sabotagem deixaram 17 servidores de pé.** O script matava só o
`npx`, e o `vite` que ele abre ficava órfão, gastando processador — o mesmo
tropeço que `rodar.mjs` já descreve. A `digitar` rodou em seguida e reprovou a
régua de desempenho (1,92× mais cara na conversa longa); derrubados os 17, a
mesma prova mediu 0,94×. **Ao subir servidor em cópia, mate o GRUPO de
processos** (`start_new_session` e `killpg`), e confira com `ps` que nada ficou
antes de medir tempo.

## A mensagem rápida com vídeo (23/10)

Pedido do Rodrigo: *"Para as mensagens rápidas, precisa ser possível incluir
vídeos."* O vídeo que a equipe manda a todo cliente novo era procurado no
computador e anexado à mão, a cada vez. Agora ele mora na própria rápida:
Configurações → Mensagens rápidas → **Anexar um vídeo (ou foto, documento,
áudio)**. As colunas são do script 034 da ponte (`midia_url`, `midia_tipo`,
`midia_mime`, `midia_nome`), e as contas que não precisam de tela moram em
`src/rapidasComAnexo.js`.

**O arquivo sobe UMA vez, ao salvar a rápida**, para `anexos/rapidas/…`, com
o cache de um ano e `immutable` (a régua da ponte, `CACHE_DA_MIDIA`). Antes
de salvar ele fica na memória: quem escolhe o vídeo errado e troca não deixa
um arquivo a mais no depósito. **Usar a rápida manda à fila o MESMO
endereço**, sem baixar nem subir de novo. Subir a cada cliente seria a conta
de banda de 21/08 (a armadilha nº 6 da ponte) e deixaria quem atende
esperando o upload de um vídeo que já está lá. `enviarArquivo` e
`agendarArquivo` reconhecem o arquivo que já está no depósito (`doDeposito`),
e o "Reenviar" também.

**Escolher a rápida com anexo abre a PRÉVIA do anexo**, com o texto já
preenchido como legenda. É a régua de sempre das rápidas — o que se vê é o que
sai —, e é na prévia que se confere o vídeo e o nome do cliente antes do
Enter. A caixa de escrever fica vazia: deixado ali, o texto sairia duas vezes.
Numa edição de mensagem, só o texto entra.

**A legenda da prévia passou a ter várias linhas**, e isso vale para qualquer
anexo. Ela era um campo de uma linha só, e o navegador TIRA as quebras de
linha de um campo assim. Medido no banco em 23/10: **22 das 32 rápidas têm
parágrafos** — a do vídeo chegaria ao cliente num bloco só. Enter envia, como
antes; Shift+Enter quebra a linha. O cursor vai para o fim da legenda: ela
chega preenchida para ser completada.

**Com anexo, o texto é opcional e o atalho não.** A rápida só com o vídeo
grava `texto = ''` (a coluna continua `not null`).

**O depósito que recusa é dito, e NADA é salvo.** O arquivo sobe antes da
linha: ao contrário, uma gravação que passasse e um arquivo que falhasse
deixariam uma rápida dizendo "com vídeo" sem vídeo nenhum. O 413 ganha a frase
"o arquivo é grande demais para o depósito".

**Só vai na gravação o que MUDOU**: o arquivo novo, ou o anexo tirado. Num
banco sem o 034, a rápida de texto continua sendo gravada sem mencionar coluna
nenhuma do anexo — mencioná-las daria 42703.

**`rapidaComAnexo` tem três estados**, pela régua de `temVantoro.js`, numa
pergunta de uma linha por abertura do painel. Só a coluna que FALTA esconde o
anexo (`semAColunaDoAnexo`, pelo código e pelo nome). A pergunta que falha
por outro motivo o mantém oferecido.

**Tirar o anexo não apaga o arquivo.** O depósito não deixa ninguém apagar
(armadilha nº 7 da ponte), e as mensagens já enviadas apontam para ele.

**O que não foi medido, e fica dito:** o tamanho máximo de uma legenda no
WhatsApp. A maior rápida do escritório tem 1045 caracteres. Se o WhatsApp
cortar uma legenda longa, o caminho é mandar o texto numa mensagem à parte —
e isso se decide depois de ver acontecer.

**A bancada aprendeu duas coisas**: o depósito guarda o que subiu
(`__SUBIDAS`), que é a única diferença visível entre "mandou o endereço
guardado" e "subiu o vídeo de novo", já que as duas dão a mesma linha na fila;
e `__SUBIDA_FALHA` faz ele recusar, como o de verdade recusa um arquivo
grande demais.

Prova: `as-mensagens-rapidas-com-video`, 115 conferências, com o depósito de
mentira guardando cada subida. **24 sabotagens e 24 pegas**, todas limpas,
rodadas em cópias e lidas uma a uma:

- **no formulário:**
  - sem o anexo (41 reprovações);
  - o arquivo subindo ao ESCOLHER, e não ao salvar;
  - sem o cache de um ano;
  - fora da pasta `rapidas/`;
  - o nome higienizado gravado no lugar do de verdade;
  - o texto obrigatório mesmo com anexo;
  - a rápida salva com o depósito recusando;
- **sem o 034:**
  - a gravação mencionando as colunas num banco sem o 034;
  - a pergunta que falha escondendo o anexo;
  - um 42703 de outra coluna tomado como o do anexo;
- **no "/":**
  - escolher pondo só o texto na caixa (17);
  - o texto ficando também na caixa;
  - a legenda com o `{nome}` cru;
- **ao enviar e agendar:**
  - o arquivo subindo de novo ao enviar, e ao agendar;
  - a prévia tentando `createObjectURL` no arquivo do depósito;
- **na legenda:**
  - de uma linha só (as quebras somem);
  - Shift+Enter enviando;
  - o cursor no começo;
- **editar e tirar:**
  - editar esquecendo o anexo guardado;
  - tirar sem limpar as colunas;
- **o que a tela anuncia:**
  - a lista sem dizer que há anexo;
  - o menu do "/" sem dizer que há anexo;
  - o vídeo gravado como documento.

## O topo da coluna — 283px para dizer o que cabe em 188

Pedido do Rodrigo em 16/09, com as duas telas lado a lado: o topo do Zorvin
ocupava quase o dobro do topo do WhatsApp Web, e a equipe conhece o segundo.

**Medido, a 1360×900:** do alto da coluna até a primeira conversa iam **283px**;
hoje são **188**. No WhatsApp Web são ~147, em três faixas — título, busca,
filtros. O Zorvin tinha **seis**, e a sexta era a fita de filtros **quebrada em
duas linhas**. No celular (390×844) foram de **315 para 281**.

De onde saíam os 283:

| O que | Antes | Agora | Por quê |
|---|---|---|---|
| Fita de filtros | 78 | 37 | cinco pílulas não cabem em 357px — a ordem saiu |
| "ATENDENDO COMO" + nome + número | 37 | 15 | rótulo e valor na MESMA linha |
| Traço horizontal dentro do bloco | 1 + folgas | 0 | o bloco já termina num traço |
| Recheios e alturas | — | −30 | aperto, sem tirar nada |

### O controle da ordem tem DOIS endereços, e é a decisão principal

`controleDaOrdem` é **uma definição só**, renderizada num lugar ou no outro
conforme o layout — porque a folga está em lugares diferentes em cada um.

- **No computador ele fica na linha da marca.** A fita comporta QUATRO pílulas
  em 357px; com esta ela virava cinco e quebrava. O comentário do filtro de
  atendentes já dizia, quando ELE subiu, que *"era a quinta pílula de uma linha
  que já quebrava em duas"* — e continuou quebrando, porque a ordem tomou o
  lugar vago. Subir a ordem terminou aquele serviço.
- **No celular ele fica na fita**, de onde veio. Lá em cima não cabe: abaixo de
  768px uma regra desta tela força todo botão a **40px de alvo de dedo**, e com
  quatro botões de 40 a marca ficava com 100px para um nome que pede 134. Na
  fita do celular ele não custa nada — ela já usa duas linhas, e a segunda tem
  307px de vão com só as etiquetas dentro.

**Duas cópias do controle divergiriam no primeiro conserto**, e divergir aqui é
a lista virar do avesso num layout e não no outro, com a tela dizendo a mesma
coisa nos dois.

**Ele sempre ESCREVE a ordem**, nos dois lugares — contrato antigo, com prova
própria (`ordem`): um botão que só troca e não conta em que estado está
transforma "achei estranho" em "está quebrado". O que mudou foi o tamanho da
palavra, "Recentes" no lugar de "Mais recentes"; o menu segue dizendo as duas
por extenso, com a explicação de cada uma.

### Três coisas que só apareceram medindo

**A marca ficou cortada, e isso aconteceu de verdade nesta mudança.** Com a
ordem na linha da marca sobraram 130px para um nome que pede 134, e a tela
passou a dizer "Ropelimi Zo" — cortado no meio da palavra, sem nem as
reticências que avisariam que faltou pedaço. Ninguém reclamaria; ficaria só com
cara de programa mal feito.

**O celular tem régua própria, e a prova a 1360px não a enxerga.** A primeira
correção que tentei (encolher os botões para 34px) **desobedecia aos 40px de
alvo de dedo** — trocaria um defeito que se vê por um que se sente, no
aparelho onde errar o toque abre a conversa errada. A segunda (marca a 17px no
celular) passava num iPhone de 390 e **cortava num Android de 360**: dois pixels
de folga não são projeto, são coincidência. O conserto que ficou é o dos dois
endereços acima, que dá 16px de folga a 360 e 31 a 375.

**O teto da prova começou em 215 e desceu para 205.** Com 215, a sabotagem que
devolvia os recheios antigos media 215 cravados e PASSAVA. Teto que não reprova
o defeito que motivou a mudança é decoração.

**E uma sabotagem vazou:** eu media se o menu da ordem cabe na **janela**. Um
menu de 244px em `left: 120` termina em 364px, que cabe numa janela de 1360 com
folga — só que a coluna acaba em 380, e o menu estaria derramando por cima da
conversa aberta, que é o defeito. **A régua é a coluna, não a janela.**

### A prova tem duas metades, e a segunda importa mais

A primeira mede que encolheu. Sozinha, ela aprovaria a tela que encolheu
**apagando** coisa — e o jeito mais fácil de baixar um cabeçalho é jogar fora o
que ele diz. A segunda confere que cada informação continua na tela: o número
que o cliente vê chegar (o mais grave dos três, porque responder pelo número
errado não tem desfazer), o departamento, e a ordem da lista.

Prova: `o-topo-mais-baixo`, 31 conferências em duas larguras, 6 sabotagens e
6 pegas.

### E a pílula da ordem passou a PARECER escolhida (29/09)

Relato do Rodrigo, com três fotos: *"'Recentes' e 'Esperando' quando estão
selecionados, não parece que estão selecionados, pois não possuem cor de
fundo"*.

Ela pintava de verde **só o `antigas`** — sobra de quando havia DUAS ordens e
o verde queria dizer *"não é a de sempre"*. Com três, a conta não fecha:
**`esperando` é a que mais vira a lista do avesso e era a que menos
aparecia**.

**A régua já estava escrita ao lado**, na fita de filtros: a pílula escolhida
é verde cheia, **inclusive a padrão ("Tudo")**. Este controle sempre tem um
valor escolhido, então está sempre cheio. Inventar um segundo jeito de dizer
"escolhida" — um enchimento neutro para a padrão e verde para as outras —
seria uma linguagem visual que não existe em nenhum outro lugar desta tela.

**E não se perde sinal nenhum:** quem diz que a lista está fora da ordem de
sempre é a **palavra**, que a pílula sempre escreve — o contrato antigo, com
prova própria. Cor some para quem é daltônico; palavra, não.

**A conferência compara com a própria tela**, e não com um valor copiado: ela
lê o fundo da pílula ATIVA da fita e exige o mesmo nas três ordens. Escrever
a cor à mão na prova seria uma segunda definição dela, para divergir no dia
em que o tema mudar. Duas sabotagens, duas pegas — devolver o verde só para
"Antigas", e usar uma cor que não é a da fita.

## A busca que empurrava para fora da tela o que ela tinha achado

Relato do escritório em 16/09, com foto: *"a conversa do nome que eu pesquiso
aparece e em segundos some, e ficam aparecendo outros contatos todos sem
conversa"*.

**A conversa não sumia.** A busca pergunta em dois lugares e em dois tempos: o
banco responde em milissegundos, o cadastro do Vantoro leva segundos (ele fica
atrás da ponte, que hiberna na Render). O bloco *"No cadastro do Vantoro, ainda
sem conversa por este número"* era desenhado **acima** das conversas — então,
quando o cadastro chegava com doze homônimos, a conversa achada ia parar 800px
abaixo da dobra.

**Medido na bancada**, com doze homônimos: aos 900ms, 1 conversa e 0 ofertas;
aos 2100ms, as MESMAS 3 conversas com 12 ofertas na frente. A primeira conversa
saía de 0 para **868px** abaixo do alto da lista.

**A ordem certa sai da pergunta que a pessoa fez.** Ela procurou um nome: se HÁ
conversa com ele, essa é a resposta. "Comece uma conversa com alguém com quem
você nunca falou" é o que sobra quando não há — e aí o bloco fica no alto
sozinho, porque não há nada acima dele. O conserto é de ORDEM, e não de
conteúdo: a oferta continua inteira, com o telefone e o "Começar conversa".

**Descer não podia virar apagar.** A oferta existe por um relato anterior deste
mesmo escritório (a ELIANA, que o Vantoro conhece e o Zorvin nunca viu), e a
prova tem uma conferência só para isso: sem conversa nenhuma, ela aparece.

**A prova mede o que se VÊ, e não a ordem no HTML.** Conferir só "o bloco vem
depois" aprovaria uma tela em que a conversa está logo abaixo de doze ofertas
dentro de um quadro que rola: no HTML a ordem estaria certa e na tela a
conversa continuaria fora da vista. E a medida sai do alto do **quadro que
rola**, não da janela — medindo da janela, os 188px do cabeçalho entram na
conta e a régua passa a falar de outra coisa.

Prova: `a-busca-nao-empurra-a-conversa`, 11 conferências, 2 sabotagens e 2
pegas.
## O campo de grupos — a setinha do fim da fita

Pedido do Rodrigo em 16/09, com a tela do WhatsApp Web ao lado: lá a fita de
filtros termina numa seta que abre "Grupos". A equipe já conhece o gesto.

**Não precisou de SQL.** O WhatsApp entrega grupo com um identificador no lugar
do telefone, e a ponte grava isso em `contatos.numero` com o prefixo `grupo:`.
Não existe coluna dizendo "isto é um grupo" — **o prefixo É a marca**, e o
painel já se servia dela em dois lugares. Agora são três, e por isso ela virou
`ehGrupo()`: a terceira cópia é onde uma regra escrita à mão começa a divergir.

### A seta ABSORVEU as etiquetas, e não ficou ao lado delas

A fita tem **356px de vão e comporta quatro pílulas** — foi medido em 15/09, e é
o motivo de a ordem da lista ter subido para o alto da coluna. Medido de novo
com a seta ao lado da pílula de etiquetas: **379px, e a fita quebrou em duas
linhas outra vez**. Nenhum aperto de recheio dá os 23px que faltam sem ficar a
um pixel de quebrar no primeiro contador de três dígitos.

É também o que o WhatsApp Web faz: aquela seta é a **gaveta** dos filtros que
não cabem na linha, e não um filtro a mais.

**Um controle, três formas:**

| estado | a fita mostra |
|---|---|
| nada escolhido | só a seta (32px) |
| grupos escolhido | "Grupos", verde |
| etiqueta escolhida | o nome dela, na cor dela |

**O que mudou para quem usa etiqueta:** um clique na seta em vez de um clique na
pílula — o mesmo menu, com o mesmo conteúdo. A prova `etiquetas` passou a
endereçar o controle por `data-mais-filtros`, e não pela palavra: o rótulo
visível mudou uma vez e pode mudar de novo.

**O desfazer mora no menu**, e não num "×" na pílula: ela é o gatilho do menu
desde sempre (é assim que se comporta com uma etiqueta escolhida), e dar a ela
dois significados conforme o filtro ligado faria o mesmo clique abrir um menu
num caso e apagar o filtro no outro.

### O grupo que está a cinco páginas de distância

A lista vem do banco em páginas de 200, das mais recentes para as mais antigas.
Um grupo parado há dois meses está fora delas — e filtrar só o que está na tela
mostraria *"os grupos entre as 200 conversas mais recentes"* com cara de *"os
grupos"*. É a armadilha nº 2 com outra roupa: uma lista curta que se lê como
completa. Quem procura o grupo do mutirão e não acha conclui que ele não existe
no Zorvin.

Então `extrasGrupo` pergunta ao banco, no mesmo desenho do filtro de etiquetas:
primeiro os contatos cujo número começa com `grupo:`, depois as conversas deste
telefone com eles. **Falhando, não apaga o que já está na tela** — os grupos das
páginas lidas aparecem por `passaNoFiltro`, que não depende dessa ida.

**A bancada ganhou DOIS grupos**, e os dois importam: um entre as conversas
recentes do primeiro telefone (o caso de todo dia) e um na posição ~1150 do
telefone de 1200 conversas (o que separa "filtrei os grupos" de "filtrei os
grupos que por acaso estavam carregados").

**E eles precisaram de mensagens.** Medido: sem nenhuma linha em `mensagens`, a
conversa não vinha na lista — a consulta da página pede `mensagens(id)` junto —,
e o contador de não lidas do menu ficava em zero com o grupo na tela.

Prova: `o-campo-de-grupos`, 20 conferências, 5 sabotagens e 5 pegas.
## A pesquisa nos menus (23/10)

Pedido do Rodrigo, com a foto do menu da seta: *"quando eu clico na seta e
aparece a lista de etiquetas, precisa ter a opção de também pesquisar por nome
para facilitar encontrar a etiqueta correta, e quando eu clico em 'Assumir' ou
'Etiquetas' dentro da conversa, também é bom ter o campo de pesquisa. Se tiver
mais algum local que você encontre que seja necessário ter esse campo de
pesquisa, pode incluir também."* Medido no banco em 23/10: **32 etiquetas e 23
pessoas**.

| onde | o campo filtra |
|---|---|
| a seta da fita (o pedido) | as etiquetas **e** as opções fixas (Minhas, Tarefas, Grupos, Todas); "Gerenciar etiquetas" fica |
| "Marcar tags" da conversa (o pedido) | as etiquetas |
| "Assumir" (o pedido) | só as pessoas de "Passar para"; "Assumir esta conversa" e "Deixar sem responsável" ficam |
| "Quem participou da conversa" | as pessoas; quem já foi marcado continua marcado |
| Configurações → Mensagens rápidas | pelo título **e** pelo texto |
| Configurações → Etiquetas | pelo nome |

E as pesquisas que já existiam passaram a usar a mesma conta: o "/" das
rápidas, o Encaminhar, a lista de departamentos, a do Funil e a da equipe em
Departamentos e acessos. O campo da lista de departamentos virou o mesmo
componente.

**Uma conta só** (`src/pesquisaNosMenus.js`): sem acento, sem maiúscula, e
cada palavra em qualquer lugar — "minuta acordo" acha "Acordo Fechado - Ag.
Minuta". Escrita em cada menu, o "joao" que acha "João" num deixaria de achar
no vizinho, e quem não acha conclui que a etiqueta não existe e cria outra
igual. **Um campo só** (`src/CampoDePesquisa.jsx`), pela régua de `Chave.jsx`.

**A partir de 7 itens** (`PESQUISA_A_PARTIR_DE`). A régua já estava escrita no
menu de departamentos: *"com quatro departamentos, um campo de busca é mais
trabalho do que correr o olho"*. Com as duas etiquetas da bancada não há campo
nenhum, e quem compra o programa com três etiquetas não ganha um campo que não
serve.

**O comportamento, e o porquê de cada parte:**

- **o cursor já vem no campo no computador, e não no celular.** Lá o teclado
  subiria por cima da lista que a pessoa abriu para tocar;
- **o primeiro Esc apaga o que foi escrito, e só o segundo fecha o menu.** A
  escada do Esc ouve a janela, e o campo chega antes dela;
- **fechado o menu, a pesquisa vai junto** (`ComPesquisa` mora dentro do
  menu). Guardada, a pesquisa de "minuta" de dez minutos atrás reabriria o
  menu com uma etiqueta só, e quem não lembra de ter escrito aquilo acha que as
  outras sumiram. A lista de departamentos, que guardava, passou a apagar ao
  fechar;
- **nas Configurações, ao contrário, a pesquisa sobrevive ao lápis.** Editar
  troca a lista pelo formulário, e quem pesquisou para corrigir três rápidas
  volta do "Salvar" para a lista filtrada. Trocar de aba a apaga;
- **marcar uma etiqueta não apaga a pesquisa**: o "Marcar tags" escolhe
  várias;
- **o campo fica no alto que não rola** (`sticky`), e a prova mede o que está
  pintado (`elementFromPoint`), com a lista rolada até o fim;
- **nada achado, o menu repete o que foi escrito** ("Nenhuma etiqueta com
  “minta”."). É ali que se vê o erro de digitação.

**E um tropeço que este arquivo já registrou:** o `\u0300-\u036f` da conta
foi gravado com os PRÓPRIOS caracteres de acento dentro dos colchetes.
Funciona igual, e é invisível. Quem achou foi, de novo, a montagem das
sabotagens: a troca procurava a escrita `\u0300` e não a encontrou.
Corrigido antes do commit.

**E dois da prova:**

- **marcar a etiqueta da conversa passa pela ponte** (`/etiqueta/contato`), e
  não pela tabela. A primeira escrita conferia `conversa_tags` e reprovava o
  painel certo. Hoje ela confere o pedido à ponte de mentira — a etiqueta
  ACHADA, e não a que fica por baixo dela na lista inteira;
- **`inputValue()` num campo que não está na tela espera 30 segundos.** As
  sabotagens que tiravam o campo levavam minutos cada uma; os ajudantes passaram
  a perguntar antes se o campo existe.

Prova: `a-pesquisa-nos-menus`, 133 conferências, com 30 etiquetas, 10 colegas
e 8 rápidas plantadas. **31 sabotagens e 31 pegas**, rodadas em cópias e
lidas uma a uma:

- a conta com acento, a frase colada (fora de ordem não acha), o campo que
  nunca aparece e o que aparece com dois itens, a frase sem o que foi escrito;
- o Esc que fecha de primeira, o cursor que nunca vem, o X que não limpa, a
  pesquisa guardada entre uma abertura e outra;
- na seta: sem o campo, só as etiquetas filtradas, sem a frase de nada achado,
  o campo que rola junto, o cursor no celular;
- no "Marcar tags": sem filtro, o clique marcando a etiqueta de baixo da
  lista inteira, a pesquisa apagada ao marcar;
- no "Assumir": o "Assumir" sumindo ao pesquisar, sem filtro;
- em "Quem participou": sem filtro, e quem estava marcado desmarcado ao
  pesquisar;
- em Configurações: o lápis apagando a pesquisa, a aba herdando a da outra,
  as rápidas só pelo título, as etiquetas sem filtro;
- e as cinco pesquisas de antes de volta: o "/", o Encaminhar, os
  departamentos (e eles guardando a pesquisa), o Funil e a equipe.

**Duas precisaram ser refeitas, e as duas eram minhas.** A do lápis
estourava a prova: ela citava `rapidaForm` antes de a variável existir, e o
painel inteiro caía. Não era um defeito, era outro programa. E a da equipe
vazou: a conta de antes juntava nome, login e e-mail numa frase só ("josé
ribeiro jose jose@x"), e a cena pesquisava "ribeiro jose" — que aparecia ali
colado. Hoje ela pesquisa "jose ribeiro".


## A busca e o histórico inteiro (26/10)

Pedido do Rodrigo: *"Verifica para mim e me explica como está funcionando o
campo de pesquisa no Zorvin. Corrija possíveis bugs. Veja também se todos os
históricos de conversas estão presentes, se não existem erros referente a
isso."*

### As quatro buscas, e quem responde cada uma

| onde | o que procura | quem responde |
|---|---|---|
| a lupa da lista | o nome (os três), o número, o texto das mensagens, o que foi dito nos áudios (desde 31/10) e o cadastro do Vantoro | o banco, por dois caminhos ao mesmo tempo: `buscar_conversas` (sem acento, até 80 conversas) e os nomes e o número em `contatos`; o Vantoro chega depois |
| "Nova conversa" | a agenda de contatos | `contatos`, pela coluna `busca` (sem acento) e pelo número |
| a lupa da conversa aberta | o texto das mensagens daquela conversa, e o que foi dito nos áudios (desde 31/10) | o banco, até 500 achados |
| os menus | etiquetas, pessoas, rápidas… | a tela (`pesquisaNosMenus.js`, 23/10) |

### O que estava errado, medido antes de mexer

1. **O número na forma antiga não era achado.** `chaveDoNumero` devolve sempre
   a forma COM o nono dígito, e o banco guarda o celular como o WhatsApp
   mandou. **Medido: 504 contatos (840 conversas) na forma antiga.** Quem
   digitava "(71) 99001-2345" não achava o cliente gravado como 557190012345.
   `formasDoNumeroNaBusca` (`numeros.js`) pergunta pelas duas formas, na lupa
   da lista e na agenda — só para celular, pela régua da chave.
2. **O caminho dos nomes era jogado fora quando o completo chegava antes.** Os
   dois caminhos correm juntos, e o dos nomes só desenhava se o completo ainda
   não tivesse respondido. Era invisível enquanto os dois achavam a mesma coisa
   — e deixou de ser quando só o dos nomes passou a achar o número na forma
   antiga. Hoje os dois SOMAM (`achadas`), e quem chega por último não apaga
   quem chegou antes. Foi a prova que achou, com o "(71) 9001-2346".
3. **A agenda da "Nova conversa" procurava a frase inteira, com acento.**
   "maria gracas" não achava "Maria das Graças", nem "gracas pereira" a
   "Maria das Graças Pereira". Agora ela pergunta pela coluna `busca` de
   `contatos` (sem acento, a mesma da lupa da lista), **cada palavra em
   qualquer lugar**, e o filtro da tela usa a régua dos menus
   (`casaComAPesquisa`). Num banco sem a coluna, volta ao jeito de antes
   (`TEM_BUSCA_DO_CONTATO`, pelo 42703 com o nome dela).
4. **No teto, a lista não dizia que podia haver mais.** `buscar_conversas`
   devolve no máximo 80 conversas, e 80 se lia como "todas": quem não achava o
   cliente entre elas concluía que ele não está no Zorvin. Hoje a nota
   `data-corte-da-busca` diz que pode haver outras, e manda escrever mais
   palavras.
5. **A lupa da conversa só olhava a tela — e com acento.** A conversa abre com
   as 120 últimas, e a lupa dizia "0" para uma palavra dita no começo; e
   "conciliacao" não achava "CONCILIAÇÃO". **Medido: 84 conversas com mais de
   120 mensagens; a maior tem 2.178.** Agora ela pergunta ao banco, numa
   conversa só, por uma expressão em que cada letra aceita as suas versões com
   acento (`buscaNaConversa.js`, `imatch`) — sem script novo. "Anterior" e
   "Próxima" levam até a achada que não está na tela, carregando o pedaço da
   conversa em volta dela. A contagem diz "500+" no teto, e a busca que falha
   diz, com o código, que procurou só no que está na tela. As notas, as
   respostas automáticas e as bolhas que não saíram, que não moram em
   `mensagens`, continuam sendo procuradas na tela.
6. **"Carregar anteriores" pulava as mensagens com o mesmo horário.** Ele
   pedia as de ANTES da mais antiga na tela (`lt`), e as que tinham EXATAMENTE
   aquele horário e não tinham cabido na página nunca vinham. **Medido: 1.298
   grupos de mensagens com o mesmo horário numa conversa** (o álbum de fotos, o
   histórico importado com minuto cheio), e 8 mensagens em 3 conversas caíam na
   borda de uma página. Hoje é `lte`, pedindo a mais as que já estão na tela
   com aquele horário, e tirando as repetidas.
7. **Quem abria a conversa numa mensagem antiga perdia o fim.** O salto (a
   achada da busca, a citação) trazia 40 mensagens antes e 120 depois — e mais
   nada: as mais recentes não estavam na tela, e nada dizia isso. **40
   conversas têm mais de 160 mensagens.** Agora o salto traz também as 120
   mais recentes, e entre os dois pedaços aparece *"Há mensagens entre estas e
   as mais recentes que ainda não estão na tela"* (`data-lacuna`), com o botão
   **"↓ Carregar as mensagens do meio"**, que vai preenchendo até encostar.
8. **A mensagem antiga que entra agora tocava o aviso** e trocava o rótulo da
   lista ("🎤 Mensagem de voz" virava o "[anexo]" cru). A importação de
   histórico e o resgate da ponte gravam cada mensagem com a data em que foi
   escrita. Hoje, a que tem **mais de um dia** (`ehHistoricoChegando`) entra na
   conversa sem som, sem notificação e sem mexer no rótulo. Um dia, e não
   minutos: o cliente que escreveu sem sinal e reconectou de manhã ainda avisa.

### O histórico no banco

Dos 64 mil avisos que a ponte recebeu desde 08/09, nenhum ficou sem processar.
Mas **36 mensagens nunca entraram no histórico**: 27 de três tipos que a ponte
não sabia ler (mensagem com botões, resposta a um modelo, convite de grupo) e
9 que a equipe mandou e que saíram depois do prazo da ponte. O conserto e o
resgate são da ponte — ver o CLAUDE.md dela, "O que não entrava no histórico
(26/10)".

**Esta PR tem de ser mesclada ANTES da da ponte**: o resgate grava mensagens
antigas, e com o painel de antes cada uma tocaria o som.

### A bancada aprendeu quatro coisas

- a coluna `busca` de `contatos`, calculada como a do banco (sem acento);
- o `or` com `and()` e `or()` dentro, e as colunas dele conferidas como as de
  qualquer filtro — sem isso, `__SEM_COLUNAS` não recusava uma busca pela
  coluna que falta, e o caminho de volta nunca rodava;
- `imatch` e `match`, a expressão do PostgREST;
- `__QUEBRAR_A_BUSCA_NA_CONVERSA`, que faz a busca por expressão falhar (57014,
  o tempo esgotado do banco), para provar a frase de quem procurou só na tela.

Provas: `a-busca-acha-o-que-existe` (30 conferências) e
`o-historico-inteiro-na-conversa` (46), com uma conversa de 400 mensagens,
quatro delas com o mesmo horário na borda da primeira página. **14 sabotagens
e 14 pegas**, todas limpas, rodadas em cópias e lidas uma a uma:

- o painel de antes inteiro (11 reprovações na busca e 21 no histórico — é o
  pedido reproduzido);
- **na busca:** o número só na forma com o 9; o caminho dos nomes jogado fora
  quando o completo chega antes; sem a nota do corte; a agenda com a frase
  inteira; a agenda sem o caminho de volta (o banco sem a coluna `busca`);
- **na conversa:** a lupa só no que está na tela (12); a lupa com acento;
  "Carregar anteriores" com `lt`; o salto sem a lacuna; o meio que não enche;
  o salto da lupa que não carrega o pedaço em volta da achada;
- **e o histórico chegando:** o som e a notificação para a mensagem de três
  dias atrás; o rótulo da lista trocado por ela.

## Copiar leva só o texto (08/10)

Relato do Rodrigo: *"quando eu copio uma mensagem do Zorvin e colo em um
documento do Word, a formatação fica com o fundo verde"*.

**O botão "Copiar" do menu da mensagem já copiava texto puro**
(`navigator.clipboard.writeText`). O defeito era o caminho de todo dia:
selecionar com o mouse e apertar Ctrl+C. **Medido na prova, antes do
conserto:** a área de transferência recebia `text/plain` E `text/html`, e o
HTML levava `background-color: rgb(217, 253, 211)` — o verde da bolha. O Word
cola o HTML.

**Hoje um ouvinte de `copy` no documento inteiro** põe só o `text/plain`,
tirado da própria seleção (`String(getSelection())`, que é o texto que o
navegador já mandava: com as quebras da mensagem e uma linha por bolha). **Na
tela inteira**, e não só nas bolhas: a ficha, o nome do alto, o número —
qualquer pedaço da tela levaria o fundo do mesmo jeito.

**Sem seleção, não mexe em nada**, e isso não é enfeite: o Chrome dispara o
`copy` mesmo sem nada selecionado, e sem essa guarda um Ctrl+C sem querer
APAGAVA o que a pessoa tinha copiado antes. A mesma guarda deixa a seleção só
de imagem como sempre foi. **A caixa de escrever continua igual**: no Chrome
a seleção dela aparece em `getSelection()`, e é o mesmo texto que o navegador
já copiava.

**O que se perde, de propósito:** o negrito e o itálico na colagem. Foi o
pedido — colar sem a formatação —, e o texto pega a de onde é colado.

Prova: `copiar-leva-so-o-texto`, 14 conferências, com **Ctrl+C de verdade** e
lendo a área de transferência do navegador (`clipboard-read`): um evento de
cópia fingido provaria o ouvinte, e não o que o Word recebe. **6 sabotagens e
6 pegas** (sem o ouvinte; sem o `preventDefault`, que faz o navegador ignorar
o que o ouvinte pôs; o texto sem a quebra entre as bolhas; só nas bolhas; o
HTML junto; e sem a guarda da seleção vazia).

### O nome copiado não virava nome de arquivo (13/10)

Relato do Rodrigo: *"quando eu copio o nome do contato no Zorvin e vou colar
esse nome como nome de um arquivo .pdf, dá um erro no Windows que não permite
eu salvar o nome do arquivo por conter 'caracteres especiais'"*.

**Medido na bancada, com Ctrl+C de verdade:**

| o gesto | ia para a área de transferência |
|---|---|
| três cliques no nome do alto da conversa | `"Deus\n\n"` |
| arrastar um pouco além do fim do nome | `"Deus\n\n"` |
| três cliques no nome da lista | `"Deus\n"` |
| varrer do fim do nome até o avatar | `"AE\nANDRE EUGENIO"` |
| dois cliques, ou arrastar certinho | `"Deus"` |

A seleção que encosta na borda de um bloco leva a quebra de linha dele. E
**quebra de linha é proibida em nome de arquivo no Windows**: é o tropeço
conhecido de copiar uma célula do Excel e colar como nome de arquivo. Nome de
uma palavra só se copia com dois cliques. Nome de cliente tem três ou quatro, e
aí vêm os três cliques.

**O conserto tira o que sobra no FIM** (quebras, espaços, tabulação) e deixa o
resto como a pessoa selecionou:

- **as quebras do meio ficam**: são as linhas de uma mensagem, e uma por bolha;
- **o começo fica**: nenhum gesto medido pôs quebra ali, e lá a tabulação pode
  ser dado. Arrastar sobre uma tabela cuja primeira célula está vazia copia
  `"\tb\tc"`, e tirar essa tabulação colaria a linha deslocada no Excel;
- **na caixa de escrever e nos campos, nada muda**: lá a seleção é letra por
  letra, e a quebra que a pessoa marcou é dela;
- **seleção só de espaço vai como está**: tirar o fim deixaria nada, e nada no
  lugar do que estava copiado é apagar sem querer (a régua de 08/10).

**E as iniciais do avatar deixaram de ser selecionáveis.** Elas eram texto:
varrer do fim do nome para a esquerda até o avatar copiava
`"AE\nANDRE EUGENIO"`. Agora sai só o nome. Arrastar *começando* em cima do
avatar não seleciona nada, porque a seleção nem começa ali. É melhor do que
copiar as iniciais.

**O que NÃO muda, e é decisão:** se o nome tiver de verdade um caractere que o
Windows recusa (`\ / : * ? " < > |`), ele continua lá. É parte do nome, e
tirá-lo mudaria também o que se cola no Vantoro, num e-mail ou numa planilha.

**A prova de 08/10 passou a vida inteira sem ver isto, por duas razões que são
uma só:**

- a cena do nome selecionava por código, letra por letra, e uma seleção assim
  nunca tem quebra no fim;
- ela comparava com `.trim()`, que apagava as pontas antes de comparar.

Hoje as cenas usam os gestos de verdade (três cliques, arrastar além do fim,
varrer até o avatar), e a comparação é exata.

Prova: `copiar-leva-so-o-texto`, agora 30 conferências, **9 sabotagens e
9 pegas**, todas limpas:

- o painel de antes inteiro (7 reprovações: é o relato reproduzido);
- sem tirar o fim;
- as iniciais selecionáveis de novo;
- tirando também o começo (a célula vazia some);
- mexendo na caixa de escrever;
- tirando as quebras do meio;
- tirando só uma quebra do fim;
- esvaziando a área de transferência quando a seleção é só espaço;
- decidindo "é campo" pelo foco, e não pela seleção.

**A última nasceu de uma sabotagem que pegou pela metade.** Na primeira
escrita, "é campo" era decidido pelo foco. Ao abrir a conversa, a caixa de
escrever fica com o cursor piscando. Por isso a sabotagem que tirava as
quebras do MEIO passava nas cenas das mensagens: com a caixa em foco, elas nem
chegavam ao conserto. Hoje conta como campo só quando há texto marcado DENTRO
dele, e uma cena põe o cursor na caixa com o nome selecionado na tela.
**Sabotagem pega por menos conferências do que devia é informação: o código
não é o que se pensa que é.**

**E o vigia `provas-que-reprovam` pegou essa mesma cena antes do empurrão:** ela
conferia dentro de um `if` que perguntava se a caixa de escrever existia, sem
antes conferir que ela existe. Sem a caixa, a cena passaria sem medir nada. Eu
tinha rodado o vigia na entrega anterior e não depois de escrever as cenas
desta. **Escreveu cena de prova, rode o vigia antes do commit**, e não só a
prova.

## O arquivo baixa com o nome que tem (16/10)

Relato do Rodrigo: *"eu envio um arquivo .pdf para o contato com o nome do
arquivo '0001.01 - Procuração' e ele faz uma assinatura e me devolve esse
arquivo assinado, só que quando eu vou baixar o arquivo ele não vem com o
mesmo nome, ele vem com letras e números aleatórios."*

**As "letras e números" são o endereço do depósito.** O arquivo que chega
mora em `recebidos/{messageid}.pdf`, e o navegador salva com o fim do
endereço. O cartão do documento era um link com `download`, e **o navegador
ignora esse atributo quando o arquivo é de outro domínio** — e o depósito é.
O clique abria o PDF numa aba, e o botão de baixar dali salvava como
`3EB0C4AB12CD….pdf`. O nome certo estava gravado (`midia_nome`) e escrito no
cartão; só não ia junto.

**E havia uma segunda metade, do lado de quem envia.** O depósito recusa
acento e espaço numa chave, então o painel higienizava o nome para o
endereço — e mandava o MESMO nome higienizado como `midia_nome`, que é o
`docName` que a ponte entrega ao WhatsApp. "0001.01 - Procuração.pdf"
chegava ao cliente como **"0001.01_-_Procura_o.pdf"**, e o arquivo assinado
voltava com esse nome. Hoje o higienizado fica só no endereço. (O
"Reenviar" já mandava o original — ele lê o nome da bolha provisória.)

| onde | antes | agora |
|---|---|---|
| clicar no cartão do documento | abria numa aba (o PDF) ou baixava com o endereço | **baixa com o nome**, e diz "Baixando…" |
| Ctrl+clique, "Salvar link como…" | o endereço | o depósito manda o nome (`?download=`) |
| ler sem baixar | era o clique | ⋮ da mensagem → **Abrir numa aba nova** |
| a imagem ampliada | `imagem-1760612345678.jpg` | o nome dela, ou "Imagem 14-10-2026 10h05.png" |
| Mídia → Documentos | a legenda, ou "Documento" | o nome, e baixa com ele |
| enviar e agendar | o nome higienizado, ao cliente | o original |
| encaminhar | sem nome (o WhatsApp usava o fim do endereço) | o nome |

**O clique agora BAIXA, e não abre — e é decisão.** É o que o WhatsApp Web
faz, e o cartão sempre se apresentou assim: a seta de baixar, o `download`
do link, o comentário da prévia ("a prévia mora dentro de um link que baixa
o arquivo"). Continuar abrindo deixaria o caminho errado a um clique: quem
baixasse pelo leitor de PDF da aba continuaria recebendo o nome do endereço.
Ler sem baixar continua a um clique, no menu da mensagem — e só em
documento. **No modo de seleção o clique é da seleção**: quem marca o que
apagar não quer um arquivo baixado a cada bolha.

**Mudou em 29/10, só para o PDF recebido:** o cartão ganhou em cima a foto
da primeira página, e **o clique na FOTO abre o PDF em tela cheia**, com o
"Baixar" ali dentro (com o nome, pelo mesmo `baixarDocumento`). **A linha do
nome continua baixando**, como está escrito acima. A foto fica fora do link,
para cada lugar ter um gesto só. Ver "A prévia do PDF, como a das imagens
(29/10)".

**O jeito é o de `baixarImagem`, que já existia**: buscar o arquivo e salvar
de um endereço local (`blob:`), onde o `download` vale
(`baixarComONome`). O `href` do cartão já é o endereço que o Storage serve
com o nome (`enderecoParaBaixar`, `?download=`): o Ctrl+clique e o "Salvar
link como…", que não passam pelo clique desta tela, também salvam certo.

### A conta do nome — `nomeParaBaixar`, em `src/arquivos.js`

- **o nome gravado, como veio**; só sai o que o Windows recusa
  (`\ / : * ? " < > |`, que vira `_`, como o próprio Chrome faria) e o
  espaço e o ponto das pontas;
- **sem extensão, ganha a do tipo**: o exemplo do relato, "0001.01 -
  Procuração", é um nome como o Windows o mostra, sem o ".pdf" — e salvo
  assim ninguém abre com dois cliques. O tipo vem da mensagem, depois do que
  o depósito serviu, depois do fim do endereço;
- **o nome da pessoa vence o tipo**: "dados.csv" chega do Windows como
  `application/vnd.ms-excel` e continua .csv. Só ganha extensão o nome que
  não termina numa conhecida: "0001.01" vira "0001.01.pdf", e a assinatura da
  ICP-Brasil (".pdf.p7s") fica como está;
- **sem nome** (mensagem antiga, foto do WhatsApp): "Documento 14-10-2026
  10h05.pdf", com a data da MENSAGEM. O carimbo de milissegundos que a
  imagem usava era outro "número aleatório";
- teto de 180, e o corte guarda a extensão.

**O depósito que não tem o arquivo é DITO**: a resposta que não é 200 sobe
com o número, e a faixa diz *"Não consegui baixar “…” — o depósito respondeu
404"*. Salvar o que veio daria um arquivo com o nome certo e a página de
erro dentro — o pior dos dois. Só quando a busca nem sai (a rede, ou um
endereço antigo que não deixa ler daqui) é que se abre uma aba, pelo
endereço que já pede o nome.

**A leitura do acervo pede `midia_nome`, e tem a segunda leitura sem ele**:
a coluna nasceu à mão, e a ponte a trata como opcional. Na leitura o
PostgREST diz `column mensagens.midia_nome does not exist`, **sem aspas** —
`colunaQueFalta` (feita para as gravações) não reconhece esse formato. A
pergunta é pelo código e pelo nome, como em `semAColunaDaAgenda`.

### Duas armadilhas da máquina de provas, e não do painel

**Num Linux com o idioma "POSIX" o Chrome joga fora o nome que não cabe em
ASCII e salva como "download".** Medido com `a.download = "Procuração.pdf"`,
no Chromium inteiro e no de prova; com `LANG=C.UTF-8` o nome sai inteiro.
No Windows do escritório o nome é Unicode, e isso não acontece. A prova abre
o navegador com o idioma UTF-8 — a primeira rodada reprovou o conserto
falando da máquina.

**E o download de uma aba aberta em segundo plano não chega ao Playwright**:
Ctrl+clique abre a aba, o depósito responde, e nenhum evento sai — medido,
nem no Chromium inteiro, onde a aba termina em `chrome-error://`. A cena do
endereço abre uma aba no endereço do link, que é o que o Ctrl+clique faz.

**O relato reproduzido, no painel de antes**, com o depósito de mentira:
no navegador de prova, que não tem leitor de PDF (como um Chrome posto em
"baixar PDFs"), o clique no cartão salvou **`3EB0C4AB12CD34EF56.pdf`**; no
Chromium inteiro, ele abriu o PDF numa aba, no endereço do depósito — e o
leitor salva dali com o fim do endereço, que é o que o Rodrigo via.

Prova: `o-arquivo-baixa-com-o-nome`, 95 conferências, com um **depósito de
mentira noutro endereço**, como o de verdade (`ctx.route`, que responde a
`?download=` como o Storage responde), e não `data:` — onde o atributo
`download` valeria e a prova mediria outra coisa. **28 sabotagens, 27 pegas
e uma que vaza com razão**, todas rodadas em cópias e lidas uma a uma — o
painel de antes inteiro reprova 42 conferências. As duas que vazaram na
primeira rodada ensinaram:

- **o acervo sem o clique daqui passava**, porque o link já pede o nome ao
  depósito: o navegador seguia o `href` numa aba, e o arquivo baixava certo.
  Só a aba dizia que o clique não era o daqui, e a conferência olhava só o
  `window.open`. Hoje ela olha as duas portas de uma aba nova, e confere o
  "Baixando…" do acervo;
- **soltar o endereço local na hora, e não um minuto depois, passa — com
  razão**: o Chromium guarda o arquivo no instante do clique. O minuto é
  para os navegadores que leem o endereço depois, e a prova não roda neles.
  É a régua de 25/09: sabotagem que o resto do sistema conserta sozinho não
  prova nada.

## A prévia do PDF, como a das imagens (29/10)

Pedido do Rodrigo: *"Para os arquivos em PDF recebidos, dá para ter uma pré
visualização igual as imagens? Se sim, faça."*

A imagem aparece na conversa como foto, e o clique a abre grande. O PDF
aparecia como um cartão com o nome — e só no Chrome com o leitor de PDF ligado
ganhava, por cima, uma faixa de 150px de um `<iframe>`. Agora:

| | |
|---|---|
| na bolha | a **primeira página como foto**, no tamanho da imagem da conversa (até 260 de largura e 320 de altura: uma A4 sai com 226×320), e a linha embaixo diz **"PDF · 3 páginas"** |
| o clique na foto | abre o **PDF inteiro em tela cheia** (`VisualizadorDePdf.jsx`), com "Baixar" (com o nome do cartão), "Abrir numa aba nova" e fechar |
| a linha do nome | continua **baixando**, com o nome (16/10) |
| fecha com | Esc, o X e o clique no escuro; o clique na página não fecha |

**A foto e a linha do nome são dois gestos, em dois lugares**: a foto abre, o
nome baixa. Um botão dentro do link não seria nem um nem outro — por isso a
foto mora fora do `<a>`, num `<div data-cartao-do-pdf>` que segura os dois. No
modo de seleção a foto não abre nada (o clique é da seleção), e a seta de
opções continua pintada por cima dela.

### Quem desenha é o pdf.js, e não o leitor do navegador

O `<iframe>` só desenhava quando duas coisas davam certo juntas: o depósito
dizer `application/pdf` **e** o navegador ter o leitor ligado. Faltando uma,
nada — e o iframe que nascesse no caso errado **baixava o arquivo sozinho**
(o relato de 29/09). O pdf.js lê os bytes e desenha numa tela própria: não
depende de nenhum dos dois, e não baixa nada para a pasta de ninguém. O PDF que
o WhatsApp manda sem tipo, que antes ficava sem prévia, agora tem a foto.

`arquivos.js` dizia que um leitor de PDF em JavaScript "pesa mais do que o
painel inteiro, e seria carregado por toda pessoa que abre a tela". A primeira
metade é verdade; a segunda não precisa ser:

- **a biblioteca só vem quando um PDF chega perto da tela** (`import()`), num
  arquivo à parte (`pdf-….js`, 542 KB), com o trabalhador noutro
  (`trabalhadorDoPdf-….js`, 1,3 MB). Quem nunca abre uma conversa com PDF não
  baixa nada disso;
- **a versão "legacy", e não a moderna** — MEDIDO: a moderna usa
  `Map.prototype.getOrInsertComputed`, que o Chromium das provas (141) não
  tem, e falhava em todo PDF. A "legacy" traz esses recursos junto; custa uns
  70 KB a mais, só para quem abre um PDF;
- **o trabalhador sai como `.js`** (`src/trabalhadorDoPdf.js`, importado com
  `?worker&url`). O do pacote é `.mjs`, e o navegador só aceita um trabalhador
  que o servidor entregue com o tipo de JavaScript — daqui não dá para ver o
  que o site responde para `.mjs`, e um trabalhador recusado deixaria toda
  prévia de fora, calada;
- **um trabalhador só para todos os PDFs**, e **no máximo duas fotos
  desenhadas ao mesmo tempo** (`MINIATURAS_JUNTAS`): uma conversa com vinte
  PDFs não abre vinte processos nem trava a rolagem.

O pacote é o `pdfjs-dist` 6.4.299, com a versão escrita sem `^`. Ele traz como
opcional o `@napi-rs/canvas` (36 MB), que só serve no Node: o `npm install`
da Render e da integração contínua o baixa, e o navegador nunca o usa.

### Os arquivos de apoio, servidos pelo próprio site

O pdf.js busca à parte, só quando o PDF pede, os **decodificadores de imagem
em WebAssembly** (JBIG2, o de muita digitalização em preto e branco; JPEG
2000), a versão deles em JavaScript para quando o WebAssembly falhar, o de
perfil de cor, e as **fontes padrão**. Faltando um, **a página digitalizada sai
em branco, sem erro nenhum na tela** — a falha que ninguém associa à causa.

O `vite.config.js` os põe em `dist/pdfjs/` no build e os serve do pacote no
servidor de desenvolvimento, no mesmo endereço (`/pdfjs/wasm/`,
`/pdfjs/standard_fonts/`). **Ficam de fora, e é decisão**: o `quickjs-eval`
(roda o JavaScript que vem dentro do PDF, e a prévia não roda), os `cmaps`
(fontes chinesas, japonesas e coreanas que não vêm no arquivo) e os perfis de
cor `iccs`.

### O que o depósito tem, medido em 29/10

Em `storage.objects`, só os tamanhos: **3.201 PDFs**, mediana de **111 KB**,
90% até **845 KB**, o maior com **38,2 MB**. **8 passam de 25 MB**, que é o
teto da foto (`TETO_DA_MINIATURA_BYTES`): para esses, o depósito é perguntado
só pelo tamanho (um HEAD), o arquivo nem é pedido, e fica o cartão de sempre.

**1.338 passam de 128 KB**, e para eles importa ler por pedaços. A foto pede
ao pdf.js só o que a primeira página precisa (`disableStream` e
`disableAutoFetch`): **num depósito que deixa ler por pedaços** (`Range`, com
o `Accept-Ranges` à vista do navegador), um PDF grande não vem inteiro — a
prova mede menos de um quarto de 2,2 MB. **Se o Supabase deixa, não deu para
conferir daqui** (o proxy desta sessão recusa `supabase.co`). Se não deixar, o
arquivo vem inteiro, como já vinha para o iframe no Chrome do escritório, e
fica guardado pelo navegador (o `immutable` de um ano da armadilha nº 6).

### O que não dá fica com o cartão de sempre

PDF quebrado, com senha, grande demais, ou que o depósito não tem: sem foto e
**sem o lugar dela** — nunca uma moldura vazia. Word, Excel e o resto não
ganham foto nenhuma. Enquanto a foto não chega, o PDF guarda o lugar de uma
página A4, e a conversa não pula 320px no meio da leitura.

**A biblioteca que não carregou** (a rede caiu naquele segundo; uma publicação
nova trocou o nome do arquivo com a página aberta) deixa o cartão de sempre,
que baixa. **O navegador guarda o `import` que falhou até a página ser
recarregada** — medido no Chromium: o segundo `import()` do mesmo arquivo
falha sem nem pedir de novo. Ali, só um F5 traz a foto de volta. **E sem o
pdf.js o Zorvin abre**: ele só vem pelo `import()`. Preso no arquivo principal,
o arquivo que a rede derrubasse derrubaria a tela inteira.

**O que não vai mudar fica guardado, e o tropeço não** (`naoMudaNaSegunda`).
A resposta "não dá" do PDF quebrado, do que tem senha, do grande demais e do
que o depósito não tem fica guardada enquanto a página estiver aberta:
perguntar de novo a cada conversa aberta seria ida ao depósito à toa. **O
tropeço não fica** — o depósito respondendo 5xx, a conexão que caiu no meio.
Guardado, ele deixaria o PDF sem foto até alguém apertar F5, e o painel passa
o dia aberto. A bolha que volta à tela tenta de novo. Achado relendo o código
antes da PR, e não por relato.

### A janela em tela cheia

- **as páginas são desenhadas quando chegam perto da vista, e apagadas quando
  se afastam**: uma A4 na largura da janela, numa tela de alta resolução, ocupa
  uns 18 MB; um contrato de cem páginas desenhado inteiro seriam quase 2 GB, e
  o navegador fecharia a aba. Perto da vista ficam três ou quatro;
- **o lugar de cada página já tem o tamanho certo** (pela proporção da
  primeira), e a barra de rolagem diz desde o começo o tamanho do documento;
- **o que não abre é dito, com o motivo** (senha; não é um PDF; o depósito
  respondeu 404) e com as duas saídas, Baixar e Abrir numa aba nova;
- **nada de links nem de campos clicáveis dentro do PDF**: a página é uma
  imagem desenhada. É um documento que chegou de fora, e um link dentro dele
  leva para onde quem o fez quis.

**A prévia ANTES DE MANDAR um anexo continua com o iframe**, e é decisão: lá o
arquivo é o da própria máquina, e rolar e ampliar no leitor do navegador é o
ponto.

### Um erro sem dono no console, e era meu

A prova reprovou "nenhum erro de JavaScript" na janela, com `InvalidPDFException`
e `ResponseException`. Li o pdf.js e achei um relançamento lá dentro
(`sink.ready.catch(... throw ...)`), e escrevi na prova que o erro era dele.
**Não era.** A janela que fecha antes de a biblioteca chegar — e o React de
desenvolvimento monta tudo duas vezes, que é o mesmo caso — deixava uma tarefa
abrindo o PDF para ninguém, e a falha dela não tinha quem a ouvisse. Soltando a
tarefa na hora, os dois erros sumiram, e a conferência voltou a valer para o
404 também. **Antes de pôr a culpa na biblioteca, confira se quem esqueceu a
promessa não fui eu.**

### A prova

`a-previa-do-pdf`, 105 conferências. Os PDFs são **montados na própria prova**
(catálogo, páginas, índice com as posições de verdade), e a página
digitalizada é 1 KB de JPEG 2000 embutido. Um **depósito de mentira noutro
endereço** serve tudo, como o de verdade, e um deles atende `Range`. Ela roda
no servidor de desenvolvimento — é lá que o React monta tudo duas vezes, e foi
assim que a tarefa esquecida apareceu — e **monta o build**, como a Render o
monta (sem a bancada), para conferir o que vai para o ar: os decodificadores em
`dist/pdfjs/`, iguais aos do pacote; o pdf.js e o trabalhador em arquivos à
parte; nada `.mjs`.

**Ela levava cinco minutos, e dois eram de uma pergunta só.** `getAttribute` e
`innerText` num elemento que não existe esperam 30 segundos antes de desistir,
e "não há foto" é a resposta certa de metade das cenas: a cena 5 esperava
quatro vezes, 120 segundos. Hoje os ajudantes contam antes de ler, e a prova
leva 90 segundos. Nas sabotagens que tiram a foto, cada pergunta teria
esperado os 30 segundos, e a prova estouraria o prazo sem dizer qual
conferência viu o defeito.

**E uma sabotagem pegou estourando.** O pdf.js importado direto reprovava a
cena 1 e, na cena 12, com a biblioteca fora do ar, o painel inteiro não abria
— e a espera da prova não era guardada. Era um defeito de verdade sem
conferência própria: hoje a cena 12 começa por *"sem a biblioteca, o painel
abre assim mesmo"*. O meu script de sabotagens também contava como pega limpa
a que reprovava uma conferência e depois estourava; hoje ele diz "PEGOU, MAS
ESTOUROU" e guarda a saída inteira de cada uma — é o avesso do engano de
28/09, quando ele dizia VAZOU para a que derrubava a prova.

As conferências das provas vizinhas foram **invertidas, e não apagadas**:

- `documentos`: "o PDF ganha prévia, desenhada pelo leitor do navegador" virou
  "o PDF ganha a primeira página como foto, com ou sem o leitor — e nenhum
  iframe"; e entraram três: o PDF sem tipo também ganha a foto, a foto fica
  fora do link que baixa, e sem leitor os dois PDFs ganham a foto assim mesmo;
- `a-auditoria-de-27-10`, cena 8b: a seta continua pintada por cima da prévia,
  que hoje é a foto.

**28 sabotagens e 28 pegas**, todas limpas, rodadas em cópias e lidas uma a
uma:

- o painel de antes inteiro (70 reprovações — é o pedido reproduzido);
- **a biblioteca:** o pdf.js importado direto, sem esperar um PDF (e o painel
  não abre sem ele); a versão moderna (65 reprovações: nenhuma foto sai); sem
  os arquivos de apoio (a página digitalizada sai em branco); o build sem eles;
  o build levando o `quickjs`;
- **a foto:** sem o teto de 25 MB; sem perguntar o tamanho ao depósito; sem o
  `disableStream` (o arquivo vem inteiro, sem pedaços); sem o
  `disableAutoFetch`; sem a fila; a foto que baixa em vez de abrir; a que abre
  no modo de seleção; o lugar da página sem tamanho; a foto maior que a imagem
  da conversa; sem o número de páginas; a biblioteca que falha deixando o
  lugar vazio; o tropeço do depósito guardado; nada guardado, nem o que não
  muda;
- **a janela:** o Esc sem a janela na escada; o Esc sem o `return`; o clique
  na página fechando; as páginas longe da vista sem apagar; todas desenhadas
  ao abrir; a tarefa esquecida; o nome cru; o "Baixar" abrindo uma aba (o
  arquivo sai como `PDF2SEMTIPO.pdf`); a falha sem o motivo.

**A do `disableAutoFetch` pega por outro caminho.** A cena dos pedaços passa
sem ele — provavelmente porque ali a foto fica pronta, e a tarefa é solta,
antes de o pdf.js começar a buscar o resto. Quem pega é a cena da fila, com o
depósito lento: três downloads ficam no ar ao mesmo tempo, quando a fila deixa
dois.

## A citação leva até a mensagem citada

Pedido do Rodrigo em 16/09: *"ao clicar na mensagem que foi respondida, ir para
a mensagem"*. É o que o WhatsApp faz, e sem isso a citação é só uma prévia de
120 caracteres — bastante para lembrar do assunto, pouco para achar o que foi
dito antes dela.

**O elo já estava gravado.** `responder_id_uazapi` guarda o id da citada desde
que a ponte aprendeu o formato certo da Uazapi (15/09). O que faltava era o
clique. **Nenhum SQL.**

### Quatro casos, e três deles só existem com dado de propósito

| o caso | o que acontece |
|---|---|
| a citada está carregada | rola até ela e a **marca** |
| a citada não está carregada | vai ao banco buscar as anteriores, e só então rola |
| a resposta não tem elo (dado antigo) | **não finge ser botão** |
| o elo aponta para o nada (citada apagada) | **diz** que não achou |

O último separa "não fez nada" de "não deu para fazer": um clique mudo é
indistinguível de um clique quebrado, e quem atende vai clicar de novo.

**Duas formas, não uma com `disabled`:** `button` quando há elo (com cursor,
foco de teclado e `title`), `div` quando não há. O desenho é o mesmo. Um bloco
que parece botão e não faz nada é pior do que um que não parece.

**São três rodadas ao banco, e não "até achar":** cada uma é uma ida, e um id
que não existe mais varreria a conversa inteira à toa. 360 mensagens para trás
cobrem o que uma citação alcança na prática.

### Três defeitos que só apareceram medindo, e os três eram meus

**`useCallback([])` congelou `carregarAntigas`.** A função precisa ser estável
(ela desce para `ListaDeBolhas`, que é `React.memo` — função nova a cada desenho
faria o `memo` nunca bater, e a lista inteira seria redesenhada a cada tecla) e
ao mesmo tempo precisa ver o presente. Congelada, ela era a versão do primeiro
desenho, quando `mensagens` ainda era lista vazia, e desistia sem ir ao banco.
**O sintoma era o pior possível: o clique não fazia NADA — nem levava, nem
avisava.** Hoje tudo o que envelhece entra por espelho (`mensagensRef`,
`temMaisAntigasRef`, `carregarAntigasRef`).

**`await carregarAntigas()` não espera o React redesenhar.** O `setMensagens`
agenda; o espelho só é atualizado no efeito que roda depois do desenho.
Procurar ali era procurar na lista de ANTES de carregar — justamente a que não
tem a mensagem. Por isso `carregarAntigas` passou a **devolver o lote**, e quem
chamou procura no que chegou.

**Dois cliques em menos de quatro segundos se atropelavam.** O relógio que apaga
o destaque do primeiro disparava no meio do segundo, deixando a pessoa no meio
da conversa sem saber qual bolha é a citada — que é exatamente o que a marca
existe para evitar. Hoje o relógio é cancelado no clique seguinte. **Foi a prova
que pegou.**

Prova: `a-citacao-leva-a-mensagem`, 15 conferências, 5 sabotagens e 5 pegas. A
bancada ganhou as quatro respostas que citam — uma por caso.

## A tela não diz "salvei" sem ter salvo

Relato do escritório em 24/09, em três partes que pareciam três defeitos:
*"quando salvo o nome do cliente não fica salvo"*, *"não estão sendo salvos
novos contatos"*, *"aperto em fazer pré-cadastro e a ficha não aparece"*.

**É uma forma só, repetida em três lugares.**

### Um `UPDATE` barrado pela RLS não devolve erro

Ele não é recusado: é **filtrado**. A regra de acesso entra como um `where` a
mais, nenhuma linha casa, e o banco responde "pronto, atualizei zero linhas" —
com `error` nulo. Quem só olha o `error` conclui que deu certo.

Num `insert` é diferente: ali a RLS levanta erro (42501). Por isso o defeito
mora em quem **edita**, e não em quem cria — e por isso ele passa despercebido
em revisão de código, onde os dois se parecem.

| Onde | O que a tela fazia | O que havia no banco |
|---|---|---|
| Renomear o contato | pintava o nome novo | nada — sumia no F5 |
| Salvar contato | escrevia **"Contato salvo!"** | nada |
| Ligar o pré-cadastro | seguia e mandava as notas subirem | vínculo vazio |

A tela **afirmava o contrário** do que estava no banco. É a armadilha nº 2 do
avesso: ali ela desenhava ausência no lugar de falha; aqui, SUCESSO no lugar de
falha — que é pior, porque ausência faz alguém perguntar e sucesso faz todo
mundo ir embora tranquilo.

**O conserto é `naoGravouNada()`, em `gravar.js`**, e um `.select("id")` junto
da gravação: não é uma ida a mais à rede, é a mesma dizendo o que fez. **Sem
`.single()`**, de propósito — ele transforma "zero linhas" num erro (PGRST116)
e mistura "o banco recusou" com "a rede caiu", que pedem frases diferentes.

### O aviso que era apagado pelo aviso seguinte

`ligarContatoAoCadastro` avisava por conta própria, e quem a chama mostra a
frase dele logo depois ("Pré-cadastro criado no Vantoro."), **apagando a
primeira em menos de um segundo**. A pessoa via o sucesso e ia embora.

Hoje ela **devolve se ligou** e quem começou a ação compõe a frase final —
porque é quem começou que sabe qual é. E ela termina com `return true`: sem
ele devolveria `undefined`, e o caminho de sucesso mostraria a frase da falha.

### A prova precisou ver o FILME, e não a foto

A faixa de aviso mostra uma frase por vez. Lendo só o que estava na tela no
fim, a sabotagem que tirava o `return true` **passava** — a frase errada
aparecia e era coberta pela das notas um instante depois. A prova passou a
registrar toda mensagem que passou pela faixa (um relógio de 50ms; um
`MutationObserver` não serve, porque `addInitScript` roda antes de existir
documento).

**E ela tem contraste em toda cena:** com o banco deixando gravar, o nome fica
e nenhum aviso de falha aparece. Sem isso, um conserto que gritasse sempre
passaria igual.

**O filme tem um limite, descoberto em 29/09: um quadro que nunca foi
pintado.** A conferência do caminho normal exigia a frase *"Pré-cadastro
criado"* dentro do filme, e reprovou na integração contínua com o filme
inteiro valendo *"1 nota interna foi para o histórico do cliente."*. Não foi o
espião que perdeu o quadro — **um `MutationObserver` também não o veria**: lá
a subida das notas resolve rápido o bastante para o React juntar as duas
escritas no MESMO desenho, e a frase do meio não chega a existir no documento.

O comentário logo acima da conferência já dizia a regra certa — *"terminou
numa frase de sucesso, e não terminou NESTA frase"* — e o código exigia a
frase específica. **Onde o comentário e o código discordam, é o código que
está errado até prova em contrário.** Hoje ela aceita qualquer frase de
sucesso, e a das notas não é consolo: elas só sobem para um contato que ganhou
ficha. Quem guarda o defeito continua sendo a conferência vizinha, que reprova
se o filme falar em vínculo que faltou — a sabotagem do `return true` é pega
por ela.

### O que NÃO foi consertado, e é decisão

~~**A mesma forma existe em outros 18 lugares** — varridos e listados na PR. Os
três daqui são os que o escritório relatou; os outros vão numa rodada
própria.~~ **Feito** — ver "E os outros dezoito lugares", logo abaixo.

**E a causa no banco ainda não foi achada.** As permissões de `contatos` foram
conferidas em produção e estão certas (RLS ligada, políticas permissivas com
condição `true`, `authenticated` com INSERT/UPDATE/SELECT). Este conserto faz a
tela **parar de mentir**; ele não faz a gravação voltar a funcionar, e a próxima
sessão vai precisar do que a tela passar a dizer para achar o resto.

Prova: `a-tela-nao-diz-salvei-sem-salvar`, 26 conferências, 7 sabotagens e
7 pegas.

### E os outros dezoito lugares

A rodada acima consertou três telas porque foram as três que o escritório
relatou. A varredura do mesmo dia listou **outros dezoito** com a forma
idêntica, e nenhum deles tinha relato — porque nenhum deles avisa. Esta é a
rodada deles.

**O `DELETE` falha exatamente igual**, e metade da lista apaga. A regra de
acesso entra como um `where` a mais, zero linhas saem, `error` nulo. A
diferença é o que se vê: o que a pessoa mandou apagar **volta** na releitura
seguinte, sem uma palavra. A bancada só sabia recusar `update`; agora recusa os
dois, senão as cenas de apagar seriam verdes por não medirem nada.

| Onde | O que se perdia calado |
|---|---|
| Nota editada e nota apagada | **texto que alguém escreveu** — o pior da lista |
| Etiqueta (renomear e apagar) e a etiqueta tirada da conversa | configuração da equipe |
| Mensagem rápida (editar e apagar) | idem |
| As quatro marcas da conversa | o selo que a EQUIPE inteira vê |
| A conversa importada | nasce no fundo da lista; parece não ter importado |

**As quatro marcas viraram um caminho só** (`gravarMarcaDaConversa`). Eram
quatro cópias com o mesmo furo — e a primeira a divergir seria a que ninguém
provou. **O acerto visual continua vindo na frente**, que é o que faz o clique
parecer instantâneo; **o que passou a esperar é a FRASE**. Ela saía antes de
perguntar: a tela dizia "Conversa fixada" e o banco podia ter recusado calado.
A frase é a tela afirmando um fato do banco.

**"Marcar todas como lidas" é a única em que zero linhas tem DUAS causas**, e
está escrito lá. Nas outras o alvo é uma linha que a tela acabou de ler; nesta
o recorte vai ao banco (`advogado_id` + `nao_lidas > 0`), e entre a conferência
do selo e a gravação um colega pode ter marcado as mesmas conversas. Separar os
dois exigiria uma segunda ida ao banco, e escolher um no chute erra dos dois
lados — acusar o banco por causa de um colega faz alguém abrir chamado por
nada, e dizer "todas marcadas" numa recusa é a mentira que esta rodada tira. A
frase diz os dois e aponta o selo, que é onde está a resposta.

**A presença ganhou porta própria** (`desligarPorRecusa`). `desligarRecurso` só
desliga quando FALTA COLUNA, que é para o que nasceu; com a recusa calada o
pulso de 60 segundos bateria no banco para sempre, por atendente e por conversa
aberta, escrevendo nada. **E ela NÃO vale para a limpeza da saída**: lá a
gravação leva `.eq('atendendo_por', eu)`, e zero linhas é o caso legítimo de
outra pessoa já ter entrado na conversa.

**Um lugar fica sem perguntar, de propósito:** o `insert` do **histórico de
alterações**, que é extra por desenho e não pode derrubar a ação que o gerou.

~~O `fila_envio` do **reenviar** também ficava sem perguntar: o
`guardarDispensado` local resolvia o caso de quem clicou.~~ **Mudou em 28/10:**
desde 26/10 a ponte confirma pelo eco a mensagem que tinha dado tempo
esgotado, e o reenviar que não perguntava gravava "descartada" por cima de
"enviada" e mandava de novo — o cliente recebia duas vezes. Hoje ele só
aposenta o item que ainda está em erro (`.eq("status", "erro")`) e, com zero
linhas, relê o item e diz o que houve. Ver "A auditoria de 27/10 (28/10)".

**E as cinco cópias escritas à mão viraram `naoGravouNada`** — figurinha,
mensagem apagada, marca da mensagem, `Departamentos.jsx` e `PalavrasDaCasa.jsx`
já perguntavam certo, cada uma com a sua linha. Cinco escritas da mesma decisão
é a primeira divergir no primeiro conserto.

**A causa no banco continua em aberto.** Nada aqui faz gravação nenhuma voltar
a funcionar: faz a tela dizer o que o banco respondeu.

Prova: `as-outras-gravacoes-caladas`, 59 conferências, 7 sabotagens e 7 pegas.
Ela endereça as linhas de configuração por `data-etiqueta-da-config` e
`data-rapida-da-config`, e não pelo nome: atrás daquela janela está a lista de
conversas do escritório, e "Urgente" também é texto de conversa.

**E a cena da marca da conversa usa o botão do CABEÇALHO**, não o ⋮ da lista.
~~Medido, o clique no ⋮ da lista abre a conversa em vez do menu.~~ **Isto estava
errado** — o menu funciona; o que falhava era a minha prova. Ver "Uma correção
do que ficou escrito errado em 24/09", mais abaixo. O caminho gravado é o
mesmo, e por isso a cena continua como está.

### E a frase da falha leva o código junto

No dia seguinte, o escritório tentou renomear um cliente e a tela — já
consertada — disse:

> *"Não consegui salvar o nome. Tente de novo."*

Isso diz QUE falhou e não diz **nada** do porquê. O `error` do banco era jogado
fora, sem nem um `console.error`. **É a mesma forma das duas anteriores com
outra roupa:** ali a tela desenhava ausência no lugar de falha, depois sucesso
no lugar de falha; aqui ela desenha **falha sem causa** — e o efeito prático é
o mesmo, porque quem for consertar recomeça do zero.

**O que custou, medido em 24/09:** uma rodada inteira de scripts no Supabase
para descobrir o que o navegador sabia no primeiro segundo. E os scripts
inocentaram todo mundo — as políticas de `contatos` liberam UPDATE para
`authenticated` com condição `true`, não há gatilho na tabela, todas as colunas
(inclusive `nome_zorvin`) têm permissão de UPDATE, e o **mesmo UPDATE rodado no
papel de quem entra no painel PASSOU**. O erro vinha de antes do banco, e o
único lugar que o tinha visto foi o único que não o guardou.

**A régua já existia em um lugar só:** `dispensarFalha` mostrava a frase curta
**com o código** e mandava o erro inteiro para o console. `comOCodigo`, em
`gravar.js`, é essa régua virada função, aplicada a toda gravação. Despejar
`new row violates check constraint` na faixa não ajuda quem atende a decidir
nada — mas o CÓDIGO cabe, é o que se digita numa mensagem para quem conserta, e
é o que separa 42501 de 42703 de PGRST301.

**São TRÊS desfechos, e é isso que a prova guarda:**

| o que aconteceu | a tela diz | por quê |
|---|---|---|
| o banco recusou com erro | a frase **mais o código** | é a pista, e ela some se não for escrita |
| o banco aceitou e não mexeu | "o banco não deixou" | não houve erro: pôr um código aqui inventaria uma falha de banco que não existe |
| o pedido não chegou ao banco | "não consegui falar com o banco" | é conexão, não permissão — pedem providências opostas de quem lê |

Misturar os dois últimos manda a pessoa procurar defeito no sistema errado. Um
erro **sem `code` e sem `status`** não veio do banco: o pedido não saiu.

**A ficha do Vantoro precisou de um espelho.** `ligarContatoAoCadastro` devolve
só um sim/não de propósito (avisar por conta própria fazia a frase ser apagada
pela de quem chamou — ver acima). O erro fica em `erroDoVinculo`, um `useRef`, e
não em estado: ele é lido no mesmo passo em que é escrito, e estado só chega no
desenho seguinte — a frase sairia sem o código na primeira vez e com o código
**antigo** na segunda, que é pior do que não ter.

**Ainda em aberto:** o que faz a gravação falhar em produção. Este conserto não
conserta — ele faz a próxima ocorrência **se identificar sozinha**, na foto da
tela, em vez de custar outra rodada de scripts.

Prova: `a-tela-diz-o-codigo-do-banco`, 23 conferências, 6 sabotagens e 6 pegas.
A bancada ganhou `__ERRO_NA_GRAVACAO` — ela só sabia recusar em silêncio
(`__ESCRITA_SEM_EFEITO`), e uma prova com só essa metade aprovaria a tela que
não diz código nenhum.

## Duas linhas com o mesmo nome — qual delas é qual?

Relato do escritório em 25/09, com foto: duas conversas idênticas na lista —
mesmo nome, mesma foto — e o pedido de *"juntar, porque é a mesma conversa"*.

**Medido no banco, e não eram duplicadas.** Eram **dois telefones da mesma
pessoa**:

| | uma | a outra |
|---|---|---|
| número | **(19) 98209-4819** | **(71) 8425-3304** |
| conta do WhatsApp (`@lid`) | `2735639489…` | `4011090094…` |
| mensagens | 19, desde 24/09 | 90, desde 18/08 |
| ficha no Vantoro | cliente **1233** | cliente **1233** |

DDD diferente, conta diferente, as duas ativas no mesmo dia. **No WhatsApp Web
do escritório elas também são duas conversas** — e é por isso que juntar seria
errado: a resposta sai por UM número, e metade do histórico passaria a viver
sob um telefone que não é o dele. Se o cliente escrevesse de novo pelo outro,
nasceria uma terceira. Juntar não resolveria nem este caso nem os próximos.

**O que estava errado era a tela.** `nomeDoContato` mostra o nome da FICHA
quando ela existe, e os dois contatos apontam para o mesmo cliente do Vantoro.
Os nomes do WhatsApp eram diferentes — "Cristiano" e "CristanoCristiano
Ribeiro" — e a ficha cobriu os dois. Restaram duas linhas com o texto idêntico
e nada dizendo por qual número cada uma fala, num sistema onde **responder pelo
número errado não tem desfazer**.

**A régua é o que se VÊ.** Não "o mesmo cadastro", nem "o mesmo nome no banco":
é o texto que está na linha, porque é dele que vem a confusão. Duas linhas que
escrevem a mesma coisa passam a escrever mais — o telefone, ao lado do nome.

**E só elas.** Com o número em toda linha, o sinal vira ruído e deixa de ser
lido justamente no dia em que importa. A prova tem uma conferência só para
isso, e a sabotagem que mostra sempre é pega por ela.

**A comparação ignora caixa e espaço de sobra.** "Maria Silva" e "MARIA SILVA"
o olho separa; quem lê correndo, não. Mostrar o número a mais custa onze
caracteres; escondê-lo quando fazia falta custa uma resposta no número errado.

**Quem é cortado é o NOME, não o número** (`flexShrink: 0`). O nome está
repetido nas duas linhas e por isso não informa nada ali; o número é a única
coisa que as separa. Deixar o navegador escolher daria "CRISTIANO RIBEIRO DE
JESU… (19) 9820…" — o mesmo defeito do "Ropelimi Zo", com outra roupa. O nome
inteiro continua no `title`.

**Grupo fica de fora:** o "número" dele é `grupo:<identificador>`, que não é
telefone de ninguém — escrevê-lo trocaria um nome repetido por um código que
não quer dizer nada. A sabotagem que tira esse corte pinta `grupo:aaa111` na
linha, e a prova a pega.

**NÃO se confere se os números são diferentes, e é decisão.** Seria a pergunta
mais exata, e é código morto: `contatos.numero` é único e a lista é de **um**
telefone do escritório por vez, então duas linhas são dois contatos, e dois
contatos são dois números. A conferência daria um caminho que nenhuma prova
consegue exercitar.

**O cabeçalho da conversa já dizia o número** — foi consertado numa rodada
anterior, e por isso esta mudança é só na lista. **Um limite conhecido, deixado
de propósito:** naquele cabeçalho o número divide a linha com "digitando…" e
com "Fulana também está nesta conversa", e some enquanto uma delas aparece.
Mostrar os dois juntos é uma mudança de leiaute com medição própria, e não
entrou aqui. ~~(… e com "Fulana também está nesta conversa")~~ **Feito em
07/10, a pedido do Rodrigo com foto:** o aviso desceu para a linha das
etiquetas (`data-linha-das-etiquetas`, `data-tambem-esta`), e não cede espaço
para elas — duas pessoas respondendo o mesmo cliente é o que ele existe para
evitar. Na linha do número ele escondia também os três selos (responsável,
etapa, lembrete). O "digitando…" continua ali: dura segundos. Prova:
`presenca`, que mede o que se VÊ — a linha do número visível, e o aviso
abaixo dela; com o código antigo, três conferências reprovam.

**O que NÃO foi feito, por decisão do Rodrigo:** as quatro conversas deste
cliente (os dois números, cada um com conversa no SAC e no SDC CCR) ficaram
como estão. Nada foi apagado nem movido.

Prova: `duas-linhas-com-o-mesmo-nome`, 19 conferências, 5 sabotagens e 5 pegas.

## A espera começa na primeira mensagem sem resposta

Pedido do Rodrigo em 25/09: *"as atendentes do SAC me dizem que a organização
não fica muito clara"*. Elas trabalham de baixo para cima numa lista ordenada
pela **última mensagem** — e é isso que erra. O exemplo dele, com hoje em 25/09:

| | escreveu em | última mensagem | **esperando desde** |
|---|---|---|---|
| Cliente A | 21/09 e 24/09 | 24/09 | **21/09 — 4 dias** |
| Cliente B | 21/09 | 21/09 | **21/09 — 4 dias** |
| Cliente C | 24/09 | 24/09 | **24/09 — 1 dia** |

Pela última mensagem, A e C são a mesma coisa. A equipe zera o dia achando que
atendeu todo mundo, e A continua lá — **parecendo tão novo quanto quem acabou
de chegar**.

**E "Mais antigas primeiro" não resolvia**, apesar de a própria tela prometer
que sim: a frase dela dizia *"quem está esperando há mais tempo aparece no
alto"*, e havia um comentário no código afirmando que as duas coisas eram a
mesma. **Não são** — é exatamente aí que a lista enganava a equipe. As duas
frases foram corrigidas nesta rodada.

### `conversas.esperando_desde`, mantida pelo banco

A **primeira** mensagem do cliente depois da nossa última resposta. Escrever de
novo não reinicia a conta de ninguém. SQL:
`sql/automaticos/004-a-espera-comeca-na-primeira.sql`, no repo da ponte.

**Dois casos conferidos no código antes de escrever o gatilho:**

- **nota interna não é resposta** — ela mora em `notas`, não em `mensagens`, e
  o gatilho nunca a vê. O cliente também não;
- **resposta que falhou não é resposta** — a ponte só grava em `mensagens`
  depois que o WhatsApp aceita. Bolha vermelha vive em `fila_envio`.

**Gatilho NOVO e separado**, e não uma mexida no que já mantém a prévia e a
ordem: aquele foi criado à mão no começo do projeto e não está nos arquivos de
SQL — mexer no que não se tem à mão, para ganhar uma coluna, arriscaria a lista
inteira. E o corpo dele vive dentro de um `exception when others`, como o do
script 001: gatilho que estoura derruba o INSERT da mensagem, e **perder a
mensagem do cliente é o pior desfecho deste sistema**.

**`zorvin_recontar_espera()`** é a conta feita do zero. Enche a coluna agora e
conserta depois de uma importação de histórico, onde a ordem de chegada das
mensagens não é a cronológica e o gatilho incremental não tem como acertar.

### No painel

Uma **ordem nova** no menu que já existia, o rótulo **`esperando há N dias`** na
linha (âmbar, vermelho a partir de três), e nada mais — nenhuma tela nova para
a equipe aprender, nenhuma pílula a mais numa fita que já está cheia.

**Dias corridos**, decidido pelo Rodrigo: o cliente não sabe se o escritório
abre no sábado. E **por dia de calendário**, não por 24 horas cheias: quem
escreveu ontem às 23h espera "1 dia". As duas contas divergem justamente na
mensagem da noite, que é a que mais aparece de manhã.

**O rótulo só a partir de um dia.** Numa lista de SAC quase toda conversa tem
mensagem de hoje, e "esperando há 0 dias" em todas as linhas é ruído que se
aprende a não ler — aí o "há 5 dias" passa batido junto.

**A ordem vai para o BANCO**, e a tela só emenda as duas consultas (as fixadas e
a página) com o mesmo critério. Ordenar a lista já carregada daria *"quem mais
espera entre as 200 que vieram"*, e o cliente esquecido — o motivo de tudo isto
— mora fora das 200.

**`temEspera` tem três estados**, como `temVantoro.js`: `null` esconde, e só
`true` oferece a ordem. Sem a coluna, a consulta não devolve "sem ordem" —
devolve **lista de conversas nenhuma**. A resposta sai das linhas que já vieram
(a lista pede `*`, e o PostgREST escreve a chave mesmo com valor nulo), sem uma
consulta própria a cada abertura.

### Quatro coisas que só apareceram medindo, e as quatro eram minhas

**A abertura do painel ficou DUAS VEZES mais lenta, para todo mundo.** Pus
`temEspera` cru nas dependências de `carregarConversas` e escrevi no comentário
que custaria *"uma ida a mais, só para quem escolheu essa ordem"*. Não era: ele
sai de `null` para `true`/`false` em **toda** partida, e isso muda a identidade
da função — então a lista era recarregada **sempre**, inclusive para quem nunca
vai usar a fila. Medido pela prova `partida`: **11 consultas em duas rodadas e
1.461 ms** de espera, com a ida mais lenta em 745. Depois do conserto: **6
consultas, uma rodada, 735 ms**.

O que entra nas dependências é o booleano **`ordenarPelaEspera`**
(`ordem === "esperando" && temEspera === true`). No caminho comum ele vale
`false` antes e depois da resposta — nada muda, e não há segunda ida. A regra
que fica: **o que vai na lista de dependências é a PERGUNTA que a função faz, e
não o estado de onde ela sai.** Um estado com três valores atravessa dois deles
em toda abertura; a pergunta feita sobre ele, não.

**A prova não media a ordem do banco.** Ela rodava num telefone pequeno, onde
tudo cabe na primeira página — e ali a emenda que a tela faz já deixa a lista
certa. Trocar a ordem do banco pela de sempre **passava**. Hoje há uma cena no
telefone de 1.200 conversas, com um cliente cuja última mensagem é de 120 dias
atrás e que espera há 500: ele só chega à tela se quem ordenou foi o banco.

**`nullsFirst: false` é explícito, e o comentário dizia o contrário.** Subindo,
o Postgres já manda o nulo para o fim sozinho — escrevi que ele os punha na
frente, e foi a sabotagem que me corrigiu: ela tirava a opção e a prova
passava, porque não havia o que mudar. Fica escrito porque a regra se lembra
errado com facilidade (descendo é ao contrário) e porque `true` ali enche a
primeira página com quem não está esperando nada.

**A bancada monta conversa em nove lugares**, e o painel decide se a coluna
existe olhando UMA linha — no banco de verdade as linhas são todas iguais,
então uma basta. Bastava a primeira do telefone não ter a chave para o recurso
parecer não existir. Hoje há uma passada que normaliza todas; a prova pegou o
sintoma: o rótulo aparecia nas linhas e a ordem nova não era oferecida, duas
respostas contrárias sobre a mesma coluna na mesma tela.

### E a espera não começa no rabicho da conversa já atendida (28/09)

Relato do Rodrigo, com foto: a conversa da ANDREIA dizia **"esperando há 6
dias"**. Respondemos 22/09 **13:36**; ela escreveu "Tomara a Deus" às **13:37**
e só voltou a escrever hoje. Pela regra acima, a espera começa naquele 13:37 —
**um minuto** depois de a atendente ter respondido.

Isso é o **rabicho** de uma conversa atendida, e não uma espera.

**A regra nova:** a espera começa na primeira mensagem que chega **mais de 30
minutos** depois da nossa última ação, com um **encosto** — se nenhuma chegar
depois disso, vale a regra de antes, para que ninguém saia da fila em
silêncio. A conta inteira é do BANCO
(`sql/automaticos/006-a-espera-nao-comeca-no-rabicho.sql`, no repo da ponte);
**a tela não faz conta nenhuma disto**, pela mesma razão de sempre: duas
contas divergiriam, e divergir aqui é a lista dizer um número e o banco outro
sobre a mesma conversa.

**Os 30 minutos foram medidos**, e contra as 48 horas que o próprio Rodrigo
sugeriu: sobre as 832 conversas da fila, a janela de 48 h apagava **9,8 dias**
de espera em média contra 4,6 da de 30 min, e pulava pedidos de verdade
("Porfavor avisa ao financeiro que minha c…"). Quantas conversas mudam quase
não depende da janela; quanto tempo é apagado, sim.

**Aqui só mudaram duas frases**, e as duas porque passariam a mentir: o
comentário de `diasEsperando` e a explicação da ordem no menu, que dizia
"conta desde a primeira mensagem sem resposta" sem a metade nova.

### E a fila se embaralhava a cada conversa aberta (30/09)

Relato do Rodrigo, com duas fotos: *"com o filtro 'Esperando' ativado, após
eu clicar em qualquer conversa, a lista de conversas fica se atualizando e
mudando sozinha"*. Na primeira foto a fila abria em "esperando há 48 dias";
um clique depois, no alto estava "esperando há 7 dias".

**A ordem estava escrita em QUATRO lugares, e só um sabia da espera.** O
banco e `carregarConversas` ordenavam pela espera; o **tempo real**, a
conversa emendada pela busca e a emenda das conversas de fora das páginas
reordenavam por conta própria pela última mensagem. Abrir a conversa zera as
não lidas, o Supabase avisa a mudança, e o tempo real virava a lista para
"Recentes". A releitura seguinte (a pesca de 20s, a volta do canal, trocar de
filtro) a desvirava — daí o "fica mudando sozinha". Quando a ordem nova
entrou, em 25/09, só a primeira das quatro cópias foi ensinada.

Hoje é **uma régua só**, `compararConversas(ordem, pelaEspera)`, usada nos
quatro lugares; o tempo real a lê por espelho (`ordenarPelaEsperaRef`),
porque o tratador é registrado uma vez.

**E o tempo real passou a trazer a espera**, pela presença da chave e não
por `??`: quando a equipe responde, o banco grava `esperando_desde` NULO, e a
conversa tem de sair da fila na hora. Sem isso a linha continuava dizendo
"esperando há 48 dias" até a próxima releitura.

**O desempate é o do banco**: quem não espera vai para o fim, e entre esses a
mais recente primeiro. Antes era `Infinity - Infinity`, que dá `NaN` — o
navegador decidia a ordem de quem não espera, e ela podia mudar a cada
reordenação.

Prova: `a-fila-nao-se-embaralha`, 15 conferências. Com o painel de antes ela
reproduz o relato (a fila `48,30,20,7` vira `30,7,20,48` depois do clique).
**5 sabotagens e 5 pegas** — e uma vazou primeiro: a de "Antigas" esquecer o
sentido passava, porque a prova só conferia que a lista não MEXIA, e uma
lista na ordem errada também fica parada. Entrou a conferência da ordem em
si. **"Não mudou" não é "está certo".**

### Uma correção do que ficou escrito errado em 24/09

A entrada "E os outros dezoito lugares" dizia: *"medido, o clique no ⋮ da lista
abre a conversa em vez do menu"*. **Está errado, e a frase foi tirada.** O menu
funciona. O que havia era um erro na minha prova: `getByRole("button", { name:
"Opções da conversa" })` casa com **dois** elementos — o ⋮ e a própria linha da
conversa, que também é um botão e cujo nome acessível engole o texto de tudo o
que está dentro dela. Medido: 19 botões pelo `aria-label`, **38** pela busca por
papel. O `.first()` pegava a linha.

**A lição que fica para as próximas provas:** dentro da lista de conversas,
endereçar por `aria-label` ou por um `data-`, e não por papel mais nome.

**Ainda em aberto, e já decidido com o Rodrigo:** o botão **"Já tratei"**, que
tira uma conversa da fila sem mandar mensagem, com uma checklist obrigatória do
que foi tratado (BLINDAGEM, ACORDOS, VENDA LN…) e a lista de assuntos editável
na tela de administração. Vai numa PR própria. Sem ele, a fila acumula os
"obrigada!" — conversa que termina em agradecimento não recebe resposta e não
sai da espera sozinha.

Prova: `a-espera-comeca-na-primeira`, 27 conferências, 6 sabotagens e 6 pegas.

## "Já tratei" — a fila precisa de uma saída que não seja mandar mensagem

A fila do script 004 nasceu com **813 conversas**, e perguntar ao banco o que
elas são **desmentiu a minha suposição**:

| | quantas |
|---|---|
| nós respondemos e o cliente escreveu de volta | **601** |
| nunca respondemos nada | 214 |

E o que o cliente escreveu por último, nas 601: **`[anexo]` em 99** — o maior
grupo —, "ok" em 42, "boa tarde" em 22, "bom dia" em 12, "obrigada" em 9.

Eu imaginei a fila entupida de agradecimentos. Não está: o maior grupo é
**documento de cliente sem confirmação de recebimento**, e "bom dia" é conversa
que começou e ninguém atendeu. Somando as vinte mais frequentes, ~140 são
espera de verdade contra ~94 despedidas. **A fila estava certa** — e por isso o
vermelho dos três dias NÃO foi suavizado. O que faltava era uma saída para as
94.

### O que a tela ganha

Um botão na conversa aberta, que abre uma **checklist obrigatória** do que foi
tratado, tira a conversa da fila e deixa registro. Nada de novo na lista.

**A marcação é obrigatória e o botão nasce desligado.** Sem isso, "Já tratei"
vira um botão de "sumir com esta conversa" — e some junto a resposta para *"o
que a equipe fez em setembro"*, que é o motivo de existir um registro em vez de
só apagar a espera. O atrito também é proposital: duas decisões (abrir e
marcar) erram junto muito menos do que uma.

**Desfazer devolve a espera ORIGINAL**, e essa é a conferência mais importante
da prova. Escrever `esperando_desde = agora` no painel devolveria a conversa à
fila com **zero dia** — ela desceria para o fim com cara de cliente novo,
depois de ter esperado uma semana, e quem olha a lista não veria nada de
errado. Quem sabe a data certa é o banco (`zorvin_recontar_espera`), porque é
ele que tem as mensagens.

**A ordem das duas gravações é a decisão.** Primeiro o registro, depois a saída
da fila. Ao contrário, um registro que falhasse depois da saída deixaria a
conversa sumida **sem ninguém saber por quê**; nesta ordem, a falha é uma
conversa que continua na fila com um registro a mais — chata, e visível. Entre
um erro que se vê e um que não, escolhe-se o que se vê. Não há transação: o
PostgREST não oferece uma, e meia transação com desfazer-na-mão daria um
terceiro caminho de falha.

**Dois estados do banco, e são perguntas separadas:** `temTratada` (a coluna
existe?) e `temAssuntos` (a tabela respondeu?). O script 005 cria a tabela fora
do bloco guardado e a coluna dentro dele, então "meio aplicado" é um estado
real. `temAssuntos` segue a régua de `temVantoro.js`: `true` quer dizer "tem,
**ou não consegui saber**" — esconder por falha de rede tiraria a saída da fila
no dia em que a rede tossisse.

**O controle tem dois endereços, uma definição só** (`acaoJaTratei`): escrito
no cabeçalho no computador, item do menu ⋮ no celular — abaixo de 768px o
cabeçalho não comporta mais um botão, e os 40px de alvo de dedo não deixam
encolher os que já estão lá. Duas cópias divergiriam no primeiro conserto, e
divergir aqui é tirar da fila num aparelho e não no outro.

### Duas mentiras da bancada que a prova pegou

Nenhuma das duas era defeito do painel, e as duas teriam me feito consertar o
lugar errado:

- **`is(coluna, null)` não achava nada.** No Postgres a coluna existe em toda
  linha e quem grava sem mencioná-la deixa `null` ali; na bancada a chave
  simplesmente não existia, e `undefined === null` é falso. O "desfazer"
  carimbava zero registros.
- **A tabela que o script ainda não criou respondia LISTA VAZIA**, e não "não
  existe". São coisas diferentes, e sem a distinção o painel esconderia o botão
  pelo motivo errado — sumindo com a saída da fila no dia em que alguém
  apagasse o último assunto.

### Os assuntos

`AssuntosDoJaTratei.jsx`, na aba Estrutura da administração. **Não se apaga
assunto, desativa-se**: os registros guardam o `id`, e apagar deixaria o
relatório de setembro com linhas sem nome. Por isso o banco também não oferece
DELETE ali.

**Renomear conserta o passado inteiro** — bom para erro de digitação, ruim para
trocar de assunto, porque setembro passaria a dizer outra coisa. A dica na tela
diz isso, e é a diferença entre usar o lápis e usar "Parar de usar" + novo.

### E uma sabotagem minha que era um no-op

A primeira versão da sabotagem do desfazer escrevia `esperando_desde = agora`
no painel — e **a prova passou**. Ela estava certa: a recontagem roda logo
depois e sobrescreve com o valor correto, então aquela linha não decide nada.
Eu tinha sabotado um caminho que não existe.

O defeito de verdade é **não chamar a recontagem**, e ele tem duas faces, as
duas provadas agora: sem ela a conversa **não volta** (`esperando_desde` fica
nulo e o cliente some da fila para sempre), e com "agora" no lugar dela ela
volta com **zero dia**, descendo para o fim da lista com cara de cliente novo.

Fica a régua: **sabotagem que o resto do sistema conserta sozinho não prova
nada.** É a segunda vez nesta série — a outra foi o `nullsFirst: false`, que
o Postgres já faz sozinho.

Prova: `o-ja-tratei`, 44 conferências, 8 sabotagens e 8 pegas. A conversa da
despedida é **plantada pela prova** (cliente escreve → respondemos → ele
agradece) e não emprestada da bancada: a recontagem calcula a espera a partir
das mensagens, e sem essa forma a cena do desfazer não teria o que medir.

### O "OUTROS", e por que ele pede o que foi tratado (30/09)

Pedido do Rodrigo: *"preciso que seja incluída a opção OUTROS"*. Os oito
assuntos cobrem o dia a dia; o que sobrava não tinha onde ir, e a equipe
marcava o mais parecido — o relatório mentindo em silêncio.

**"OUTROS" sozinho não diz nada.** Um relatório com "OUTROS: 40" é a mesma
pergunta de antes com um número em cima. Então ele vem com um campo de texto
**obrigatório**: marcado, a janela pergunta *"O que foi tratado em OUTROS?"* e
o botão só liga com texto (espaço em branco não conta).

**Quem pede o texto é a MARCA do banco** (`zorvin_assuntos.pede_descricao`,
script 009 da ponte), e não o nome "OUTROS" escrito aqui. Quem compra o
programa pode chamar de "Diversos", ou querer descrição em "RECLAMAÇÃO"; a
chave *Pedir descrição* fica na administração, ao lado de *Parar de usar*.

**O texto vai só na linha do assunto que o pede** (`observacao`). Marcando
ACORDOS e OUTROS, a linha de ACORDOS fica sem texto — repetir ali faria o
relatório dizer a mesma coisa sobre dois assuntos. **E a chave nem vai quando
não há texto**: num banco sem a coluna, mandá-la derrubaria o registro inteiro.

**O campo só aparece com o assunto marcado.** Sempre à vista, ele viraria
"opcional" na cabeça de quem usa, e o obrigatório do OUTROS passaria a ser
ignorado junto. **Teto de 500**, o mesmo do banco, com contador.

**A leitura dos assuntos passou a pedir `*`.** Pedir `pede_descricao` por nome
num banco sem o script daria 42703 e derrubaria a lista — e com ela o botão
"Já tratei".

**E a bancada mentia a favor do defeito.** Ela devolvia a linha inteira
qualquer que fosse a coluna pedida — um painel que pedisse `id, nome, ordem,
ativo` receberia `pede_descricao` aqui e nunca no banco de verdade, e a prova
passaria com o OUTROS mudo em produção. Hoje `zorvin_assuntos` está em
`COM_PROJECAO`: a bancada devolve só o que foi pedido, e coluna que não existe
é 42703, como no Postgres. **A sabotagem que volta à lista de colunas é pega
por dez conferências.**

Prova: `o-outros-do-ja-tratei`, 40 conferências, **8 sabotagens e 8 pegas**.
Os cliques e `fill` dela são guardados — a primeira sabotagem "pegou"
estourando, e prova que estoura não diz QUAL conferência viu o defeito.

~~**Ainda em aberto:** onde LER isso.~~ **O relatório foi feito** — ver logo
abaixo. ~~**Continua em aberto:** o histórico de cada contato.~~ **Feito** —
ver "O "Já tratei" no histórico de cada cliente", mais abaixo.

### O relatório do "Já tratei" (30/09)

Pedido do Rodrigo: *"preciso de algum lugar para metrificar essas
informações, do que foi tratado, por quem"*. O "Já tratei" gravava desde 25/09
e não havia onde ler.

**Não é uma tela nova: é uma seção do Painel de números**, embaixo da MESMA
barra de filtros (período, atendente, telefone, departamento) — a régua
daquela tela é *"uma barra só, acima de tudo o que ela recorta"*, e um
segundo painel com filtros próprios faria dois números vizinhos falarem de
períodos diferentes sem avisar. Fica **fora** do bloco do Painel de sempre:
cada um tem a sua função no banco, e a falta de uma não esconde a outra.

**A conta é do banco** (`zorvin_relatorio_tratados`, script 010 da ponte),
pela régua da tela inteira: a API corta em 1000 linhas sem avisar, e um mês de
"Já tratei" passa disso.

**Um "Já tratei" é um CLIQUE, e não uma linha.** Marcar ACORDOS e OUTROS grava
duas linhas com a mesma conversa, a mesma pessoa e o mesmo instante; contar
linhas diria que a equipe tratou o dobro. O banco agrupa, e são três números
diferentes: *conversas tratadas* (clientes únicos), *vezes "Já tratei"*
(cliques) e o *por assunto* (linhas) — e a tela explica quando o último soma
mais que o do meio. **O desfeito não soma**, e aparece à parte e marcado na
lista: muitos desfeitos são, eles mesmos, a notícia.

**Quem não administra vê o próprio**, com o recorte feito NO BANCO
(`auth.uid()`); o "por pessoa" mostra todo mundo, como o "por atendente" do
Painel. E a função é `security invoker`: só enxerga as conversas que quem
chama já enxerga — um relatório não pode ser a porta dos fundos para os
clientes de um telefone que a pessoa não atende.

**Sem a função:** quem administra lê qual script falta; quem atende não vê
nada (um aviso sobre SQL não pede nada de quem atende). **Com a função
falhando**, a frase aparece com o código — falha não é ausência.

**Os dias sem nada entram como zero no gráfico**, completados na tela: o banco
devolve só os dias com "Já tratei", e sem completar um mês com um dia só vira
uma barra solta. Completar não é contar — o número de cada dia vem do banco.

**A planilha** leva os registros que vieram (até 1000, os mais recentes), com
`;` e BOM, que é o que o Excel em português abre direto e com acento.

**`nomeDoContato` foi para `contato.js`.** O relatório escreve nome de cliente,
e uma segunda regra de nome divergiria da primeira no primeiro conserto.

**E a bancada ganhou o `default now()` de `zorvin_tratamentos.quando`**, com o
MESMO instante para as linhas de um `insert` — que é o que o Postgres faz, e é
por esse instante que o relatório junta um clique. Sem isso a cena do caminho
inteiro (marcar na conversa e ver no relatório) não tinha o que medir.

**A prova `painel` reprovou, e ela estava meio certa.** A cena "banco sem a
função" exige *nenhum cartão de número* — e o relatório, que mora na mesma
tela, mostrava os dele. Esconder o relatório por causa de uma função que não é
a dele seria ausência no lugar de dado: os números vêm do script 010 e
continuam certos. A conferência passou a contar só os cartões **fora** do
relatório; a régua dela — *errado com cara de certo é pior do que vazio* —
continua valendo para os números que dependem daquela função.

Prova: `o-relatorio-do-ja-tratei`, 39 conferências, **8 sabotagens e 8 pegas**
(linhas contadas no lugar de cliques; os dias sem nada sumindo; a falha virando
ausência; o administrador sem o aviso do script; o filtro de telefone que não
recorta; o texto do OUTROS escondido; a planilha sem BOM; o desfeito sem
marca). A do caminho inteiro é a que importa: sem ela, a prova passaria com a
bancada inventando números que a tela nunca gravou.

### O "Já tratei" no histórico de cada cliente (01/10)

A outra metade do pedido de 30/09: *"e ter em cada contato também, talvez no
histórico"*. O relatório responde **o que a equipe fez**; esta seção responde
**o que já fizemos por esta pessoa** — a pergunta de quem abre a conversa de
um cliente que voltou.

**Mora no painel "Histórico de atendimento"**, que já existia e já era por
CONTATO: uma seção *Já tratei (N)* entre as alterações e a lista de
telefones. Cada registro diz quem marcou, os assuntos (na ordem da
administração), o texto do OUTROS, quando e por qual telefone.

**Por contato, e não por conversa.** O "Já tratei" do SAC sobre este cliente é
justamente o que o SDC precisa saber antes de responder — e é o que se perde
olhando só a conversa aberta.

**Direto do banco, sem a ponte e sem SQL.** A regra de leitura de
`zorvin_tratamentos` é aberta a quem entrou (script 005), então nada fica
recortado pelos telefones da pessoa. As conversas vêm da lista que o histórico
JÁ leu pela ponte — o escritório inteiro. Sem a ponte, ele lê o recorte que
alcança e **diz** que é parcial, como a lista de telefones já dizia.

**Um clique é um registro**, pela régua do relatório: as duas telas têm de
dizer o mesmo número.

**Três estados, e cada um diz o seu:**

| o banco | a seção |
|---|---|
| sem a tabela (005 não rodou) | não aparece — o recurso não existe |
| leitura falhou | a frase **com o código**, e nunca "ninguém marcou" |
| nenhum registro | "Ninguém marcou “Já tratei” com este cliente ainda" |

O segundo é a armadilha nº 2: "ninguém marcou" no lugar de "não consegui ler"
faria a pessoa responder o cliente como se fosse a primeira vez.

**O desfeito fica, marcado e com quem desfez.** "Marcaram e desfizeram" é
outra resposta que "ninguém marcou".

**E a seção acompanha o clique:** marcar ou desfazer com o histórico aberto
ao lado relê a seção. Sem isso ela continuaria dizendo o que era verdade antes
do clique, e quem acabou de marcar concluiria que não gravou.

**Um defeito da prova do relatório, achado por esta:** a semente chamava
`diasAtras(1)` duas vezes para "o mesmo instante" de um clique, e duas
chamadas podem cair em milissegundos diferentes — viram dois cliques. Ela
passava por sorte; a irmã desta rodada pegou na sabotagem, contando quatro
registros onde havia três. Hoje as duas provas têm UM `AGORA` para a semente
inteira.

Prova: `o-historico-do-ja-tratei`, 34 conferências, **8 sabotagens e 8 pegas**
(linhas no lugar de cliques; a falha virando ausência; o desfeito sumindo; o
texto do OUTROS escondido; só um telefone; a seção que não relê depois de
marcar; o aviso de parcial tirado; a tabela que falta virando "ninguém
marcou").

### O "Já tratei" em toda conversa (02/10)

Relato do Rodrigo, com foto: a conversa da BEATRIZ aberta e **nenhum "Já
tratei" no cabeçalho** — *"veja se não está acontecendo em outros contatos
também"*. Estava: em **toda conversa em que a equipe respondeu por último**.

**Não era defeito de leiaute, era desenho meu.** O botão nasceu para aparecer
só "quando há o que fazer" — conversa esperando (tratar) ou já tratada
(desfazer) —, e o comentário dizia que nas outras ele seria ruído. A suposição
errada era que o "Já tratei" serve só para tirar da fila. Ele é também **o
registro do que foi feito**, e é dele que saem o relatório e o histórico do
cliente: o que se tratou numa conversa respondida conta igual.

**Hoje ele aparece em toda conversa**, e são três casos:

| a conversa | o botão | marcar faz |
|---|---|---|
| esperando | "Já tratei" | registra e **tira da fila** (como antes) |
| respondida | "Já tratei" | **só registra** — a janela diz isso, e não promete fila |
| tirada da fila pelo "Já tratei" | "Voltar para a fila" | desfaz (como antes) |

**Na respondida, `tratada_em` NÃO é gravado.** Gravado, o botão viraria
"Voltar para a fila" numa conversa que nunca esteve nela. O que não tem nesse
caso é o desfazer: um registro errado ali só pesa no relatório e no histórico,
onde aparece com quem marcou.

**E a largura do cabeçalho tinha um furo que eu afirmei não existir.**
Escrevi aqui que `FILA_ESCRITA` e `FILA_EM_ICONES` já somavam o botão; a prova
`o-cabecalho-nao-corta-o-que-importa` reprovou (o nome com **205px** a 1366,
abaixo do piso de 230) e a medição mostrou que **não somavam**: 383 e 256 são
os seis botões SEM ele. O furo já existia em toda conversa da fila, calado,
porque a prova abre a primeira conversa da bancada e ela não esperava.

Hoje o botão soma à parte, medido na régua do navegador: escrito, "Já tratei"
custa 90 e "Voltar para a fila" 139; em ícone, 35 — mais o vão de 12. Com
isso, a 1366 com a ficha aberta a fila **recolhe no ⋮** (antes ficava em
ícones e espremia o nome), e a 1600 fica em ícones. **Medir de novo depois de
mudar o que a fila mostra** — é a lição do "Ropelimi Zo" outra vez.

**E a integração contínua pegou uma prova que supunha a largura antiga.**
`esconder-o-vantoro` abria a 1360 com a ficha aberta e procurava o botão da
ficha NA BARRA — que, com a conta certa, recolhe no ⋮ ali. O botão saía da
barra por falta de espaço, e não por falta de Vantoro: a conferência passou a
medir outra coisa. Ela roda a 1600 agora, com o motivo escrito no ajudante.
**E na rodada seguinte foi a `identidade`**, pelo mesmo motivo: a 1360 o
grupinho de "quem participou" tinha ido para o ⋮, e o clique nele estourou a
prova inteira depois de 30 segundos. Também roda a 1600. Rodei aqui as provas
do cabeçalho e do "Já tratei", e não estas duas — **ao mexer na conta de
largura, rode toda prova que procura um botão da barra**, e não só as que têm
"cabeçalho" no nome.

Prova: `o-ja-tratei-em-toda-conversa`, 25 conferências, com a conversa da foto
plantada (o cliente pergunta, nós respondemos por último) e o contraste da que
espera. **5 sabotagens e 5 pegas** (o botão só na que espera; a respondida
ganhando `tratada_em`; a janela prometendo a fila; o aviso dizendo que tirou da
fila; a largura sem a parcela do "Já tratei", pega por
`o-cabecalho-nao-corta-o-que-importa`).

## O aviso do nono dígito não previa nada — e mandou mexer na ficha de um cliente

Relato do Rodrigo em 28/09 (com o número trocado por um de exemplo em 28/10):
ele acrescentou `(71) 99001-2345` na ficha de um
cliente que já tinha `(71) 9001-2345`, o número novo apareceu na lista com o
selo "WhatsApp", **e não havia como conversar por ele**. Pediu para eu procurar
o defeito.

**Não havia defeito nenhum no botão.** `chaveDoNumero` junta as duas formas de
propósito — é o que impede o mesmo cliente de virar duas conversas —, então o
painel concluiu, corretamente, *"isto é a conversa em que você já está"*.

### O que caiu foi a PREMISSA do aviso, e a medição a derrubou

Eu cheguei a dizer que a conversa vazia era prova de que as duas formas não são
intercambiáveis. **Era palpite, e o banco desmentiu** — nas 1.802 conversas do
escritório:

| forma | conversas | respondemos | vazias |
|---|---|---|---|
| antiga (8 dígitos) | 805 | **73,8%** | 12,0% |
| com o nono dígito | 997 | **72,7%** | 16,6% |

A forma antiga recebe resposta nossa um pouco **mais** do que a nova, e fica
vazia um pouco **menos**. A Uazapi resolve sozinha. O aviso mandava desconfiar
de uma coisa que, nos números do próprio escritório, não é um problema.

**E ele aparecia em 805 conversas — 44% da lista inteira.** É a armadilha do
alarme que não pede ação no pior tamanho possível: quase metade das conversas
com uma tarja âmbar que se aprende a não ler, e aí a do **DDD inválido** — que
prevê de verdade — passa batida junto.

**O dano não é hipotético:** foi essa tarja que mandou o Rodrigo conferir a
ficha, e é por isso que hoje há um número duplicado no cadastro de um cliente.

**Os outros avisos ficam.** "DDD que não existe" e "isto é um fixo" dizem
coisas verificáveis sobre o número em si. Este dizia uma coisa verificável
("está na forma antiga") e a emendava com uma **insinuação sobre entrega** — e
foi a insinuação que foi medida e caiu.

**O aviso já tinha sido corrigido uma vez**, de "o WhatsApp só conhece X"
(forte e falsa) para a redação cautelosa. Não bastou: o texto estava honesto e
a premissa continuava errada. **Frase cuidadosa sobre um fato que não existe
continua sendo ruído.**

### E a quarta roupa da mesma forma

A tela **não disse nada**. O número entrou na lista e o botão não apareceu, sem
uma palavra. É a forma que este projeto já encontrou três vezes: ausência no
lugar de falha (04/09), sucesso no lugar de falha (24/09), falha sem causa
(25/09) — e agora **silêncio no lugar de uma explicação**. O efeito é sempre o
mesmo: alguém procura defeito onde não há.

Hoje a ficha recusa **antes de gravar** e diz por quê: *"é a MESMA linha de
(71) 9001-2345 — no WhatsApp o nono dígito não muda a conta"*. Acrescentar uma
segunda escrita do mesmo número não conserta nada e deixa a lista com duas
linhas que parecem dois telefones.

**As conferências das provas foram INVERTIDAS, e não apagadas** — escritas ao
contrário, elas são o que impede o aviso de voltar por engano numa limpeza
futura. Um `null` sem prova nenhuma seria só a ausência de teste. A sabotagem
que devolve o aviso é pega por quatro delas.

**E a cena do celular trocou de conversa**, não de medida: ela mede o TAMANHO
da tarja num aparelho de 360px, e para isso precisa de uma conversa que ainda
tenha uma — agora é a do telefone fixo. Trocar a medida por "não há tarja"
perderia a única conferência que existe sobre a tarja não comer um quinto da
tela.

Provas: `numeros` (65), `numero-que-nao-recebe` (15), `ficha` (14).

## O cliente que voltou por um número novo — achado pelo CPF (29/09)

Relato do Rodrigo, com duas fotos: o CRISTIANO RIBEIRO DE JESUS tem cadastro
no Vantoro com `(71) 8425-3304`, formatou o celular e voltou a escrever por
`(19) 98209-4819`. A ficha procura pelo **número da conversa**, disse —
corretamente — que *"este número ainda não tem cadastro"*, e ofereceu criar
um. **Criar seria o duplicado:** o histórico do cliente partido em dois, e a
ordem de serviço dele numa ficha que não é a dele.

**O CPF é o que não muda quando o telefone muda.** Sem cadastro pelo número, a
ficha procura pelo CPF — a mesma pergunta que já existia para avisar do CPF
repetido (`/vantoro/cpf-existe`) — e, achando, **pergunta** se o número novo
entra no cadastro achado. Nenhuma rota nova na ponte: o número entra pela
mesma rota do "+ Acrescentar" da ficha aberta.

**O CPF passou a vir PRIMEIRO**, antes do nome. Com ele embaixo, o gesto
natural era preencher de cima para baixo e apertar Criar. E é o **mesmo**
campo que o pré-cadastro usa — dois campos de CPF na mesma tela fariam a
pessoa perguntar em qual digitar.

**Quatro respostas, e cada uma diz o que fazer:**

| a procura | a ficha diz | e oferece |
|---|---|---|
| procurando | "Procurando este CPF no Vantoro…" | — |
| achou | de quem é, o telefone de antes, as ações | **acrescentar este número** · só abrir |
| não achou | "Nenhum cadastro com este CPF" | o pré-cadastro |
| **falhou** | "isto **não** quer dizer que a pessoa não seja cliente" | tentar de novo |

**A última é a que evita o duplicado no dia em que a ponte tossir.** Na ficha
aberta, a falha da mesma pergunta continua calada (lá o silêncio quer dizer
"o CPF é livre", e o Vantoro recusa o duplicado de qualquer jeito); aqui ela
é dita, porque o CPF foi digitado para PROCURAR alguém.

**Achou, o pré-cadastro sai de cena.** Criar ali seria o duplicado, e o
Vantoro recusaria o CPF depois de a pessoa escolher o papel. Trocando o CPF,
ele volta.

**A ordem dos passos é a decisão:** a ficha **inteira** primeiro, o número
depois, o vínculo da conversa por último. Se a ficha não vier, **nada muda** —
e a frase diz isso com todas as letras, porque "o Vantoro não respondeu"
sozinho deixa a dúvida que faz clicar de novo. Ao contrário, uma conversa
ligada a um cadastro que não tem o número dela voltaria a dizer "não tem
cadastro" na abertura seguinte: a ficha procura pelo número, e o vínculo
sozinho não basta para ela achar.

**O número entra como mais um, e não como o WhatsApp principal.** Trocar o
principal já tem botão próprio ("usar este como WhatsApp"); fazê-lo calado
aqui mudaria por onde saem os avisos de audiência do cliente sem ninguém ter
escolhido isso.

**O número que já está lá com outra escrita não é mandado de novo** — com e
sem o nono dígito são a mesma conta no WhatsApp (ver "O aviso do nono
dígito", acima). A conversa é ligada assim mesmo, e a frase diz que ele já
estava.

**O "não é ele" também tem saída**, e ela não é criar outro cadastro: pode ser
a mãe falando pelo celular do filho com o CPF dele na mão. *"Só abrir o
cadastro, sem acrescentar este número"* é o caminho que já existia na ficha
aberta.

**Sobra consertada junto:** `escolher` não trazia a lista de telefones do
cadastro escolhido — só `buscar` a preenchia. Escolher pela lista de
candidatos ou pelo CPF de outro desenhava a ficha nova com os telefones da
anterior, ou nenhum.

**E um tropeço meu de processo, que fica escrito:** esta rodada foi feita
numa segunda cópia da pasta (`git worktree`), com `node_modules` ligado por
atalho à cópia principal. O `.gitignore` diz `node_modules/`, com a barra —
e a barra só casa com **pasta**. O atalho é um arquivo, passou, e entrou no
primeiro commit. Tirado antes da PR; ao repetir o truque, confira o
`git status` antes do `git add -A`.

Prova: `o-numero-novo-acha-o-cadastro-pelo-cpf`, 32 conferências, **6
sabotagens e 6 pegas** (o Criar que continua; a falha que vira "não achou";
o número mandado sem conferir o nono dígito; o número antigo no lugar do
desta conversa; a conversa que não é ligada; o número mandado antes da ficha
inteira).

## O pré-cadastro não promete mais a ordem — a tarefa é pedida (02/10)

Pedido do Rodrigo: no pré-cadastro, uma caixa **"Criar a tarefa “Cadastro de
ações do cliente”"**, desmarcada, e os textos parando de prometer que o
pré-cadastro abre a ordem de serviço. Desmarcada, nasce só o cadastro, e a
ordem abre quando a venda for lançada.

**O pedido sempre leva `criar_tarefa_cadastro`, true ou false**, junto com
`papel` — a ponte repassa o corpo como vem e não mudou. **Para a parte
contrária vai `false` mesmo que a caixa tenha ficado marcada** antes de trocar
o papel: ali ela nem aparece, e o que não se vê não pode ser pedido.

**A caixa volta desmarcada a cada troca de conversa**, no mesmo efeito que
volta o papel para "cliente". Com a ficha fixa ela não é remontada, e uma
marca esquecida abriria tarefa no pool para o lead seguinte.

**O aviso sai da RESPOSTA (`tarefa_cadastro`), e não da caixa**: é o Vantoro
quem sabe se a tarefa nasceu. Três casos:

| a resposta | o aviso |
|---|---|
| `criado` e `tarefa_cadastro: true` | "…criado no Vantoro, com a tarefa…" |
| `criado` e `tarefa_cadastro: false` | "…criado no Vantoro, sem tarefa." |
| `criado: false` (já existia) | "Já existia no Vantoro." e, **se a tarefa foi pedida**, que ela não é criada por ali — abrir pela ficha no Vantoro |

Sem `tarefa_cadastro` na resposta (um Vantoro de antes desta mudança), a
frase não afirma nada sobre a tarefa e, se ela foi pedida, manda conferir.

Prova: `o-pre-cadastro-e-a-tarefa`. Ela lê o aviso pelo **filme**, começando
na frase que já está na tela — a faixa dura quatro segundos, e o aviso do
pré-cadastro anterior entraria no filme do seguinte como se fosse dele (foi a
primeira reprovação da prova, e era dela, não do painel). A conferência de
`cliente-ou-reu` que pedia "ordem de serviço" na frase de Cliente passou a
pedir "ordem": a frase desmarcada fala da ordem que abre com a venda.

**8 sabotagens e 8 pegas** (a chave fora do corpo; o réu levando a caixa; a
caixa que não desmarca na troca; o aviso lido da caixa e não da resposta; o
"já existia" calado; a caixa para o réu; a promessa antiga de volta; a caixa
nascendo e voltando marcada). **E uma vazou, com razão:** trocar só o
`useState(false)` por `true` não muda nada, porque o efeito da conversa
desmarca a caixa assim que a ficha monta — é a régua de 25/09, *sabotagem que
o resto do sistema conserta sozinho não prova nada*. O defeito de verdade é o
efeito voltando para marcada, e esse a prova pega por 17 conferências.

## O responsável pela conversa — o primeiro passo para CRM (30/09)

Pedido do Rodrigo, depois de perguntar o que falta para o Zorvin virar CRM:
*"pode começar pelo responsável pela conversa"*. Até aqui o banco sabia quem
ESCREVEU em cada conversa (`mensagens.enviado_por_id`) e quem está com ela
aberta agora (`atendendo_por`), mas não quem **responde** por aquele cliente.
Sem isso não há "as minhas conversas", não há passar um cliente adiante, e
não há como cobrar a fila de ninguém.

**Três colunas em `conversas`, e nenhuma tabela nova** —
`responsavel_id`, `responsavel_em`, `responsavel_por` (script
`sql/automaticos/008-o-responsavel-pela-conversa.sql`, no repo da ponte). A
tela precisa da resposta em toda linha da lista, e uma tabela à parte seria
uma segunda consulta por página. `responsavel_por` existe porque *"quem me
passou isto?"* é a primeira pergunta de quem recebe um cliente no meio.

**`temResponsavel` tem três estados**, pela régua de `temTratada`: sem o
script, NADA aparece — nem o controle, nem o filtro, nem o rosto na linha.
"Minhas conversas" sem a coluna seria uma lista sempre vazia dizendo "nenhuma
conversa sua", que é mentira.

### Quem responde primeiro, assume — e só se não houver dono

Sem isto as 1.800 conversas nasceriam "sem responsável" e o recurso ficaria
vazio até alguém clicar em cada uma. **E não toma de ninguém:** responder
numa conversa que já tem dono não muda o dono. "Assume sempre quem responde"
faria a conversa trocar de mãos a cada ajuda de colega, e o responsável
deixaria de querer dizer qualquer coisa.

**A condição vai NA gravação** (`.is("responsavel_id", null)`), e não numa
conferência antes. Conferir a lista local não basta, porque a lista local é
justamente o que está atrasado quando duas pessoas respondem juntas. Zero
linhas ali é o desfecho LEGÍTIMO (a colega chegou antes), e por isso essa é
uma gravação que não diz nada na tela. **Foi a sabotagem que me mostrou que
a prova não tinha essa cena**: tirando a condição, ela passava, porque a
conferência local cobria todos os casos em que a tela já sabia do dono.

### Onde ele mora na tela

| | computador | celular |
|---|---|---|
| a conversa aberta | na linha do número, um botão com o rosto e o nome | a mesma linha, só texto ("com você") |
| o gesto | clicar ali | pelo ⋮ |
| a lista | rosto de 18px no canto da linha; **o meu tem anel verde** | igual |
| o filtro | "Minhas conversas" no menu da seta | igual |

**Na linha do número, e não um botão a mais na fila da direita:** aquela
fila tem a conta de largura de 29/09, e um botão novo empurraria o nome do
cliente de volta para o "ELANE GO…". **O número não encolhe** (`flexShrink:
0`): quem cede espaço é o nome do responsável.

**O menu é uma definição com dois endereços** (`listaDeResponsaveis`,
`menuResponsavel` = `"linha"` ou `"menu"`), pela régua de sempre: duas
escritas divergiriam, e divergir aqui é poder passar a conversa num tamanho
de tela e não no outro. **"Assumir" vem primeiro e separado** — é o gesto de
todo dia; passar adiante é o de exceção.

**A frase espera o banco** (`gravarMarcaDaConversa`, o caminho das quatro
marcas). **E a frase do menu não pode herdar `nowrap`**: a linha de onde ele
pende é a do número, e "Quem responder primeiro assume" saía cortada em
"assu" — foi a primeira coisa que a foto da bancada mostrou.

**O tempo real traz o dono pela PRESENÇA da chave**, não por `??`: tirar o
responsável grava nulo de propósito, e `??` deixaria a tela dos colegas
dizendo "com a Jenifer" para uma conversa que ela devolveu.

**"Minhas conversas" vai ao banco** (`extrasMinhas`), pela mesma razão do
filtro de grupos: a minha conversa de dois meses atrás está fora das 200 da
primeira página, e filtrar só o que está carregado seria "as minhas entre as
recentes" com cara de "as minhas".

### O Vantoro fica para o escritório; quem compra ganha o Zorvin sozinho

A pergunta do Rodrigo veio junto: *"se para o escritório for melhor usar o
Vantoro, mantenha; para vender, veja se dá para liberar as telas do Vantoro
ou de outra forma"*. **O responsável não depende do Vantoro em nada** — é
pessoa do Zorvin (`usuarios.id`), nos dois mundos. O caminho para vender
continua sendo o de 14/09 (`VITE_VANTORO=desligado`), e o que falta nele é a
ficha própria do Zorvin; "liberar as telas do Vantoro" amarraria cada
comprador a um segundo sistema para instalar e manter.

### E um erro meu de processo, que repete o de 29/09 com outra roupa

Uma rodada de sabotagens foi **interrompida no meio** (o Rodrigo chegou com
o relato da fila). A interrupção matou o script entre escrever a sabotagem nº
2 e restaurar o arquivo — e eu, sem conferir, guardei aquilo num commit de
rascunho. A cópia "conferida" da rodada seguinte foi tirada DESSE commit, e a
primeira sabotagem pareceu pegar por um motivo que não era o dela. **Hoje o
script restaura num `finally`, e a cópia de referência sai de um commit cuja
prova acabou de passar inteira.**

Prova: `o-responsavel-pela-conversa`, 62 conferências, **8 sabotagens e 8
pegas**. Ela mede o menu **pintado** (`elementFromPoint`), porque o menu de
etiquetas já foi recortado por um ancestral sem o retângulo saber.

**Ainda em aberto:** o histórico de quem passou para quem (hoje só o último
passe fica). ~~E o relatório por responsável.~~ **Feito** — ver logo abaixo.

### O relatório por responsável (01/10)

Pedido do Rodrigo: *"pode seguir com o relatório por responsável"*. O
responsável nasceu para dar para **cobrar a fila de alguém**, e faltava onde
LER a fila de cada um.

**Uma seção do Painel de números**, entre o Painel de sempre e o "Já tratei",
com uma linha por pessoa e **uma linha para "sem responsável"** — a fila de
onde qualquer um pode puxar trabalho. Por linha: conversas, quantas esperam,
quantas **há 3 dias ou mais** (o vermelho da lista, com a mesma cor), a espera
mais antiga e as não lidas. **Quem tem mais atrasada vem primeiro**, que é a
pergunta da tela.

**É uma FOTO DE AGORA, e a seção diz isso.** O banco guarda só o dono de hoje
(o histórico de passes não existe), então o período da barra NÃO vale aqui —
quem escolhe "setembro" leria a carteira de hoje achando que é a de setembro.
Telefone e departamento valem.

**A conta é do banco** (`zorvin_relatorio_responsaveis`, script 011 da ponte):
a API corta em 1000 linhas e o escritório tem ~1.800 conversas. **Arquivadas e
telefones desativados ficam fora** — não são trabalho de ninguém agora.

**Quem não administra vê a própria carteira e a fila sem dono**; as dos
colegas são para quem administra cobrar. O recorte é feito no banco.

**A conta dos dias mora em `espera.js` (`diasDesde`)**, e `diasEsperando` da
lista passou a chamá-la: o relatório e o rótulo "esperando há N dias" diriam
dois números sobre o mesmo cliente se cada um fizesse a sua.

**Três estados que dizem o seu:** sem a função, quem administra lê "rode o
011"; **sem a coluna do responsável, "rode o 008"** — a função responde
`{falta: "008"}` em vez de uma lista vazia, que se leria como "ninguém tem
conversa"; com a função falhando, a frase com o código. Quem atende não vê
aviso de script.

Prova: `o-relatorio-por-responsavel`, 33 conferências, **7 sabotagens e 7
pegas** (a linha sem dono escondida; a falha virando ausência; o 008 que falta
virando tabela vazia; o filtro de telefone ignorado; a seção sem dizer que é
agora; a atrasada sem vermelho; a minha linha sem o "você"). E três no SQL,
num Postgres de verdade (a arquivada contando, o recorte de quem não
administra tirado, a régua dos três dias trocada), as três pegas.

## A mensagem agendada (02/10)

Pedido do Rodrigo: *"ter a opção de agendar mensagens"*. Decidido com ele:
**texto e anexo**; a mensagem **sai na hora marcada mesmo que o cliente
escreva antes**; **qualquer pessoa da equipe cancela** enquanto ela não saiu.

**Não é uma tabela nova: é um item da `fila_envio` com hora marcada**
(`agendada_para`, script 013 da ponte). A fila já sabe mandar texto, imagem,
áudio, documento e figurinha, já insiste quando a Uazapi tosse e já avisa
quando para — uma segunda fila divergiria no primeiro conserto.

**A hora vai em DOIS lugares, `agendada_para` e `tentar_em`.** A leitura da
ponte já pula quem tem `tentar_em` no futuro, e o `fila_parada` do
`zorvin_saude()` também — então nem a ponte nem o aviso vermelho precisavam
mudar para a agendada esperar. A ponte ganhou assim mesmo uma guarda própria
pela `agendada_para` (ver o CLAUDE.md dela): mensagem que sai antes da hora
não tem desfazer.

**Agendar NÃO passa por `inserirNaFila`.** Lá, responder marca a conversa como
minha e assume o dono. Agendar não é responder: o cliente não recebeu nada, e
a conversa não pode sair da fila de quem espera nem trocar de mãos por uma
mensagem que talvez seja cancelada. Pela mesma razão **não há bolha
provisória** — uma bolha com relóginho diria que algo foi ao cliente.

**Onde aparece:** o relógio fica ao lado do Enviar, **só com texto na caixa**
(agendar é agendar ESTE texto), e na prévia dos anexos. A janela da hora é uma
só (`EscolherHora.jsx`), com três atalhos ("Daqui a 1 hora", "Amanhã às 9h",
"Amanhã às 14h") e o campo de dia e hora. **O botão de confirmar escreve a
hora** ("Agendar para amanhã às 09:00"): é a última chance de conferir. Hora
que já passou é **dita** e o botão fica desligado — aceita calada, a mensagem
sairia agora. As contas de hora moram em `agenda.js`.

**As agendadas ficam numa faixa logo acima da caixa de escrever**, e não no
meio das bolhas: nada daquilo chegou ao cliente. Cada linha diz a hora, quem
agendou e tem **Cancelar**; a que já está na hora diz "Saindo agora…" e não
oferece cancelar. A lista se relê sozinha dez segundos depois da próxima
hora, e pelo tempo real quando um colega agenda ou cancela.

**Cancelar é virar o item para `cancelada`**, com `.eq("status","pendente")`
na gravação: se a ponte pegou o item no mesmo segundo, quem chegou primeiro
fica, e zero linhas vira a frase *"ela já saiu, ou o banco não deixou"* — e
nunca "cancelado". A política do 013 deixa fazer só essa passagem.

**`temAgenda` tem três estados**, como `temTratada`: sem a coluna o relógio não
aparece. A leitura das agendadas pede as colunas **pelo nome**, e é a coluna
que falta que responde se o 013 rodou. **Falha de leitura vai para a faixa
âmbar**, e não vira "nada agendado": aquilo faria alguém agendar de novo, e o
cliente receberia duas.

**O botão "Ir para o fim" pousava em cima do Cancelar.** Ele era
`bottom: 84` contado do fundo da coluna, supondo só a barra de escrever
embaixo; com qualquer faixa acima dela (as agendadas, a citação, a edição) ele
caía em cima. Hoje ele pende de uma âncora de altura zero entre as bolhas e o
que vier embaixo. **Foi a prova que achou**, por um clique que não passava.

**A bancada aprendeu duas coisas:** recusar a LEITURA que pede pelo nome uma
coluna de `__SEM_COLUNAS` (só recusava gravação), e `__DEPOSITO_COM_ENDERECO`,
um endereço de depósito de verdade para o anexo chegar à fila (o padrão
continua vazio, que é sobre o que as provas dos anexos foram escritas).

Prova: `a-mensagem-agendada`. **E uma armadilha dela:** a bancada já tem um
`procuracao.pdf` na conversa, e a conferência "nenhuma bolha do anexo"
reprovou por causa DELE. Arquivo de prova leva nome que ninguém mais usa.

### Editar a agendada, e a janela redesenhada (05/10)

Pedido do Rodrigo, com a foto da primeira janela: *"quero que tenha a opção de
editar a mensagem. E melhore o visual da tela de agendamento"*.

**Editar** — botão ao lado do Cancelar, na faixa. Abre a MESMA janela
(`EscolherHora`, modo `editar`), no meio da tela, com o texto (ou a legenda do
anexo) numa caixa e a hora de agora já escolhida. Salvar grava texto e hora —
a hora nos dois lugares, como ao agendar — com `.eq("status","pendente")`.
**Texto de mensagem não pode ficar vazio** (para não mandar, é o Cancelar);
legenda de anexo pode.

**O botão some no último minuto antes da hora** (`aindaDaParaEditar`), e o
banco recusa a partir da hora (script 016 da ponte): é o que fecha a corrida
com a ponte, que só lê a agendada depois da hora. **A recusa vem como erro
(42501), e não como zero linhas** — a regra do cancelar alcança a mesma linha
—, e a frase diz as duas causas com o código.

**O redesenho:** atalhos em CARTÕES com a hora escrita embaixo ("amanhã,
09:00"), com nomes curtos para não quebrar a linha ("Amanhã cedo", "Na
segunda" — a próxima segunda depois de amanhã); **dia e hora em dois campos**,
com rótulo e `colorScheme` do tema (o campo único aparecia como
"dd/mm/aaaa --:--" e, no escuro, sem o ícone do calendário); um **resumo
verde** por extenso ("Sai segunda-feira, 13/10, às 09:00") entre a escolha e o
botão; e a prévia da mensagem embaixo do título. **O botão continua escrevendo
a hora**, e a hora que não serve continua sendo dita.

Prova: `a-mensagem-agendada`, agora **73 conferências**, com as cenas da
edição (o texto e a hora mudando nos dois lugares; o vazio recusado; o botão
sumido no último minuto; a recusa do banco dita com o código).

## O funil de etapas (06/10)

Pedido do Rodrigo como segundo passo para CRM: *"pode começar pelo funil de
etapas"*. Decidido com ele: **um funil por departamento**, as etapas
sugeridas (Novo contato → Em atendimento → Aguardando cliente →
Proposta/acordo enviado → Acordo fechado → Em execução → Encerrado),
editáveis na administração, e **o cartão é o cliente**. Enquanto o Zorvin não
tem ficha própria, "cliente" é o **contato** (um número de WhatsApp): a mesma
pessoa por dois números são dois cartões — dito a ele antes de começar.

SQL: `sql/automaticos/017-o-funil-de-etapas.sql`, no repo da ponte, onde
estão as regras do banco (etapa não se apaga, o histórico é do gatilho, o
cliente novo entra sozinho na primeira etapa, quem vê o cartão é quem vê as
conversas dele).

### Onde ele mora na tela

| | |
|---|---|
| **a tela de colunas** | menu ⋮ do topo → **Funil** (`Funil.jsx`, `data-tela="funil"`) |
| **a etapa da conversa aberta** | na linha do número, ao lado do responsável — clicar troca a etapa, ou **"Pôr no funil"** |
| no celular | a linha só diz a etapa — escrita onde cabe, e a bolinha da cor dela quando não cabe (27/10) —; trocar é pelo ⋮ ("Etapa no funil") |
| **as etapas** | administração → aba Estrutura → *Etapas do funil* (`EtapasDoFunil.jsx`) |

**Mover tem dois caminhos, arrastar e a lista "Mover para…" do cartão.** A
lista não é enfeite: arrastar não funciona no celular nem por teclado, e um
funil que só se move com mouse deixa metade da equipe sem mexer nele.

**O cartão mostra o que decide o próximo passo**: nome, número, não lidas,
*"nesta etapa há N dias"* e o *"esperando há N dias"* da lista, com a mesma
cor. Clicar abre a conversa — no telefone dela, mesmo que não seja o aberto
(`verConversaDoHistorico`).

**O cartão numa etapa DESATIVADA não some**: vai para a coluna *"Em etapas
desativadas"*, no fim, até alguém movê-lo. Escondê-lo seria o cliente sumindo
do funil por uma decisão de configuração, sem ninguém ter mexido nele.

**Mover é otimista e VOLTA na recusa**, e a frase diz por quê — com o código
quando houve erro, e *"o banco não deixou"* quando foi recusa calada
(`naoGravouNada`). Nunca *"foi para…"* sem ter ido.

**"Trazer conversas"** (só quem administra) põe na primeira etapa quem
conversou nos últimos N dias e ainda não está no funil, e **diz quantos** —
o número sai do banco, e não da tela.

**`temFunil` tem três estados**, como `temTratada`: sem o 017 nada aparece —
nem o item do menu, nem a etapa na conversa, nem a seção da administração. A
leitura que FALHA diz que falhou, com o código, e não vira *"o funil está
vazio"* (armadilha nº 2).

**Os cartões vêm em páginas de 1000**, até cinco, e passando disso a tela
DIZ que cortou: o PostgREST corta calado, e um funil cortado se leria como
completo.

**Cartão e coluna são FUNÇÕES que desenham, e não componentes declarados
dentro de `Funil`.** Componente declarado ali dentro é um tipo novo a cada
desenho; o React trocaria o elemento inteiro, e a releitura de 30 segundos
no meio de um arraste mataria o arraste. O id arrastado também mora num
espelho (`arrastandoRef`), além do `dataTransfer`.

### Duas armadilhas da prova

**`dragTo` para uma coluna fora da tela não dispara NADA** — medido, zero
eventos, nem o `dragstart`. A prova reprovava o arraste, e o arraste
funcionava: com o mouse passo a passo (`mouse.down` / `move` com `steps` /
`up`) e uma coluna à vista, passa. Quem arrasta de verdade arrasta para o que
está vendo.

**Quem não administra precisa de permissão na semente.** Sem nenhuma linha
em `permissoes` a bancada não deixa ver telefone nenhum, e a prova esperava
para sempre por uma lista de conversas que não ia aparecer.

Prova: `o-funil-de-etapas`, 58 conferências, **8 sabotagens e 8 pegas**
(o cartão que não volta na recusa; a coluna das desativadas sumindo; o menu
sem o script; o "trazer" sem dizer quantos; a falha de leitura virando funil
vazio; a conversa oferecendo etapa desativada; "parar de usar" apagando; a
recusa calada dizendo "foi para…").

~~**Ainda em aberto:** o histórico de movimentos do cliente na tela.~~
**Feito** — ver "O caminho do cliente no funil", mais abaixo. ~~E o
relatório do funil.~~ **Feito** — ver logo abaixo.

### O relatório do funil (07/10)

Pedido do Rodrigo logo depois do funil: *"quantos em cada etapa, quanto tempo
em cada uma"*. **Uma seção do Painel de números**, entre o relatório por
responsável e o "Já tratei", embaixo da mesma barra de filtros. A conta é do
banco (`zorvin_relatorio_funil`, script 019 da ponte).

**Duas perguntas na mesma tabela, e a seção diz qual é qual:**

| coluna | pergunta | usa o período? |
|---|---|---|
| Agora · Há quanto tempo · Mais parado | o que ESTÁ em cada etapa hoje | não |
| Entraram · Saíram · Tempo na etapa | o que ACONTECEU no período | sim |

**O tempo na etapa é o de quem SAIU**, e sai dos movimentos: da última
chegada à etapa até a saída, do mesmo cliente no mesmo funil. Quem ainda
está lá não terminou de passar por ela — somar o "até agora" dele puxaria o
número para baixo justamente nas etapas em que os cartões empacam; esse
tempo aparece à parte, em "há quanto tempo". **Mediana na tela, média no
`title`**: um cliente esquecido um mês puxa a média e não a mediana.

**Só aparecem os departamentos em que a pessoa vê alguma conversa** — o
funil de um departamento que ela não atende viria zerado, e zerado se lê
como "ninguém". E **o departamento sem cartão nem movimento vira uma linha
só**, e não sete linhas de zero: a primeira foto da bancada mostrava quatro
tabelas zeradas antes da que importava.

**O filtro de telefone** vira "os clientes que conversam por este telefone",
no funil do departamento dele. **Etapa desativada** só aparece se ainda tem
cartão ou movimento no período.

**A bancada passou a imitar o gatilho do 017**: todo cartão que nasce, muda
de etapa ou sai deixa uma linha em `zorvin_movimentos`, e mudar de etapa
carimba `movido_em`. Sem isso o relatório só teria o que a semente plantou, e
a cena do caminho inteiro (mudar a etapa na conversa e ver no relatório) não
mediria nada.

Prova: `o-relatorio-do-funil`, 38 conferências, **7 sabotagens e 7 pegas**
(o tempo de quem ficou no lugar do de quem saiu; a falha virando funil vazio;
o administrador sem o aviso do script; o período ignorado; o telefone que não
recorta; a seção sem dizer o que é de agora; a tabela de zeros). E cinco no
SQL, num Postgres de verdade, as cinco pegas — uma vazou primeiro: tirar a
regra "a chegada é ANTES da saída" passava, porque nenhum cliente da cena
voltava a uma etapa onde já tinha estado. Entrou o cliente que volta.

### O caminho do cliente no funil (07/10)

Pedido do Rodrigo depois da auditoria: ver **por onde o cliente passou** no
funil. O banco guardava cada passo desde o 017 (`zorvin_movimentos`: de qual
etapa para qual, quem e quando) e a tela mostrava só **onde ele está** —
não por onde passou, quem o moveu nem quanto tempo ficou parado em cada
etapa, que é o que se pergunta antes de cobrar alguém por um acordo que não
anda.

**Mora no "Histórico de atendimento"**, numa seção *Caminho no funil*, entre
o "Já tratei" e a lista de telefones — o mesmo lugar do que já se fez por
esta pessoa. **Nenhum SQL e nenhuma rota nova**: a regra de leitura dos
movimentos (`zorvin_ve_no_funil`) já libera os dos departamentos em que a
pessoa vê alguma conversa do cliente.

**Um caminho por departamento**, o mexido por último primeiro, com *"Agora
em X · há N dias"* ou *"Fora do funil agora"* no alto e os passos do mais
recente ao mais antigo. Cada passo diz quem moveu — **"O Zorvin"** quando o
cliente entrou sozinho, ao escrever pela primeira vez (`quem` nulo no
gatilho); **"Você"**; ou o nome do colega.

**"Ficou N dias em X" é da ÚLTIMA chegada a X até a saída**, no mesmo
departamento — a régua do relatório do funil (script 019), aplicada a um
cliente. **Sem chegada conhecida, o tempo não é inventado**: fica fora, e a
entrada no funil nunca diz "ficou". A conta mora em `caminhoNoFunil.js`, e
não dentro da tela, porque a prova e a tela leem a mesma.

**As etapas são lidas pelo id** do que está no caminho, e não pelo
departamento aberto: o caminho tem etapas desativadas (que continuam tendo
nome, e é por isso que não se apagam) e de outros departamentos.

**Três estados, como o "Já tratei" do histórico:** sem o 017 a seção não
existe; a leitura que falha — dos movimentos ou das etapas — diz que falhou,
com o código, e **nunca** vira "ainda não passou pelo funil" (armadilha nº
2); e o caminho vazio é dito. Quem não administra lê que o caminho é **dos
departamentos que atende**: a regra do banco recorta, e a lista recortada não
pode se ler como inteira.

**E a seção acompanha o clique:** mudar a etapa ou tirar do funil com o
histórico daquele cliente aberto relê o caminho.

Prova: `o-caminho-no-funil`, 39 conferências, **9 sabotagens e 9 pegas** (a
chegada que conta a PRIMEIRA passagem e não a última; a falha virando caminho
vazio; a seção que não relê depois de mudar a etapa; a entrada sozinha
atribuída a uma pessoa; o caminho do mais antigo ao mais recente; os passos
de outro cliente; a seção aparecendo sem o funil; o tempo inventado sem
chegada; a falha das etapas ignorada). **Três vazaram na primeira escrita, e
eram minhas:** duas mexiam em linhas que o resto do código conserta sozinho
(a régua de 25/09), e a terceira sabotava um nome que o texto da entrada não
usa. Refeitas como defeitos de verdade, as três pegam. **E o `innerText` de
um nome com bolinha** (bloco em linha) quebra linhas que a tela não mostra:
a prova normaliza o espaço antes de comparar frases.

## Tarefas e lembretes (06/10)

Pedido do Rodrigo como terceiro passo para CRM: *"pode começar pelas tarefas
e lembretes"*. Responsável e funil dizem de quem é o cliente e em que pé ele
está; faltava **quando agir de novo** ("ligar na quinta para confirmar o
acordo") — que hoje fica na cabeça de quem atende, e o cliente esfria no dia
em que ela esquece.

**Decidido com ele:** quem vê a conversa vê as tarefas dela (a equipe do
telefone, para um colega cobrir quem faltou); uma tela própria **mais** um
filtro na lista; e **só quem recebeu a tarefa é avisado** na hora.

SQL: `sql/automaticos/018-tarefas-e-lembretes.sql`, no repo da ponte. As
contas de "atrasada / hoje / próxima" e do aviso moram em **`tarefas.js`**,
e é a MESMA régua na conversa, na tela, no filtro e no cartão do funil —
quatro contas divergiriam.

### Onde ela mora na tela

| | |
|---|---|
| **criar e ver as da conversa** | na linha do número, depois da etapa: o selo diz a PRÓXIMA (vermelho atrasada, âmbar hoje) ou oferece **"Lembrar"**; no celular a linha só diz a próxima — escrita onde cabe, e o sino quando não cabe (27/10) —, e criar é pelo ⋮ |
| **a janela** | `NovaTarefa.jsx` — o que fazer, para quem (começa em você), quando; o mesmo desenho da janela de agendar |
| **a tela** | o **sino da barra lateral**, com o número de atrasadas + hoje (vermelho se alguma atrasou); também no menu ⋮ do topo |
| **o filtro** | "Com tarefa para hoje", na gaveta da fita — de qualquer pessoa, porque quem vê a conversa vê as tarefas dela |
| **o funil** | o cartão diz a tarefa aberta mais urgente do cliente |

**A tela (`Tarefas.jsx`) tem duas abas, e a diferença é de pergunta:**
*Minhas* (atrasadas, hoje, próximas, e as concluídas dos últimos sete dias,
para desfazer um clique errado) e *Da equipe* (tudo o que está aberto nas
conversas que eu vejo, com a conta de cada pessoa no alto — é a cobrança da
fila, e a ordem é de quem tem mais atrasada).

### O aviso na hora

**É do painel**, e não do banco: o navegador de quem recebeu relê as
próprias abertas **de 30 em 30 segundos** e, vencida uma, toca o som que a
pessoa escolheu para as mensagens, mostra a tarja (pela mesma chave de
`notificarDesktop`) e escreve o lembrete na faixa.

**Toca uma vez só por navegador** (`zorvin-tarefas-avisadas`, no
`localStorage`): recarregar não toca de novo, e duas abas não tocam duas
vezes. **A chave é o id mais a hora**: adiar a tarefa para amanhã é um
lembrete novo, e toca de novo.

**A vencida há mais de 12 horas não toca ao abrir**: doze tarefas de ontem
tocando juntas às 8h é susto, e não aviso. Ela continua no número vermelho
e na tela.

**O número da barra conta atrasadas e de hoje**, e não as de amanhã: um
número que nunca zera se aprende a não ler.

### Três decisões pequenas

- **Apagar existe e pergunta antes**; "concluída" é para o que foi feito.
- **A falha ao criar fica NA JANELA**, que continua aberta com o que foi
  escrito. Na faixa de aviso ela ficaria por baixo do fundo escuro da
  janela, e o clique pareceria mudo.
- **Toda gravação relê tudo o que conta tarefas** (`tarefasMudaram`): a
  conversa, o número da barra e o filtro. Sem isso o número diria o que era
  verdade antes do clique.

### E a linha do número estava se sobrepondo desde o funil

A primeira foto desta rodada mostrou **"Assumir" pintado por cima de "Pôr
no funil"** a 1400 com a ficha aberta — e conferido sem as tarefas, **já era
assim desde o funil (02/10)**. Ninguém tinha medido a linha do número depois
de o funil pôr o segundo selo nela.

**Medido:** a linha tem a largura do bloco do nome, e com a ficha aberta a
1400 são **187px** para o número (~95) e três selos que pedem ~300 escritos.

**O conserto tem duas partes:**

1. **a linha é CALCULADA** (`espacoDaLinha`), pela régua do cabeçalho — as
   mesmas parcelas da fila mais 56px, conferidas em sete larguras com e sem
   a ficha — e, sem espaço para ~92px por selo, os três viram **ícone** (o
   rosto, a bolinha da etapa, o sino), com o texto no `title` e por extenso
   no menu de cada um. Medido com 66px por selo, a linha dizia "Assum",
   "Pô…" e "L…": três palavras cortadas dizem menos que três ícones;
2. **`overflow: hidden` em cada BOTÃO**, e não na linha: a linha ancora os
   menus, e recortá-la os sumiria — a régua de 29/09. No botão, faltando
   espaço, o selo é cortado na própria borda em vez de pintar no vizinho.

**O número nunca encolhe**, como sempre.

**E a suíte inteira pegou duas provas que liam a PALAVRA do selo a 1400**
(`o-funil-de-etapas` e `o-responsavel-pela-conversa`): ali, com a ficha
aberta, o selo agora é ícone — de propósito, é onde ele se sobrepunha. As
duas cenas rodam a 1920, com o motivo escrito. É a lição de 02/10 com outra
roupa: **ao mexer na linha do número, rode toda prova que lê um selo dela**,
e não só a que tem o nome do recurso novo.

Prova: `tarefas-e-lembretes`, **113 conferências**, **10 sabotagens e 10
pegas** (sem a janela de 12 horas; sem guardar o que tocou; o número contando
as de amanhã; a recusa calada virando "concluída"; a falha ao criar calada;
os selos que nunca viram ícone; o filtro sem o "até hoje"; a falha da tela
virando "nenhuma"; o cartão do funil sem a tarefa; a leitura das minhas sem
o recorte da pessoa). A cena dos selos mede **o que está pintado**
(`elementFromPoint` no centro de cada selo), em seis larguras.

**E uma vazou, com razão:** tirar de `quemTocaAgora` a pergunta "é minha?"
passava, porque a leitura já pede só as minhas ao banco — a função é a
segunda guarda. É a régua de 25/09, *sabotagem que o resto do sistema
conserta sozinho não prova nada*. O defeito de verdade é a LEITURA sem o
recorte, e esse é pego pelo número da barra.

**Ainda em aberto:** tarefa repetida ("toda segunda"), e tarefa que nasce
sozinha de uma etapa do funil — as duas ficam para quando o Rodrigo usar
esta.

## Quem está esperando demais (31/10)

Pedido do Rodrigo, da lista de recomendações de 31/10: *"Pode seguir para a
segunda recomendação"* — *"Ao abrir o Zorvin, cada pessoa vê quantas conversas
dela esperam há mais de 3 dias, com um botão que mostra quais. E um aviso
quando um cliente novo passa de X minutos sem resposta no expediente."* O X
ficou em **30 minutos**, pela medição (ver o script 041 no CLAUDE.md da ponte),
e quem administra troca por departamento.

**Medido em 31/10, só contando**, nos 30 dias anteriores: dos 297 clientes que
escreveram primeiro dentro do expediente, a mediana até a primeira resposta
foi **1 h 46 min**, só 19% foram respondidos em 30 minutos e **40% não tinham
resposta nenhuma**. E 596 conversas esperavam há 3 dias ou mais — 193 com
responsável (17 pessoas, de 1 a 56 cada).

### Onde aparece

| | |
|---|---|
| ao abrir, sem conversa escolhida | o resumo na tela da direita (`data-resumo-da-espera`): *"2 clientes sem resposta há mais de 30 min de expediente"*, *"12 conversas suas esperando resposta há 3 dias ou mais"*, e **Ver quais** |
| a barra lateral | a ampulheta (`data-abrir-esperando`), com a soma das duas listas — **vermelha** quando há cliente sem resposta, **âmbar** quando são só as suas |
| o ⋮ do topo | "Esperando resposta", com o mesmo número: no celular a tela da direita não aparece ao abrir, e a barra e o ⋮ são o caminho |
| a tela | `Esperando.jsx` (`data-tela="esperando"`), com as duas seções; clicar abre a conversa no telefone dela, pelo caminho do histórico (`verConversaDoHistorico`) |
| o aviso | o som escolhido, a tarja (pela chave de `notificarDesktop`) e a faixa |
| a administração | a aba **Aviso de espera**, em Departamentos e acessos (`AvisoDeEspera.jsx`) |

**Nada aparece quando não há o que dizer**: o resumo só nasce com alguém
esperando, ou com uma leitura que falhou.

### As duas listas

- **Clientes sem resposta** — da função do banco
  (`zorvin_clientes_sem_resposta`, script 041): quem abriu um atendimento e
  espera a primeira resposta além do limite do departamento, **contado só no
  expediente**. Os minutos são do banco, pela mesma semana que decide a
  resposta fora do horário: uma segunda conta aqui divergiria dela no primeiro
  feriado. **São "meus" os sem responsável e os de que sou o responsável**
  (`ehParaMim`), a régua do aviso de mensagem nova: o cliente da colega
  aparece só para ela.
- **As minhas há 3 dias ou mais** — as conversas em que sou o responsável e a
  espera começou antes da meia-noite de anteontem (`corteDosTresDias`), que é a
  régua do rótulo vermelho da lista (`diasDesde`). A tela confere de novo com
  `diasDesde`: o corte do banco é o mesmo, e a segunda conferência é o que
  impede os dois de divergirem calados. **Sem a linha desativada** (a régua do
  relatório por responsável) **e sem a arquivada**; até 500, e a tela diz
  quando cortou.

### O aviso: uma vez só, e só o que acabou de acontecer

- **De minuto em minuto**, a pergunta ao banco.
- **Toca quem passou do limite há menos de 15 minutos** (`JANELA_DO_AVISO_MIN`).
  Quem passou há mais está na lista e no número da barra, e não no susto: sem
  a janela, quem abre o Zorvin às 10h ouviria de uma vez todos os que passaram
  do limite às 9h30 — a régua das doze horas do lembrete das tarefas.
- **Uma vez por navegador, por PROTOCOLO** (`zorvin-esperas-avisadas`), marcado
  ANTES de tocar: recarregar não toca de novo, e duas abas não tocam duas
  vezes. O cliente que volta a escrever depois de finalizado abre um protocolo
  novo, e toca de novo.
- **A conversa aberta na minha tela não toca**: quem está olhando para ela não
  precisa ser avisado dela.
- **Vários de uma vez são um som só**, uma tarja por cliente (até três) e uma
  faixa com quantos.

### A primeira pergunta espera cinco segundos

`ESPERA_ANTES_DA_PRIMEIRA_MS`. A das minhas vai à tabela de conversas, e na
partida as idas a essa tabela saem todas juntas, numa rodada — a prova
`partida` mede isso. Perguntada na hora, ela começaria depois de a lista
chegar (é a lista que diz se a coluna do responsável existe), e a abertura
voltaria a esperar em fila. Os cinco segundos contam **de quando a lista
chega**: o relógio recomeça quando ela diz que a coluna do responsável existe
(`podeContarAtrasadas` vira `true`), e é depois de a lista aparecer e antes de
alguém ter escolhido a primeira conversa.

**O que entra nas dependências do relógio é a PERGUNTA** (`podeContarAtrasadas`,
um booleano que vira `true` uma vez), e o que muda a cada desenho
(`advogadosPermitidos`) entra por espelho — a lição do relógio órfão de 20/10.

### E a prova da pesca aprendeu a separar esta leitura

`a-pesca-enquanto-o-canal-esta-fora` conta as idas a `conversas` com o canal
de pé e exige **zero** — e reprovou: as minhas há 3 dias caíram dentro da
janela dela, cinco segundos depois de a lista chegar. Até aqui a pesca era a
única leitura de `conversas` com relógio próprio, e por isso "nenhuma ida a
mais" queria dizer "nenhuma pesca". Agora são duas.

**Esta leitura não é pesca**: ela tem o relógio dela, com o canal de pé ou
fora. A prova passou a deixá-la de fora das duas contas (idas e rodadas)
**pelo formato**, e estreito de propósito: ela pede `esperando_desde` no começo
das colunas E filtra por `responsavel_id`; a releitura da lista pede `*` e
nunca casa com isso. **Uma sabotagem confere que a prova continua vendo a
pesca**: com a pesca correndo de canal de pé, ela reprova.

**E o custo dela não ficou sem dono**: a prova nova confere a cadência — uma
leitura das minhas por rodada, nem a mais nem nunca —, com o mesmo formato. Se
a consulta mudar de forma, a conferência daqui reprova dizendo zero, e é o
lembrete de mudar o formato lá também. **Ao criar outra leitura de `conversas`
com relógio próprio, ela entra nesse mesmo formato, ou a pesca reprova.**

### Três estados, e a falha dita

`temAvisoDeEspera`, pela régua de `temVantoro.js`: **só a função que falta
esconde** (o 041 não rodou), e ela é perguntada **uma vez**; qualquer outro
tropeço é dito no resumo, na faixa âmbar e na tela, com o código — e nunca vira
"ninguém esperando", que faria a pessoa ir embora achando que a fila está em
dia. A das minhas também: sem a espera (004) ou sem o responsável (008), não há
o que contar, e a consulta pela coluna que falta nem sai.

### A aba Aviso de espera

Por departamento: a chave, os minutos (de 5 a 480) e o expediente da aba Fora
do horário, em três frases — o escrito; *"sem horário escrito: o aviso conta
o relógio inteiro"*; *"todos os dias fechados: o aviso nunca toca"*.

- **Sem linha, vale o padrão** (ligado, 30), e é o que a tela desenha.
- **A leitura que falha é dita, e o padrão não é desenhado por cima**: quem
  visse "30" poderia salvar 30 por cima dos 45 que estão gravados.
- **Gravar manda a linha inteira e relê do banco**; a recusa é dita com o
  código.
- **A recusa calada (zero linhas) não existe num `upsert`**: o Postgres levanta
  42501 quando a regra de acesso recusa. O ramo de `naoGravouNada` fica, pela
  régua da aba Distribuição, mas não tem cena — a bancada só sabe recusar
  calada uma edição ou uma exclusão, e uma cena ali mediria a bancada.

### A bancada

A tabela `zorvin_aviso_de_espera` (vazia, como o script a entrega) e
`__SEM_AVISO_DE_ESPERA`; a função **ditada** pela prova (`__SEM_RESPOSTA`),
pela régua de `zorvin_saude` — a conta foi conferida num Postgres de verdade na
seção 86 da ponte —, com cada pergunta contada (`__PERGUNTAS_DA_ESPERA`);
`__QUEBRAR_AS_QUE_ESPERAM`, que derruba só a pergunta das minhas; e
`__ESPERA_PRIMEIRA_MS` e `__ESPERA_A_CADA_MS`, para a prova não esperar
minutos.

Prova: `o-aviso-de-quem-espera-demais`, 68 conferências.

**Duas armadilhas da primeira escrita, e as duas eram da prova:**

- **as duas leituras chegam em tempos diferentes.** A da função é uma ida
  curta; a das conversas espera a lista. A prova contava no meio do caminho e
  reprovava dizendo "0 conversas suas", enquanto o título do ícone, lido um
  instante depois, já dizia 2. Hoje ela espera o número chegar
  (`esperarValor`);
- **o telefone que a bancada abre primeiro é o a7.** A cena da conversa aberta
  clicava numa conversa do a1, que não estava na lista: o clique não fazia
  nada, e a prova reprovava o painel certo. Hoje a cena confere, pelo nome no
  alto, que a conversa abriu mesmo.

**33 sabotagens e 33 pegas**, todas limpas, rodadas em cópias e lidas uma a
uma:

- **o resumo e a barra:**
  - sem o resumo (16 reprovações);
  - sem o número da barra;
  - o número sem as minhas;
  - sem o item no ⋮;
- **as listas:**
  - o cliente da colega contando como meu (8 reprovações);
  - a tela mostrando o cliente da colega;
  - as minhas com a linha desativada;
  - as minhas com a arquivada;
  - as minhas de todo mundo (11);
  - a régua de dois dias;
  - a tela sem a seção das minhas;
- **o aviso:**
  - sem a janela de 15 minutos;
  - tocando sempre;
  - sem marcar antes de tocar;
  - a chave pela conversa, e não pelo protocolo;
  - tocando na conversa aberta;
- **a falha:**
  - a do banco virando "ninguém sem resposta";
  - a do banco escondendo o recurso;
  - o resumo sem o código;
  - a das minhas virando "nenhuma";
  - a função que falta perguntada sempre;
- **a cadência:**
  - a primeira pergunta sem esperar a abertura, pega pela `partida`: a espera
    da abertura dobra, de 736 para 1440 ms;
  - as minhas lidas duas vezes por rodada;
  - as minhas lidas só na primeira;
- **a tela:**
  - sem o Esc;
  - abrir a conversa sem trocar de telefone;
- **a aba:**
  - o padrão desenhado por cima da falha;
  - sem linha valendo desligado;
  - os minutos fora da faixa sendo salvos;
  - sem reler depois de gravar;
  - a recusa com erro calada;
  - sem semana dizendo "todos os dias fechados";
- **e a pesca correndo com o canal de pé**, pega pela
  `a-pesca-enquanto-o-canal-esta-fora` com 5 reprovações, entre elas *"foram
  29 idas em 6000ms"*: a separação nova não a deixou cega.

**A das minhas de todo mundo também reprova a cadência** ("0 leituras das
minhas"): sem o filtro do responsável, a consulta muda de forma. É a
conferência do formato fazendo o que foi feita para fazer.

## A resposta automática fora do horário (09/10)

Pedido do Rodrigo, o nº 1 da lista de ideias de 08/10: quem escreve à noite,
no fim de semana ou no feriado recebe na hora o texto do departamento.
Decidido com ele: **texto e horário por departamento**, **uma vez por período
fechado**, e **a conversa continua na fila de espera**.

**Quem decide e manda é a PONTE**, a cada mensagem de cliente, com a conta do
banco (script 021 — ver o CLAUDE.md da ponte, onde estão as regras de quando
NÃO sai). O painel faz duas coisas: configura, e mostra na conversa o que
saiu.

### A aba "Fora do horário", em Departamentos e acessos

`ForaDoHorario.jsx`, com os nomes, os fusos e as frases em
`foraDoHorario.js`. **Uma aba própria**, e não mais uma seção no fim de
"Departamentos e telefones": são o texto, sete dias, o fuso e os feriados, e
é para cá que se volta na véspera de cada feriado. Ela só aparece com o
script (`temForaDoHorario`, três estados pela régua de `temVantoro.js`: a
pergunta que falha por outro motivo MOSTRA a aba, e o erro é dito lá dentro).

**Nasce desligada**, departamento por departamento. Ligar pede texto e um dia
aberto — a tela diz antes, e o gatilho do banco recusa em português se
passar; a frase dele (23514) vai inteira para a tela. **As variáveis das
rápidas não funcionam aqui** (`{nome}` iria com as chaves para o cliente,
porque ninguém lê antes de sair), e o aviso âmbar diz isso — avisa e não
impede, como o da variável desconhecida das rápidas.

**A PRÉVIA É A CONTA DO BANCO** (`zorvin_horario_de`) feita com o que está NA
TELA, ainda não salvo: "Agora está fechado — volta terça-feira, 13/10, às
08:00". É a mesma conta que decide se o cliente recebe a resposta, então o
que se lê é o que vai acontecer — e é ali que se descobre a sexta esquecida.
**A conta não tem segunda escrita aqui**: a prévia diria "volta segunda" e o
cliente receberia a resposta pensando na terça. A hora da frase é a do FUSO
do departamento, e não a do computador de quem olha.

**E os feriados entram na prévia** — a prova pegou: tirar o de segunda não
refazia a conta, e a frase continuava dizendo "terça".

**Salvar relê do banco** (o gatilho arruma "8:00" em "08:00" e guarda as sete
chaves da semana), e trocar de departamento com algo por salvar pergunta
antes. Os **feriados** são do escritório inteiro, numa lista só; os nacionais
vêm com o script, Carnaval e Corpus Christi não (ponto facultativo).

### Na conversa, a resposta é uma bolha nossa — lida do registro

A resposta **não está em `mensagens`** (de propósito: ali ela tiraria o
cliente da fila de espera e trocaria a prévia da lista). O painel lê
`zorvin_respostas_automaticas` junto das notas e das mensagens que não saíram
— uma quarta ida, ao mesmo tempo, sem fila indiana — e mistura na linha do
tempo como `origem: "automatica"` (`bolhaDaRespostaAutomatica`).

| a bolha | por quê |
|---|---|
| à direita, verde, "Resposta automática · fora do horário" | é nossa, mas ninguém escreveu: não leva nome de gente |
| **sem menu nenhum** | não está em `mensagens`: não se responde, não se edita, não se apaga daqui |
| "saiu" (tique), "saindo" (relógio), **"Não saiu: motivo. O cliente não recebeu"** | o registro da ponte diz o que houve |
| "a ponte não confirmou se ela saiu" depois de 5 minutos "saindo" | a ponte caiu no meio, e a tela não promete o que não sabe |

**Com a conversa aberta, ela aparece sozinha**: o registro não vem pelo tempo
real (pôr uma tabela a mais no canal é mexer no canal de todas as conversas,
que este painel já viu morrer), então a mensagem de cliente que chega na
conversa aberta faz o painel reler SÓ o registro, aos 3,5 e aos 12 segundos.

**Sem o script, tudo como antes**, e calado: a tabela que falta não acende a
faixa âmbar (o recurso só não existe). **A leitura que falha por outro motivo
acende**, com "as respostas automáticas" — "nenhuma resposta saiu" no lugar
de "não consegui ler" faria alguém achar que o cliente não foi avisado.

Prova: `a-resposta-fora-do-horario`, 68 conferências, **14 sabotagens e 14
pegas** (a prévia do que foi salvo, e não do que está na tela; a prévia sem
os feriados; ligar sem texto; sem o aviso das chaves; salvar sem reler; a
recusa virando "salvo"; a tabela que falta acendendo a faixa; a falha de
leitura calada; sem a releitura do tempo real; a aba sem o script; o fuso do
navegador no lugar do departamento; o registro não lido; a resposta virando
bolha comum; e a bolha do lado do cliente).

**A última VAZOU primeiro, e é a lição de sempre — medir a coisa certa, e não
a coisa próxima.** A conferência comparava a borda DIREITA da nossa bolha com
a ESQUERDA da do cliente; com as duas encostadas à esquerda, a direita da
nossa continuava longe, e passava. Hoje ela confere as duas bordas.

### E ela não interrompe uma conversa (script 022, 09/10)

Pedido do Rodrigo no dia em que ligou e testou: *"se eu estiver conversando
com o contato antes ou após o horário do expediente, a mensagem automática
não pode aparecer"*. O 021 já calava a resposta quando a equipe escrevia
DEPOIS do fechamento; faltava a conversa que vem de ANTES (nós às 17:55, o
cliente às 18:05). A regra é do banco — o script 022 da ponte, onde estão as
cenas e o porquê de cada escolha. **Aqui mudou só a explicação da aba**,
porque a de antes passaria a dizer metade da regra.

**A janela da frase vem do BANCO** (`zorvin_carencia_da_espera`, a carência
da fila de espera, que é a mesma régua da regra nova), e não de um "30"
escrito aqui: trocá-la lá é uma linha, e a tela continuaria prometendo o
número antigo. As contas moram em `foraDoHorario.js` (`minutosDaJanela`,
`fraseDaJanela`). **Sem conseguir ler, a frase diz "pouco antes"** — que é
verdade com qualquer número — em vez de prometer um que talvez não seja o
de lá.

Prova: `a-resposta-fora-do-horario`, cena 2b, 9 conferências novas (77 no
total), com a bancada devolvendo a janela que a prova escolhe
(`__CARENCIA`: 10 minutos, uma hora, e a falha). **5 sabotagens e 5
pegas** (a frase de antes; o 30 escrito na tela; a falha prometendo 30; a
hora do intervalo ignorada; a hora virando minutos).

## A distribuição das conversas novas (13/10)

Pedido do Rodrigo, o nº 3 da lista de ideias de 08/10: o cliente novo já
chega com um responsável, em rodízio entre quem atende o departamento.
Decidido com ele: entra quem atende o departamento, com a chave *"recebe
conversas novas"* para férias e folga; rodízio simples (cada um na sua vez);
e só a conversa de cliente novo — as antigas sem responsável ficam como estão.

**Quem decide é o BANCO** (script 023 da ponte), chamado pela ponte a cada
mensagem de cliente — ver o CLAUDE.md dela, onde estão o que é "cliente
novo", de quem é a vez e a trava contra duas escolhas ao mesmo tempo. O painel
faz duas coisas: configura, e diz na conversa que o dono veio da distribuição.

### A aba "Distribuição", em Departamentos e acessos

`Distribuicao.jsx`, logo depois de "Atendentes" — é sobre as mesmas pessoas, e
a aba ao lado é onde se libera o telefone que decide quem recebe o quê. Só
aparece com o script (`temDistribuicao`, três estados pela régua de
`temVantoro.js`: a pergunta que falha por outro motivo MOSTRA a aba).

| | a linha mostra |
|---|---|
| cada departamento | a chave (**nasce desligada**) e para quem as conversas novas vão |
| cada pessoa | a chave "recebe conversas novas", o que ela vê, a última que recebeu e quantas hoje |

**O padrão de cada pessoa vem do BANCO** (`zorvin_rodizio_pessoas` devolve
`recebe` e `escolhido`): quem atende começa dentro, quem administra começa
fora, e a linha diz por quê. Refazer aqui "recebe, a não ser que administre"
seria uma segunda escrita da regra — e divergir é a tela dizer que alguém está
no rodízio e as conversas irem para outra pessoa.

**"Para quem vão" sai da mesma lista**: quem recebe e vê algum telefone
daquele departamento. **Ligado e sem ninguém acende um aviso âmbar** — é o
único caso que pede ação: as conversas continuam chegando sem dono, e quem
ligou acha que estão sendo entregues. **A ordem da vez não aparece**: ela é
do banco ("quem recebeu há mais tempo"), e escrevê-la aqui seria uma segunda
conta.

**Falha de leitura é dita, e nunca vira "desligada" nem "ninguém"** — a
armadilha nº 2. As chaves que não carregam não são desenhadas (desligadas por
falha fariam alguém ligar de novo); a lista que não carrega diz que não
carregou, com o código e "Tentar de novo"; e com a lista falhando o aviso de
"ninguém vai receber" não acende — não se sabe.

**Gravar relê do banco**, como em Fora do horário: a recusa é dita com o
código, e a chave recusada volta sozinha.

### Na conversa

O menu do responsável diz *"JENIFER ALMEIDA desde 13/10, 09:12 — pela
distribuição automática."* quando quem pôs o dono foi o Zorvin
(`responsavel_por` nulo COM dono; assumir e passar adiante sempre gravam quem
foi). Fora isso, nada novo para quem atende: a conversa chega com o rosto da
pessoa na lista e entra em "Minhas conversas" dela pelo caminho que já existia
— o tempo real traz o dono pela presença da chave.

~~**O aviso de mensagem nova NÃO mudou**: enquanto ninguém responde, todo mundo
continua sendo avisado (a regra de 15/09 — "participei" sai das mensagens).
Avisar só o dono quando a distribuição está ligada é outra decisão, e não foi
tomada.~~ **Feito no mesmo dia, a pedido do Rodrigo** ("pode fazer o aviso só
para quem recebeu") — ver "O aviso vai para o responsável (13/10)", em "O aviso
de mensagem nova".

### A chave liga-desliga virava um círculo no celular

A foto do celular mostrou: a regra que põe todo botão em 40px de altura (alvo
de dedo, abaixo de 768px) alcançava `Chave.jsx`, que ERA o próprio botão de
40×22 — e ela virava um círculo de 40×40 com a bolinha solta no alto. Não se
via se estava ligada. **Acontecia em toda tela com chave** (Fora do horário,
Avisos, a equipe sem Vantoro); nenhuma prova media a forma dela. Hoje o botão
é a área de toque e a pílula é um desenho dentro dele (`data-pilula-da-chave`):
o dedo ganha os 40, o olho continua vendo uma chave.

### Uma conferência minha media um caso que o banco não produz

Escrevi *"a conversa sem a chave `responsavel_por` não é atribuída à
distribuição"* — e ela reprovou contra a própria bancada. Com razão: o banco
devolve a coluna em TODA linha (`select *`), e a bancada imita isso de
propósito, então "falta a chave" nunca acontece. Trocada pelos dois casos que
ela queria guardar e que existem: a conversa que a própria pessoa assumiu
(`responsavel_por` = o dono) e a conversa sem dono (`responsavel_por` também
nulo — é o DONO que separa um caso do outro).

Prova: `a-distribuicao-das-conversas-novas`, 79 conferências, **15
sabotagens e 15 pegas**, todas limpas, rodadas em cópias (a aba sem o script;
a falha escondendo a aba; quem administra contando como dentro; a vez de quem
não vê o telefone; a falha das pessoas virando "ninguém"; a falha das chaves
virando "desligada"; o clique encaixado em vez de relido; a recusa calada; sem
o aviso de ligada sem ninguém; o aviso acendendo com a lista falhando; sem
linha valendo ligado; o menu sem a frase; o nulo sem dono virando
distribuição; passar adiante virando distribuição; e a chave voltando a ser o
próprio botão).

**E uma lição de processo, a mesma de sempre com outra roupa:** mexi na chave
NO MEIO de uma rodada de sabotagens — e cada sabotagem copia o repositório na
hora em que começa. Metade da rodada teria provado um código e metade outro.
Ela foi parada, os servidores órfãos derrubados pelo grupo, e a rodada refeita
inteira sobre a versão final. **Rodada de sabotagens não convive com edição.**

## O copiloto — "Sugerir resposta" (13/10)

Pedido do Rodrigo: *"dá para pegar uma amostragem para a IA aprender como
funciona o nosso trabalho e criarmos um agente de IA?"* — e, depois, *"pode
começar pelo copiloto, o escritório autoriza"*. A IA é o **Claude Haiku
5.5**, escolhido por ele entre o Claude e o Groq; quem fala com ela é a
**ponte** (`POST /copiloto/sugerir`, script 024 — ver o CLAUDE.md dela), onde
mora a chave.

**Nenhuma conversa de cliente foi usada para "ensinar" nada.** A amostra
anonimizada era o plano; a verificação de segurança do ambiente recusou
prepará-la, e o caminho que ficou dá menos trabalho a ele: a cada clique, a
ponte lê a conversa aberta, as mensagens rápidas da equipe e o **manual** que o
escritório escreve na aba nova. As notas internas não vão.

### Onde ele mora na tela

| | |
|---|---|
| computador | um ✨ dentro da caixa de escrever, **só com a caixa vazia** — no lugar em que o relógio de agendar aparece quando há texto |
| celular | "Sugerir resposta" no ⋮ da conversa, pela mesma regra |
| administração | aba **Copiloto** em Departamentos e acessos (`ManualDoCopiloto.jsx`) |

**Só com a caixa vazia, e é a decisão que segura o resto.** A barra nunca
ganha um botão a mais (o ✨ some quando o relógio aparece), e uma sugestão
nunca apaga o que a atendente começou a escrever — então não existe a
pergunta "trocar o que você escreveu?". **No celular, só no ⋮**: a caixa já
divide 390px com quatro botões, e mais um faria "Digite uma mensagem" deixar
de caber numa linha.

**A sugestão entra na caixa e NÃO sai sozinha.** O cursor fica no fim,
pronto para ajustar; quem envia é a atendente. O sucesso não tem faixa — a
resposta é a caixa, e quem clicou está olhando para ela.

### Os marcadores, e de qual conversa

A ponte manda a IA escrever `{saudacao}`, `{nome}` e `{atendente}`, e o painel
os preenche com `preencherVariaveis` — **a conta das mensagens rápidas**: a
saudação pela hora, o primeiro nome do alto da conversa ("ANDREIA CRISTINA
MARTINS" vira "Andreia", e "Deus", o nome do WhatsApp, fica para trás), e o
grupo sem nome ("Bom dia!", e não "Bom dia, Mutirão!").

**O contexto é guardado NO CLIQUE**, e não na chegada: a resposta demora
segundos, e a conversa aberta pode ser outra. Ler o nome na chegada poria
"Olá, José!" na conversa da Andreia.

### A corrida da troca de conversa — três desfechos

O estado do copiloto é **por conversa** (`copiloto`, um objeto por id), pela
lição de sempre: uma resposta da conversa anterior pintada na nova.

| quando a sugestão chega | o que acontece |
|---|---|
| a conversa do pedido está aberta, com a caixa vazia | entra na caixa |
| aberta, mas com texto, na nota interna ou numa edição | **não entra**: a faixa diz que chegou depois, com "Usar a sugestão" |
| fechada | vira o **rascunho dela**, se ele estiver vazio — é o que a pessoa encontra ao voltar |

**A faixa do copiloto** fica logo acima da caixa, como a do "respondendo":
"lendo a conversa…" enquanto pensa (e o botão fica desligado — um segundo
clique não manda outro pedido), a frase da ponte quando falha, e a da
sugestão que chegou depois.

### Está ligado? Quem responde é a ponte

`copiloto.js` pergunta `GET /copiloto/estado` **uma vez por abertura**, com os
três estados de `temVantoro.js`: só `ligado: false` esconde o botão; a ponte
que não responde **mostra**, e o clique diz o que houver. Uma variável do
painel poderia discordar da chave que mora na Render.

### A aba "Copiloto"

Diz se a ponte tem a chave (e qual variável falta, quando não tem), o que o
copiloto lê, e o **manual** numa caixa grande. Só aparece com o script 024
(três estados, pela régua das outras abas). **A leitura que falha é dita com
o código, e não vira caixa vazia** — salvar uma caixa vazia por cima apagaria
o manual que existe e não chegou. **Salvar relê do banco** (a "última
alteração" vem do gatilho do 024), a recusa calada da RLS é dita como recusa,
a recusa com erro leva o código, e acima de 8000 caracteres o botão não liga.

**A bancada** tem `zorvin_copiloto` com o começo do modelo, `__SEM_COPILOTO`
para o banco sem o 024, e imita o gatilho (quem mudou e quando) — sem isso,
"a tela relê depois de salvar" não teria o que medir.

Prova: `o-copiloto-sugere-a-resposta`, 62 conferências, com a ponte fingida
pela prova e o relógio fixado às 9h de Brasília. **27 sabotagens e 27 pegas**,
todas limpas, rodadas em cópias, cada pega lida e não só contada. As que
importam mais:

- a sugestão saindo sozinha para a fila de envio;
- o nome da conversa ABERTA na chegada ("Bom dia, José!" na conversa da
  Andreia);
- a entrega na conversa aberta, e não na do pedido;
- a sugestão por cima do que a atendente escreveu;
- a dúvida da ponte escondendo o botão, e o "desligado" mostrando;
- os marcadores sem preencher;
- a aba sumindo na falha de leitura, e a falha virando caixa vazia;
- a recusa calada virando "salvo";
- salvar sem reler.

## Aguardando, em aberto e finalizados (19/10)

Pedido do Rodrigo, com a descrição do DataCrazy ao lado: *"para facilitar a
organização"*. A lista ganha **três abas que a separam** — o cliente que a
equipe ainda não atendeu, o que já foi atendido e não foi finalizado, e o
finalizado —, com **um protocolo por atendimento**. Decidido com ele:

- **o "Já tratei" vira o "Finalizar"**: um botão só, com a mesma checklist. O
  registro do que foi tratado É a finalização, e o relatório continua contando
  como sempre contou;
- **nada muda de sentido**, nas palavras dele: *"o que está aguardando
  continua aguardando, o que estiver como Já tratei fica como finalizado. Caso
  o cliente tenha enviado mensagem após já ter sido finalizado, então a
  conversa deve ficar aberta novamente, porém já com a tratativa
  (finalizado)"*;
- **Aguardando e Em aberto são abas separadas**;
- **o protocolo é só da equipe**: não vai para o cliente.

**Quem decide em qual aba cada conversa mora é o BANCO** (script 028 da ponte,
com as regras no CLAUDE.md dela). A tela lê `conversas.situacao` e
`conversas.protocolo`, e a única mudança de situação que ela pede é o Reabrir.
Uma tela que gravasse a situação por conta própria faria a aba e o protocolo
discordarem — e o banco recusa (42501).

**Os nomes das abas mudaram em 20/10**: "Aguardando" virou **"Novos"** e "Em
aberto" virou **"Em Atendimento"** — ver "Os nomes das abas: Novos e Em
Atendimento", mais abaixo. Este texto usa os nomes de quando foi escrito.

### As abas

Entre a busca e a fita de filtros (`data-abas-da-situacao`). **Abas, e não
pílulas**: as pílulas da fita FILTRAM a lista da tela; as abas a SEPARAM, e
cada conversa mora em uma só. Duas fileiras de pílulas iguais fariam pensar
que fazem a mesma coisa.

| | |
|---|---|
| **o número** | do banco (`zorvin_contar_situacoes`), e não das linhas carregadas |
| **Finalizados** | ~~**sem número**: só cresce, e um número que nunca zera se aprende a não ler~~ **com número desde 20/10**, cinza como o de "Em aberto", a pedido do Rodrigo — ver "O número de "Finalizados" (20/10)", mais abaixo |
| **Aguardando** | âmbar com qualquer conversa dentro — é o cliente que ninguém atendeu |
| **ao abrir** | sempre "Em aberto", e **não é guardado** no navegador: quem deixou "Finalizados" aberto ontem abriria hoje a lista de quem já foi atendido |
| **na pasta de arquivadas** | não há aba: lá moram as arquivadas das três |

**A aba vai ao BANCO** (`situacao=eq.aberto` na consulta), e não só à lista
carregada: a página de 200 viria com as três abas misturadas, e "Finalizados"
mostraria as finalizadas ENTRE as 200 mais recentes com cara de "as
finalizadas". É a armadilha do filtro de grupos, e a prova tem a cena: a
finalizada parada há 1300 horas no telefone de 1200 conversas.

**O que entra nas dependências de `carregarConversas` é a PERGUNTA**
(`abaDaLista`), e não `temSituacao` — a lição de 25/09 (`ordenarPelaEspera`).
A descoberta de que a coluna existe mora no módulo (`SITUACAO_NO_BANCO`): sem
o 028, o filtro derruba a consulta com 42703, a bandeira baixa e a lista é
refeita sem aba, **uma vez por sessão**.

**Trocar de aba não afirma uma ausência que ainda não apurou.** Entre o clique
e a resposta, a lista ainda é a da aba de antes, e o recorte da tela a esconde
inteira: sem `abaDasConversas` (a régua de `conversasDe`), "Finalizados" diria
"nenhuma conversa finalizada" durante a ida ao banco. Hoje diz "Carregando as
conversas…".

**A pílula "Não lidas" conta a aba**, e não o telefone. O banco devolve as
não lidas de cada aba junto com o número delas. Com o do telefone inteiro, ela
diria 10 numa aba em que o filtro mostra 6, e as outras 4 pareceriam ter
sumido. O selo da barra lateral continua sendo o do telefone: lá a pergunta é
outra. Enquanto a conta da aba não chega, a pílula fica sem número.

**A busca atravessa as abas** (`naAba` deixa passar tudo com busca escrita),
e a linha da outra aba ganha um selo (`data-selo-da-situacao`: "aguardando",
"em aberto", "finalizada"), pela régua do selo de arquivada. Procurar um
cliente e não achá-lo porque ele mora noutra aba seria o "nada encontrado" que
faz a pessoa concluir que ele não está no Zorvin.

**O tempo real muda a conversa de aba na tela de todo mundo**: o tratador de
`conversas` traz `situacao` e `protocolo` pela presença da chave. A conta das
abas é pedida de novo **só quando a situação, o protocolo ou o "tem não lida"
mudam**, com uma espera de 2,5 s e uma conta por vez — quase todo aviso dali é
outra coisa (a prévia, o "digitando…", o "estou atendendo" de minuto em
minuto). E **a conversa de fora da lista que entra na aba aberta** (um colega
finalizou com "Finalizados" na tela, ou reabriu) relê a página
(`agendarReleituraPelaAba`), pulando a vez se o aviso da mensagem já releu.

### Finalizar

A mesma checklist (`JaTratei.jsx`, `finalizar`), com o título "Finalizar", o
protocolo que vai ser fechado e o que acontece se o cliente escrever de novo.
**Quem finaliza é o gatilho do banco, na mesma gravação do registro**: a tela
NÃO grava `tratada_em` nem `situacao` — seria uma segunda escrita da mesma
regra. **A tela relê a linha** em vez de supor (o gatilho desiste calado se
tropeçar, de propósito), e a frase diz o que o banco fez: *"Finalizada —
protocolo 2026-000123"*, ou *"o banco não finalizou"*.

**Larguras medidas** (`LARGURA_DO_JA_TRATEI`, a 1920): "Já tratei" deu os 90
de sempre, o que confere a régua; "Finalizar" 92,7 e "Reabrir" 85,8.

### Reabrir — dois sentidos, e os dois existem

| | o que acontece | o registro |
|---|---|---|
| **Reabrir para continuar** | volta para "Em aberto" com um **protocolo novo** | fica — a finalização aconteceu |
| **Desfazer (foi engano)** | o **mesmo** protocolo volta a ficar aberto | é marcado como desfeito |

`Reabrir.jsx`. Um botão só teria de escolher por quem clica, e os dois erros
são caros. **"Continuar" vem primeiro**: o engano se percebe na hora.

- **Continuar** grava `situacao = 'aberto'` com `.eq("situacao",
  "finalizado")` — entre abrir a janela e apertar, o cliente pode ter escrito
  e a conversa já ter outro protocolo. **Zero linhas tem duas causas**, e a
  linha relida diz qual: o banco não deixou, ou ela já não estava finalizada.
- **Desfazer** marca o ÚLTIMO clique como desfeito (é o que reabre, pelo
  gatilho), relê a conversa e só então devolve a fila de espera
  (`tratada_em` nulo e `zorvin_recontar_espera`) — **a espera ORIGINAL**, a
  conferência mais cara do "Já tratei". A ordem se inverte em relação ao
  "Voltar para a fila" de sempre, pela mesma régua: primeiro o que se vê, e
  aqui o que se vê é a aba. Sobrou outro clique no mesmo protocolo (duas
  pessoas finalizaram juntas)? A conversa continua finalizada, e a frase diz.

### Os marcos dos protocolos na conversa

Cada atendimento vira até dois marcos na linha do tempo
(`data-marco-do-atendimento`): *"Protocolo 2026-000100 aberto — o cliente
escreveu"*, *"… finalizado por Jenifer"*, *"… reaberto por Rodrigo"*. É assim
que "o cliente em si já foi tratado" aparece para quem abre a conversa depois.

- **Lidos de `zorvin_atendimentos`**, numa quinta ida junto das notas; sem a
  tabela, calados; com a leitura falhando, a faixa âmbar.
- **Só os do trecho que está na tela**: com mensagens mais antigas por
  carregar, um protocolo de três meses atrás no alto da conversa diria que ele
  começou logo antes das mensagens desta semana. Entram junto das mensagens
  antigas.
- **Na frente da mensagem que abriu o protocolo**: a ordenação é estável, e o
  marco tem a mesma hora dela.
- **Relidos pelo tempo real da conversa**, quando a situação ou o protocolo
  dela mudam — e não a cada aviso.

**E dois defeitos de antes saíram junto.** O ponto de partida das "mensagens
anteriores" era o primeiro item que não fosse nota — e a **resposta
automática** (lida inteira, 50 de uma vez) mais velha que a janela fazia pular
tudo o que ficava entre ela e a janela. Hoje é a mais antiga de `mensagens`
(`ehDeMensagens`). E as anteriores eram **emendadas na frente**, sem
reordenar: a nota mais velha que a janela ficava acima delas, fora da ordem do
tempo. Hoje a lista é reordenada.

### A bancada

Imita os gatilhos do 028 (o clique que finaliza, o desfeito que reabre, a
mensagem do cliente que reabre com protocolo novo, a guarda que recusa a
situação gravada pela tela). **As conversas de sempre nascem "em aberto" e sem
protocolo**, e é decisão: em "aguardando", a lista de toda prova antiga
perderia as conversas que nunca tiveram resposta, e cada prova passaria a
medir a aba. `__MENSAGEM_PELA_PONTE` é "o cliente escreveu", com os dois
avisos do tempo real; `__SEM_SITUACAO` é o banco sem o 028, e o filtro por uma
coluna que a base não tem responde 42703, como no PostgREST — sem isso a
bancada devolveria lista vazia, e a prova aprovaria o pior dos dois.

### O que fica para depois

~~A **contabilização** do DataCrazy (relatório por protocolo, tempo até a
primeira resposta, tempo até finalizar): os campos nascem no 028, a tela
não.~~ **Feita** — ver "A contabilização dos atendimentos (20/10)", mais
abaixo. **Continua em aberto** a **busca por protocolo**.

### As provas

Prova: `aguardando-em-aberto-e-finalizados`, 120 conferências, **27
sabotagens e 27 pegas**, todas limpas, rodadas em cópias e lidas uma a uma.
As que importam mais:

- a aba que não vai ao banco (a finalizada parada há 1300 horas some);
- o "Finalizar" que segue o caminho do "Já tratei" de antes (oito
  conferências reprovam);
- a tela que supõe a finalização em vez de reler a linha (o banco que
  registra e não finaliza);
- o Reabrir que desfaz, e o Reabrir sem a trava da situação (o cliente que
  escreveu com a janela aberta);
- o Desfazer que desfaz todos os cliques, e o que não reconta a espera;
- a pílula contando o telefone inteiro;
- os marcos de fora do trecho que está na tela, e os que entram depois da
  mensagem que abriu o protocolo;
- a mensagem de outra aba relendo a lista.

**As provas antigas do "Já tratei" rodam no banco SEM o 028**
(`o-ja-tratei`, `o-ja-tratei-em-toda-conversa`, `o-historico-do-ja-tratei` e
a cena 8 de `a-auditoria-de-07-10`), com o porquê escrito no alto de cada uma.
Elas medem o caminho de quem não tem o 028, que continua existindo e tem de
continuar igual. O caminho com o 028 tem as mesmas réguas na prova nova.
**`o-topo-mais-baixo` mede o topo sem a fileira das abas**, que ganhou teto
próprio: menos de 40px no computador e de 50 no celular.

**Três coisas que as provas me ensinaram nesta rodada:**

- **a 1400 com a ficha aberta, o botão do cabeçalho não tem texto.** Ele
  vira ícone de propósito (`cabecalhoApertado`), e a conferência que lia o
  `textContent` reprovava o painel certo. Hoje ela lê o `aria-label`;
- **"releu a lista" se mede pela consulta das FIXADAS**, que só a releitura
  da página faz, e não por um número de idas ao banco escrito no chute.
  Escrevi "no máximo 2 idas" sem medir, e a primeira rodada mediu 4 sem
  releitura nenhuma: o aviso de mensagem nova já pergunta ao banco pelo dono
  e pela conversa;
- **conversa plantada sem `situacao` não entrava na aba.** Duas provas que
  inserem conversas na bancada (`busca-que-oferece` e
  `o-aviso-vai-para-o-responsavel`) reprovaram: a conversa sem a coluna não
  passava pelo filtro "em aberto". A bancada lê a coluna que falta como "em
  aberto", que é o padrão dela.

## Os nomes das abas: Novos e Em Atendimento (20/10)

Pedido do Rodrigo, junto com a contabilização: *"altere os nomes:
'Aguardando' para 'Novos' e 'Em aberto' para 'Em Atendimento'"*.

**Só a tela muda.** Os valores do banco (`conversas.situacao`) continuam
`aguardando`, `aberto` e `finalizado`: trocar o valor seria regravar cada
conversa e mexer nos gatilhos do 028. Os nomes moram num lugar só,
`src/abasDaSituacao.js` (`ABAS_DA_SITUACAO`, `NOME_DA_SITUACAO`), porque três
telas dizem o nome da aba — a lista, a janela do "Finalizar" e a do
"Reabrir". Com três cópias, a próxima troca deixaria uma frase mandando
procurar uma aba que não existe mais.

**`NOME_DA_ABA` já existia** no `Painel.jsx`: é o nome da aba do NAVEGADOR
("Ropelimi Zorvin"). A primeira escrita colidiu com ele e o build reprovou —
por isso o nome da aba da lista é `NOME_DA_SITUACAO`.

**"Em Atendimento" não cabia num terço da fileira.** Medido: com o número ao
lado, ele pede 118px, e um terço são 109 no computador e 89 num Android de
360. E os números de verdade pioram a conta: as conversas que ninguém
finalizou passam de mil no escritório, e "Em Atendimento 1523" com "Novos
214" pediam 298px numa fileira que tem 275 por dentro — a página passava a
rolar de lado. A bancada, com os poucos números dela, nunca mostraria isso.

| | o que faz |
|---|---|
| a largura sai do nome (`flex: 1 1 0` e `min-width: max-content`) | cada aba começa no tamanho do que escreve, e as que sobram dividem o resto por igual |
| ~~no celular, letra de 12 e menos folga~~ | ~~sobra espaço a 360, com os números de mil~~ — **superado no mesmo dia**: com o número de "Finalizados" não sobrava, e no celular o número desceu para baixo do nome (ver "O número de "Finalizados"", logo abaixo) |
| a largura do negrito, guardada | a aba escolhida fica em negrito; sem uma cópia escondida do nome em negrito, ela engordaria ao ser clicada e empurraria as vizinhas |

**Dois limites, escritos:** ~~a 320px a fileira ainda não cabe (a régua desta
casa é o Android de 360)~~ — **cabe desde o mesmo dia**, com o número embaixo
do nome no celular; e a reserva do negrito **não se mede aqui** — a fonte das
provas não tem o peso 600 e o desenha igual ao 700. No Windows do escritório
(Segoe UI) os dois diferem. ~~(DejaVu Sans)~~ **A fonte das provas é a
Liberation Sans**, que desenha a Arial dos botões — este parágrafo dizia DejaVu
Sans, e estava errado (ver "A fonte que se mede aqui", logo abaixo).

**O selo da busca virou o NOME DA ABA** ("Finalizados", "Novos"), e não um
adjetivo da conversa: "nova", sozinho numa linha, se leria como mensagem
nova. **E a aba vazia** diz "Nenhum cliente novo. Aqui ficam os clientes que
a equipe ainda não atendeu." — "nenhuma conversa nova" teria o mesmo
problema.

Prova: `aguardando-em-aberto-e-finalizados`, agora com 135 conferências:
entraram a cena dos nomes inteiros a 1360, 390 e 360px **com os números do
escritório** (`__CONTAGEM_DAS_ABAS_FIXA`, que a bancada devolve no lugar da
conta dela), a frase do Reabrir e a aba vazia. **8 sabotagens e 8 pegas**,
todas limpas, rodadas em cópias e lidas uma a uma: os nomes antigos de volta;
um terço para cada aba; o celular sem o aperto (a página rolando de lado a
360); o Reabrir, o Finalizar e o Desfazer dizendo "Em aberto"; o selo da busca
com o adjetivo de antes; e a aba vazia com a frase velha.

## O número de "Finalizados" (20/10)

Pedido do Rodrigo, com foto, no mesmo dia dos nomes novos: *"Onde está escrito
'Finalizados' precisa ter o número da quantidade também."*

**O banco já devolvia a conta** (`zorvin_contar_situacoes.finalizado`, desde o
028): era a tela que a escondia, por uma decisão de 19/10 — *"só cresce, e um
número que nunca zera se aprende a não ler"*. A decisão era minha, e não dele;
ele viu a tela e pediu o número. **A conferência que exigia a aba sem número
foi INVERTIDA, e não apagada**: escrita ao contrário, é ela que impede o número
de sumir de novo numa limpeza futura.

**Cinza, como o de "Em Atendimento".** Âmbar continua sendo só o de "Novos",
com qualquer conversa dentro: é o único dos três que pede ação de quem lê.

### A conta da fileira, medida — e o celular mudou de forma

Com três números a fileira não cabia, e o celular **já não cabia com os
números de hoje**. Medido a 360px, onde ela tem 283 por dentro:

| os números | ao lado do nome | embaixo do nome |
|---|---|---|
| 18 · 507 · 612 (os de hoje, da foto) | ~298 — **não cabe** | 229 |
| 214 · 1523 · 4812 | 316 — **não cabe** | 229 |

**No celular, o número desceu para baixo do nome.** Embaixo, cada aba tem a
largura do NOME, e a fileira cabe com qualquer número, até num celular de 320.
**E a aba não cresce:** ela já tinha 40px no celular, pelo alvo de dedo, e
nome e número somam 38. Espremer letra e vão até caber ao lado deixaria as três
abas grudadas umas nas outras, e só até o próximo dígito.

**No computador, continua ao lado**, como no WhatsApp Web. A fileira tem 336px
por dentro, e "Novos 214 · Em Atendimento 1523 · Finalizados 4812" pedia 346.
Com 2px entre as abas (eram 4), 4 entre o nome e o número (eram 5) e a pílula
mais justa (letra de 10,5 e folga de 4 de cada lado), pede 330. **O limite,
escrito:** com quatro dígitos nas três abas, ou cinco em "Finalizados", sobra
meio pixel; um dígito a mais e a última aba entra na folga da fileira — sem
cortar nada, e sem a página rolar de lado.

**O lugar do número fica guardado no celular** enquanto a conta não chega (ou
quando ela falha): sem isso, o nome ficaria no meio da aba e subiria quando o
número chegasse — um pulo a cada telefone escolhido. A pílula e o lugar
guardado têm uma escrita só (`pilulaDoNumero`), porque têm de ter o mesmo
tamanho.

### A fonte que se mede aqui — e um engano meu que ficou escrito

**Botão não herda a fonte da página.** As abas saem na fonte de botão do
navegador: aqui ele pede Arial, e quem a desenha é a Liberation Sans, com a
mesma largura — perguntado ao próprio navegador
(`CSS.getPlatformFontsForNode`). A entrada anterior dizia que a fonte das
provas era a DejaVu Sans, e estava errada. **E pôr outra fonte na fileira não
mede nada**: foi o que eu fiz para conferir "uma fonte mais larga", e os
números saíram idênticos — quem tem a fonte são as abas, que são botões, e não
a fileira.

**A conta vale para o escritório e para o celular.** Pelas métricas publicadas
das fontes (o pacote `@capsizecss/metrics`), a largura média das letras é
Arial 0,4458 em, **Segoe UI 0,4434** e Roboto 0,4448 — meio por cento de
diferença.

### Arquivar tira a conversa do número da aba

O número de "Finalizados" deixou à vista uma lacuna que já valia para os outros
dois: a conta do banco deixa de fora as arquivadas, como a lista, mas só era
pedida de novo quando uma conversa **mudava de aba** — e arquivar não muda a
aba. Arquivar uma finalizada a tirava da lista e deixava o número contando com
ela.

- **o gesto desta tela** (`gravarMarcaDaConversa`): arquivar e desarquivar
  pedem a conta, como marcar como lida já pedia;
- **a colega que arquiva** (o tempo real): a mudança de `arquivada` pede a
  conta. O "antes" é o da lista; da conversa que não está nela, o do último
  aviso (`arquivadasVistasRef`, ao lado de `situacoesVistasRef`). A que nunca
  passou por aqui já pedia a conta, por ser nova para esta tela.

Prova: `aguardando-em-aberto-e-finalizados`, agora com 165 conferências: a de
"Finalizados" invertida; os três números a 1360, 390, 360 e 320px, com quatro
dígitos em "Finalizados" — no computador ao lado do nome e sem entrar na folga
da fileira, no celular embaixo do nome e com a aba nos 40px; o nome que não
pula quando a conta falha; e o arquivar pelos três caminhos (esta tela, a
colega com a conversa na lista, a colega com ela fora). **11
sabotagens e 11 pegas**, todas limpas, rodadas em cópias e lidas uma a uma:

- "Finalizados" sem número de novo (18 reprovações);
- o número ao lado do nome também no celular (a página rolando de lado a 360 e
  a 320);
- os vãos de antes no computador (a última aba entrando na folga da fileira);
- sem o lugar guardado do número no celular (o nome pulando 8,5px);
- o lugar guardado com outro tamanho (a fileira mudando de altura quando a
  conta chega);
- arquivar por esta tela sem pedir a conta;
- a colega que arquiva sem pedir a conta;
- a conversa de fora da lista sem a memória do arquivar;
- o número de "Finalizados" em âmbar;
- no celular, o número em cima do nome;
- a aba do celular crescendo para 46px.

**E o vigia `provas-que-reprovam` pegou três conferências minhas antes da PR**:
`.every(...)` com a guarda do tamanho numa variável à parte, fora do bloco do
`if` — uma lista vazia passaria por elas. Hoje o tamanho está escrito em cada
uma.

## A conversa que se manda abrir abre — esteja em que aba estiver (22/10)

Dois relatos do mesmo dia, sobre o mesmo defeito por duas portas: *"quando eu
clico no ícone do Zorvin [no Controle de atendimento do Vantoro], não está
abrindo direto na conversa"* e *"no histórico de atendimento, ao clicar para
ver a conversa [do cliente por outro telefone] não está abrindo a conversa"*.

**A tela da direita não guarda a conversa aberta: ela a PROCURA na lista da
esquerda** (`conversas.find`) — a regra do relato de 10/09, em "a conversa
aberta atravessa a recarga". E desde as abas (19/10) a lista vem do banco
recortada pela aba. Quem abria trocava de telefone e relia a lista; a conversa
que morava em "Novos", em "Finalizados" ou atrás das 200 mais recentes não
vinha nela, e o clique terminava em "Selecione uma conversa", sem uma palavra.

**O conserto da aba veio em duas PRs**, cada uma por uma porta: #281 (o link)
e #283 (o histórico), as duas pela mesma função, `abrirNaAbaDela` — que lê a
linha, a põe na lista e leva a lista para a aba dela. **Quatro portas passam
por ali**: o link e a "Nova conversa" (`abrirConversaContato`), e o histórico,
o cartão do funil e a tarefa (`verConversaDoHistorico`).

### O que ainda faltava às quatro portas

| | antes | agora |
|---|---|---|
| a leitura que falha | o clique mudo — e o telefone já trocado | a frase com o código (`lerConversaParaAbrir`), e nada muda: nem o telefone, nem a janela da "Nova conversa" |
| a conversa arquivada | abria à direita com a esquerda fora da pasta, sem a linha dela | a lista vai para a pasta de arquivadas |
| um filtro ou uma busca ligados antes | escondiam a linha que se acabou de abrir | voltam para "Tudo", a regra de `trocarAdvogado` |
| o cliente que ninguém respondeu | o histórico dizia *"a conversa existe, mas só com o que ele mandou"* e **não oferecia abrir** | a lista "Por telefone" é uma escrita só (`porTelefone`), mostrada nos dois casos |

**A leitura vem antes de mexer na tela, e quem chama a faz.** Lida depois de
trocar o telefone, a falha deixava a pessoa num telefone que ela não escolheu,
com a direita vazia. **A pasta é um lugar, como a aba:** a pergunta que a lista
faz ao banco (`abaDaLista`) é a aba dela, ou nenhuma dentro da pasta, e quando
essa pergunta muda quem relê é o efeito, e não uma chamada daqui com a aba de
antes.

**A frase "não achei"** diz *"ela pode ter sido juntada a outra"*: o funil e as
tarefas guardam o id de uma conversa que a ponte pode ter juntado depois.

### A prova

`a-conversa-do-historico-abre`, 67 conferências: a conversa do outro telefone
em "Em Atendimento", em "Finalizados", em "Novos", arquivada e atrás de 210
mais recentes (e ela continua aberta quando a lista é relida), com o filtro
"Não lidas" ligado, o cliente que ninguém respondeu, a "Nova conversa" com o
cliente finalizado, a tarefa da tela de Tarefas, e as duas leituras que
falham — pelo histórico e pela "Nova conversa". A bancada ganhou
`__QUEBRAR_SO_A_LEITURA`: a "Nova conversa" GRAVA a conversa e depois a lê, e é
a segunda ida que precisa poder falhar sozinha — com `__QUEBRAR` a gravação
falharia antes, e a cena mediria a frase de outro tropeço.

**11 sabotagens, 10 pegas e uma que vaza com razão**, todas rodadas em cópias
e lidas uma a uma:

- o painel da `main` de antes do #283 (25 reprovações — o relato reproduzido);
- o painel do #283, sem o que esta entrega acrescenta (13);
- sem levar a aba (9);
- a falha calada (4);
- a lista por telefone só com resposta (4);
- sem a pasta de arquivadas (2);
- sem a emenda (2: a conversa antiga não abre);
- trocar o telefone antes de ler (1);
- fechar a janela da "Nova conversa" antes de ler (1);
- sem limpar o filtro (1);
- **e a que vaza:** reler daqui com a aba de antes ao entrar na pasta. A
  resposta chega e é jogada fora pela trava da aba em `carregarConversas` — a
  régua de 25/09, *sabotagem que o resto do sistema conserta sozinho não prova
  nada*. O `return` fica: é uma ida ao banco a menos, e não depende de a trava
  existir.

**Uma armadilha da prova, e era minha:** a conferência "a linha dela entra na
lista" procurava a linha no documento, e a lista desenha só o que cabe — a
conversa mais antiga das 211 estava na lista e não no documento. A prova rola
até ela, como quem procura.

## A contabilização dos atendimentos (20/10)

Pedido do Rodrigo, depois das abas: *"pode seguir com a contabilização do
DataCrazy"*. Uma seção nova, **"Protocolos de atendimento"**, no ALTO do
Painel de números, embaixo da mesma barra de filtros. A conta é do banco
(`zorvin_relatorio_atendimentos`, script 029 da ponte, com as regras no
CLAUDE.md dela).

**A página de ajuda do DataCrazy não abriu daqui** — o endereço não resolve,
e o proxy recusa. As definições saíram da descrição que o Rodrigo copiou e do
que a busca mostrou, e isso foi dito a ele.

**Um atendimento é um protocolo, e só entra no total quando a equipe
começa** — respondeu, finalizou, ou abriu ela mesma. É a regra que ele
copiou: o que está aguardando *"não soma no volume de 'Quantidade Total' até
que a interação humana de fato comece"*. O que ninguém tocou aparece à
parte, em **"Esperando resposta"** — inclusive o protocolo novo do cliente
que voltou a escrever numa conversa finalizada: a conversa está em "Em
Atendimento", e o protocolo dela só conta quando alguém responder. **É
decisão**, e foi dita ao Rodrigo, com a outra leitura (contar pela aba) a um
pedido de distância.

| cartão | o que é |
|---|---|
| Total de atendimentos | os protocolos do período em que a equipe começou, comparados com o período anterior |
| Em atendimento | começados e ainda não finalizados |
| Finalizados | fechados pelo "Finalizar" — somados aos de cima, dão o total |
| Esperando resposta | o que ninguém tocou: fora do total, e só para quem administra |
| Até a primeira resposta | só nos protocolos que o CLIENTE abriu; mediana, com a média ao lado |
| Até finalizar | da abertura do protocolo ao "Finalizar" |

E um gráfico **por dia** (verde com atendimento, âmbar esperando, os dias
vazios como zero), uma tabela **por pessoa** (todo mundo, com "Pelo celular"
numa linha própria; para quem administra, clicar recorta a tela) e **a lista
dos protocolos**, com a planilha.

**Tudo é do período da abertura**, e é isso que faz o total fechar com os
dois cartões ao lado. **Só o total compara com o período anterior**: comparar
quantos ainda estão em atendimento mediria só que o mês velho teve mais
tempo para ser finalizado.

**Vem primeiro na tela, e diz que o "Atendimentos" de baixo é outra conta.**
O resumo de mensagens de sempre chama de "atendimento" um trecho de conversa
entre silêncios de 6 horas, e a "Situação dos atendimentos" dele (aguardando
resposta, em andamento, encerrados) sai da mesma conta. Juntar os dois
sentidos é decisão do Rodrigo, e ficou oferecido.

**Quem não administra** vê os protocolos de que participou — respondeu
primeiro, finalizou ou reabriu —, e os tempos são os dela. O recorte é do
banco: pedir "todo mundo" por fora devolve o recorte assim mesmo. O
"Esperando resposta" não aparece para ela, porque ainda não é de ninguém.

**O aviso de falta não manda colar SQL.** As seções de baixo ainda dizem
"rode o script … no SQL Editor", que era verdade antes de 08/10. Esta diz
que a atualização (029, ou 028) entra sozinha quando a ponte é publicada, e
onde conferir: Departamentos e acessos → Atualizações do banco.

**A planilha leva os tempos em MINUTOS inteiros**, que se somam e se ordenam
no Excel — "2 h 10 min" não.

**A prova `painel` reprovaria, e foi ajustada junto.** A cena "banco sem a
função do Painel" exige nenhum cartão de número fora dos relatórios, e a
seção nova tem os seus. A conferência passou a descontar também os de
`[data-relatorio-protocolos]`; a régua dela continua valendo para os números
que dependem do `painel_dashboard`.

**E um caractere invisível entrou no código, e saiu antes do commit.** O
começo da planilha (o BOM, que faz o Excel ler o acento) foi gravado como o
próprio caractere, e não como `\ufeff` — a armadilha que esta casa já
registrou com os acentos dentro de uma expressão regular. Quem achou foi a
montagem das sabotagens: a troca procurava `\ufeff` e não achava. Hoje está
escrito como no resto do arquivo, e a varredura de caracteres invisíveis no
que mudou deu zero nos dois repositórios.

Prova: `a-contabilizacao-dos-atendimentos`, 50 conferências, sobre dez
protocolos com as contas feitas à mão — a bancada faz a conta do 029
(`zorvin_relatorio_atendimentos`, com `__SEM_CONTABILIZACAO` e
`__CONTABILIZACAO_FALHA`). Ela termina pelo caminho inteiro: finalizar na
conversa o protocolo que esperava e vê-lo entrar no total. **20 sabotagens e
20 pegas**, todas limpas, rodadas em cópias e lidas uma a uma. As que importam
mais:

- a seção abaixo do resumo de mensagens, e a seção que some;
- o período anterior que some do total, e o que aparece em todo cartão;
- o "Esperando resposta" para quem atende;
- a falha da função virando "falta uma atualização", e a falta do 028
  ignorada (cartões zerados com cara de número);
- os dias sem nada sumindo do gráfico;
- a planilha sem o BOM, e com os tempos em segundos;
- a média no lugar da mediana;
- o "por pessoa" sem o celular, e o clique nele que não recorta;
- a espera inventada na conversa começada pela equipe;
- o filtro de telefone ignorado.

## O tempo real que entupia — e a mensagem que parecia não ter saído (20/10)

Relato do Rodrigo: *"Quando é enviada uma mensagem demora para aparecer,
muitas vezes parece que falhou o envio."* Ele ligou o conector do Supabase, e
a medição foi feita de lá, **só lendo**: `pg_stat_user_tables`, os registros
do tempo real (`realtime_logs`) e os do portão da API (`edge_logs`), estes
agrupados por quem pediu.

**A ponte não era a demora.** O texto saía em 2 a 4 segundos — 90% em até
3,3 s, de `criado_em` a `enviado_em` na fila. O que demorava era a TELA saber.

| o que o Supabase mostrou em 20/10 | |
|---|---|
| pedidos na hora mais cheia | **614 mil** (170 por segundo), para ~17 abas abertas e 67 mensagens enviadas |
| três abas, de três pessoas | **~100 mil pedidos por hora cada uma**; uma aba normal faz de 2 a 15 mil |
| leituras de etiquetas | 190 mil numa hora |
| contas dos selos de não lidas | 45 mil numa hora |
| gravações na conversa aberta | uma pessoa, 5.619 numa hora (1,5 por segundo) |
| o tempo real | 19 avisos no dia de *"Too many postgres changes messages per second"* |

O limite do plano gratuito é **100 avisos por segundo**, e cada gravação numa
conversa vira um aviso **para cada aba aberta** do escritório. Passando do
limite, a documentação diz que o Supabase derruba as conexões (`tenant_events`)
— e a confirmação do envio é justamente um desses avisos.

### Três defeitos, os três daqui

**1. O relógio órfão — a causa do entupimento.** Sair de um canal faz a
biblioteca chamar de volta com `CLOSED` (`RealtimeChannel.subscribe` registra
isso em `_onClose`), e esse `CLOSED` chega DEPOIS da limpeza do efeito.
`aoMudarDeEstado` não perguntava se o efeito ainda vivia: armava a carência
num efeito morto, e dez segundos depois ela abria uma pesca de 20 em 20
segundos que ninguém tinha mais como fechar. E o efeito do canal era refeito
a cada troca de **aba** (Novos, Em Atendimento, Finalizados), de **telefone**
e de **ordem**, porque `carregarConversas` estava nas dependências e muda com
as três. **Cada troca deixava um relógio para sempre.** Desde as abas (19/10)
quem atende troca de aba o dia todo — à tarde eram dezenas por aba, e a aba
relia a lista, as etiquetas, os selos e a conversa aberta de três a cinco
vezes por segundo. Cada releitura gravava o "estou atendendo", e cada
gravação virava aviso para as outras dezesseis abas.

Hoje:

- **o canal é assinado uma vez por abertura do painel** — a lista entra pelo
  espelho (`carregarConversasRef`), e trocar de aba, telefone ou ordem não
  mexe nele. Sem o vão de rede entre um canal e outro, junto;
- **cada canal fala só por si**: o retorno de chamada leva o canal que o
  criou, e o que já não é o canal de agora não arma nada — nem o da limpeza
  (`vivo`), nem o velho que o vigia acabou de tirar (`canal` fica vazio
  durante a saída).

**2. As etiquetas e os selos a cada aviso.** As etiquetas da lista inteira
eram relidas a cada mudança do array `conversas` — a prévia, o "digitando…",
o "estou atendendo" de cada colega, a lista reordenada. Agora a conta é pelos
**ids** da lista (`idsDaLista`): só muda quando entram ou saem conversas.
Etiqueta muda pelo aviso dela, que já relia. E os selos da barra eram
contados a cada aviso de conversa; eles contam, por telefone, as conversas
com não lida e não arquivadas (`nao_lidas_por_telefone`), então só três
passagens os mexem — ter ou não não lida, ser ou não arquivada, o telefone.
É o que o tratador confere (`selosVistosRef`, pela régua de
`arquivadasVistasRef`). A conversa que esta tela nunca viu conta: conta a
mais é o erro barato. E a mensagem nova só conta selos se for do cliente.

**Os gestos daqui que mudam a lista antes do aviso chegar pedem a conta eles
mesmos** — `marcarLida` já pedia, e `gravarMarcaDaConversa` passou a pedir
quando mexe em não lida ou arquivada. Para eles o aviso não vê diferença.

**3. A releitura apagava a bolha — o "parece que falhou".** Reler a conversa
troca a lista inteira pelo banco, e a mensagem que acabou de entrar na fila
ainda não está em `mensagens`: a ponte só a grava depois que o WhatsApp
aceita. **A bolha sumia da tela** e voltava segundos depois, já como mensagem
de verdade. Nas abas presas no relógio órfão isso acontecia em toda mensagem.

Hoje a provisória ainda sem a linha de verdade **fica** na releitura
(`provisoriasQueFicam`). A regra de casar é uma escrita só
(`confirmaAProvisoria`), a mesma do aviso de INSERT. **E a linha que já
estava na tela não confirma nada**: o "ok" de ontem não é o eco do "ok" de
agora. Uma prova pega isso. A que falhou com a linha da fila conhecida volta
pela fila (a bolha `fila-…`); a que falhou sem chegar à fila fica, com o
texto e o reenviar — antes ela sumia na primeira releitura.

### A conferência do envio

Quem tira o relógio da bolha é o tempo real: a fila dizendo "enviada", ou a
mensagem gravada chegando. Quando o aviso se perde, a bolha ficava "enviando"
até alguém sair e entrar na conversa. Agora, **12 segundos** depois de a
mensagem entrar na fila, se a bolha ainda está saindo, a conversa aberta é
relida — e de novo aos **40** (`CONFERENCIA_DO_ENVIO_MS`). Os números saem da
medição: 90% dos textos saem em 3,3 s, e o anexo espera na fila atrás de
outro anexo (p90 de 13,7 s). **Uma conferência de cada vez** (dez mensagens
seguidas são uma releitura), **e nada é relido quando o aviso chegou.**

O estado do envio passou a ir escrito na bolha (`data-estado-do-envio`:
`enviando`, `saiu`, `gravada`, `erro`), para a prova ler o que o relógio e os
tiques desenham.

### A bancada mentia por omissão — duas vezes, as duas sobre sair do canal

- **`removeChannel` não chamava de volta com `CLOSED`**, e por isso nenhuma
  prova via o relógio órfão. Hoje chama (`avisarQueFechou`), depois de a
  saída terminar, como a biblioteca.
- **E o canal que já tinha saído ainda respondia à entrada.** A biblioteca
  destrói o pedido de entrada ao sair (`joinPush.destroy()`); aqui o
  `SUBSCRIBED` atrasado de um canal removido chegava assim mesmo, e apagava
  por acaso a carência que o `CLOSED` tinha acabado de armar. **A sabotagem
  que tira a guarda do canal PASSOU na primeira rodada por causa disso** —
  escondida pela própria bancada. Hoje o canal removido não responde mais
  (`__saiu`), e a mesma sabotagem é pega por nove conferências.

A guarda é medida na abertura do painel: em desenvolvimento o React monta,
desmonta e monta de novo, de propósito, e é a mesma saída de canal de quem
sai e entra no Zorvin sem recarregar a página.

E o diário marca a conta dos selos pela função (`marca.funcao`): ela pesa em
`conversas`, junto da lista, e sem isso a prova não separava uma da outra.

### O que NÃO foi feito, e por quê

- **A ponte e os gatilhos gravam a conversa sem mudar nada**, e cada gravação
  é aviso para todas as abas: o `upsert` da conversa no webhook (o mesmo valor
  por cima), e o gatilho da espera quando a espera já estava marcada. São
  dois dos quatro avisos de cada mensagem de cliente. Ficou para uma rodada
  da ponte, depois de medir o que este conserto já tirou: mexer no caminho de
  entrada de mensagem por uma economia que talvez nem faça falta não vale o
  risco.
- **O plano do Supabase.** O Pro tem 500 avisos por segundo. É decisão de
  custo do Rodrigo, e só faz sentido se, com este conserto, o limite ainda
  estourar.
- **A bolha de quem troca de conversa** antes de a ponte gravar continua
  sumindo ao voltar — trocar de conversa esvazia a lista de propósito. Na
  volta, a mensagem quase sempre já foi gravada.

### Como medir de novo (só leitura, pelo conector do Supabase)

- `pg_stat_user_tables` duas vezes, com um minuto entre elas: quanto
  `conversas` é gravada por minuto. Em 20/10, sem nenhuma mensagem chegando,
  eram 169 gravações em dois minutos — quase tudo "estou atendendo".
- `realtime_logs` com `MessagePerSecondRateLimitReached`: quantas vezes o
  limite estourou.
- `edge_logs` agrupados por `request.sb.jwt.authorization.payload.subject`,
  por hora: uma aba presa num relógio aparece como dezenas de milhares de
  pedidos de uma pessoa só.

Prova: `o-envio-nao-parece-que-falhou`, 35 conferências, **12 sabotagens e
12 pegas**, todas limpas, rodadas em cópias e lidas uma a uma:

- o painel de antes inteiro (18 reprovações — é o relato reproduzido: com a
  bancada fiel, a bolha recém-enviada some da tela em menos de meio segundo,
  e em menos de três segundos de tela parada há 218 leituras da tabela de
  conversas);
- sem a guarda do canal que saiu;
- o canal refeito a cada troca (nove canais em vez de dois);
- as etiquetas pela lista;
- os selos a cada aviso, os selos nunca pelo aviso, e os selos por toda
  mensagem;
- a releitura apagando a bolha;
- o "ok" de antes confirmando o de agora;
- sem a conferência, a conferência sem perguntar se ainda há bolha saindo, e
  uma conferência por mensagem.

## A sessão que acaba volta para a tela de entrada (22/10)

Um dos três pedidos do Rodrigo em 22/10: *quando o acesso de alguém expirar,
o painel tem de ir sozinho para a tela de entrada, em vez de ficar parado sem
carregar nada.*

**Medido nos registros do Supabase, só lendo:** em 22/10 um navegador do
escritório passou das 09:57 às 16:35 pedindo coisas ao banco SEM sessão. Foram
152 pedidos, todos recusados (401), com o papel `anon`. A tela continuava sendo
o painel, e nada carregava: nem a lista, nem as etiquetas, nem a conversa
aberta.

**A biblioteca do Supabase devolve "sem sessão" sem avisar** em alguns
caminhos, e o `App` só trocava de tela quando ela avisava (`SIGNED_OUT`):

- **a sessão assinada pela ponte** (o caminho de 19/08, com o Auth fora do ar)
  dura 12 horas e não tem com o que renovar, de propósito. A biblioteca a dá
  por vencida 90 segundos antes do fim, e aí ela ESTOURA ao tentar renovar
  (`AuthSessionMissingError`), sem emitir saída nenhuma;
- **a renovação que tropeça na rede** com o bilhete já vencido: a biblioteca
  guarda a sessão para tentar de novo e, enquanto isso, responde "sem sessão";
- **a sessão que some do armário** por outro caminho.

**Os 152 pedidos saíram com a chave pública**, e isso diz qual caminho foi:
um dos dois que respondem "sem sessão" sem estourar. Sem sessão, o
`supabase-js` manda o pedido com a chave pública, e o banco o recusa como de
quem não entrou: a tela recebe `42501`. Com o estouro, o pedido nem sai.

**E havia um quarto caminho, na abertura, que a prova achou.** O estouro da
sessão vencida era lido como "o Auth não respondeu", e o `App` ia buscar a
sessão no armário. Nos 90 segundos finais o bilhete do armário ainda parecia
em dia, e o painel abria com uma sessão que a biblioteca já dava por morta.
Depois disso, a tela de entrada dizia *"a conferência demorou demais para
responder"*, mandando esperar por um serviço que estava de pé.

### O `App` passou a PERGUNTAR — `vigiaDaSessao.js`

`conferirSessao` responde três coisas, e a terceira é a que evita pôr para
fora quem está trabalhando por causa de um soluço:

| resposta | quando | o que o `App` faz |
|---|---|---|
| **serve** | há bilhete em dia — da biblioteca, ou do armário quando o Auth não responde a tempo | nada |
| **acabou** | "sem sessão" sem erro de rede, ou o estouro de "não há com o que renovar" | tira a sessão do armário e vai para a entrada **com o recado** |
| **talvez** | o tropeço de rede, ou o Auth calado com o bilhete do armário já vencido | só vira "acabou" se durar **2 minutos** |

**Quando ela roda:**

- de minuto em minuto;
- quando a aba volta à frente (`visibilitychange` e `focus`);
- **na hora**, quando uma leitura do painel falha com cara de acesso vencido
  (`anotarFalhaDeLeitura` → `pareceAcessoVencido`). É ali que a pessoa está
  olhando para uma tela que não carrega.

**A leitura que falha não decide nada sozinha.** `42501` também é a coluna sem
permissão de quem entrou (a armadilha nº 3), e um "JWT expired" pode ser o
bilhete renovado no meio do caminho. Ela só pede a conferência — quem decide é
a biblioteca.

**A régua de 19/08 continua valendo:** o Auth é necessário para NASCER uma
sessão, e não para usá-la. Com o Auth calado e o bilhete do armário em dia,
ninguém sai. A régua mora agora num lugar só, `conferirSessao`, para a
abertura e para a conferência de depois.

**A sessão sai do armário SEM REDE** (`esquecerSessaoGuardada`), e não por
`signOut`. Ele pergunta a sessão à biblioteca antes de sair, e essa é
justamente a pergunta que está estourando ou voltando vazia. Depois ainda vai
ao Auth avisar.

### O recado, e quem não o recebe

A tela de entrada diz **"Sua sessão terminou. Entre de novo para continuar."**
(`data-sessao-terminou`). Sem ele, a entrada aparece do nada no meio do
trabalho, e a pessoa não sabe se o sistema caiu ou se foi ela.

**Quem aperta "Sair" não recebe o recado.** A saída pelo botão e a renovação
recusada de vez (a conta desativada, a credencial revogada) emitem o MESMO
`SIGNED_OUT`. O botão marca a saída antes (`marcarSaidaPedida`), e só a outra
leva o recado. A marca vale para UMA saída e é apagada no `finally`. Sem isso,
um "Sair" que não chegasse a avisar calaria o recado da próxima saída que
ninguém pediu.

**O recado não sobrevive a uma recarga:** recarregada, a entrada é a de
sempre.

### E o que estava escrito não vai embora junto

A sessão pode acabar com a pessoa no meio de uma resposta. Os rascunhos
moravam dentro do painel (`rascunhosRef`), e só a troca de conversa os
guardava: o painel que sai de cena levaria junto o que estava na caixa.

Hoje eles moram fora do painel, em `rascunhos.js`, **por pessoa**, e o painel
que sai guarda o que estava escrito na conversa aberta. Entrando de novo, a
pessoa abre a conversa e encontra a resposta onde a deixou. **A nota interna
volta como nota**: voltando como mensagem, um Enter mandaria ao cliente o que
a equipe escreveu para não chegar a ele.

- **Só na memória da aba**, como os rascunhos da ficha: recarregar ainda os
  perde. O caminho de entrar de sempre (o bilhete de uso único) não recarrega
  a página. O da ponte, com o Auth fora do ar, recarrega, e ali o rascunho não
  volta.
- **Por pessoa**: numa máquina dividida, quem entra depois na mesma aba não
  encontra na caixa o que a outra pessoa escreveu para um cliente.
- **A edição em curso não vira rascunho**, nas duas horas — a troca de
  conversa e o painel que sai. A regra de 07/10 tem agora uma escrita só
  (`guardarRascunho`).

### A bancada aprendeu a perder a sessão

Ela só sabia estar entrada ou não. Agora tem:

- `__SESSAO_SUMIU` — "sem sessão", sem erro;
- `__SESSAO_SEM_RENOVACAO` — o estouro de "Auth session missing!";
- `__SESSAO_REDE` — "sem sessão" com erro de rede;
- a margem de 90 segundos da biblioteca para a sessão guardada sem
  `refresh_token` (a da ponte), que estoura como a de verdade;
- `signOut` de verdade (tira do armário e avisa `SIGNED_OUT`), no lugar do
  cano vazio de antes;
- `__SAIDA_DA_BIBLIOTECA()` — a saída que a biblioteca faz sozinha;
- `__ENTRADA_DA_BIBLIOTECA(quem)` — a entrada de novo, na mesma página. O
  `verifyOtp` daqui não troca a tela, e a prova `entrar` conta com isso.

**E duas réguas de tempo, para a prova não esperar minutos:**
`__VIGIA_DA_SESSAO` (de quanto em quanto a conferência roda) e
`__TOLERANCIA_DA_SESSAO` (quanto o "talvez" aguenta). Sem elas, valem os 60
segundos e os 2 minutos.

Prova: `a-sessao-que-acaba`, 64 conferências em onze cenas:

- a sessão da ponte que vence;
- a aba que volta à frente e a janela que volta a ter o foco;
- a leitura que falha, e a que falha com a sessão boa (que não põe ninguém
  para fora);
- o tropeço de rede curto e o longo;
- o Auth calado com o bilhete em dia;
- o "Sair", e a saída que a biblioteca faz sozinha;
- a abertura com a sessão já vencida, e a recarga;
- o que estava escrito voltando: a resposta, e a nota como nota;
- os rascunhos por pessoa, com a conta direto na função (na bancada, quem
  entra é sempre a mesma pessoa).

**22 sabotagens e 22 pegas**, todas limpas, rodadas em cópias e lidas uma a
uma. As da sessão:

- o painel de antes inteiro (16 reprovações — é o relato reproduzido);
- sem a conferência de depois da abertura (11);
- o "talvez" pondo para fora na hora;
- o Auth calado pondo para fora quem tem o bilhete em dia;
- sem a conferência na hora da leitura que falha;
- sem a aba que volta à frente, e sem o foco;
- o recado para quem apertou "Sair", e o "Sair" sem a marca;
- a saída da biblioteca sem o recado;
- o estouro lido como "não respondeu" (7 — o quarto caminho, reproduzido);
- a sessão acabada que não sai do armário, na conferência e na abertura;
- o tropeço de rede virando "acabou";
- o recado sempre.

E as dos rascunhos:

- os rascunhos de volta para dentro do painel;
- o painel que sai sem guardar o que estava na caixa;
- o painel que sai esquecendo que era nota, e a nota guardada como mensagem
  (as duas devolvem a nota na caixa de mensagem ao cliente);
- os rascunhos de todo mundo juntos;
- a edição em curso virando rascunho;
- a caixa vazia sem apagar o rascunho.

## A auditoria de 07/10 — o que uma varredura inteira achou

Pedido do Rodrigo: *"faz um diagnóstico geral em todos os arquivos e todas
as telas … uma auditoria completa"*. Seis leituras em paralelo (o
`Painel.jsx` em três pedaços, os componentes, a ponte e os scripts SQL), e
**cada achado conferido no código antes de mexer** — os que não se
sustentaram ficaram de fora. A lista inteira, com o que foi e o que não foi
feito, está na PR.

**A forma que mais se repetiu é a de sempre:** a armadilha nº 2 (falha
desenhada como ausência) e a corrida da troca de conversa (uma resposta ou
um estado da conversa ANTERIOR pintado na nova). Os consertos principais:

| o que acontecia | agora |
|---|---|
| a lista de conversas que não carregava ficava em "Carregando…" para sempre | o recado diz que falhou, com o código, e a faixa âmbar acende; "Tentar de novo" relê a lista (e as agendadas) |
| uma **edição** armada numa conversa ia, no Enter, para a conversa seguinte (a correção da mensagem de A na fila de B, ou a nota de A reescrita) | a troca de conversa desarma a edição, e o texto dela não vira rascunho |
| o **renomear** aberto em A gravava o nome em B | a troca fecha o renomear |
| a **ficha** fixa pintava o cliente da conversa anterior quando a resposta do Vantoro chegava atrasada, e "Salvar" ligava o contato ao cadastro errado | a ficha é remontada a cada conversa (`key`), e as seções abertas sobrevivem; a pergunta em voo é compartilhada (`perguntarFicha`) |
| `avisar(...)` não existia na ficha — acrescentar um número repetido estourava calado | `onAviso` |
| Esc com o "Já tratei" ou o "Falar por qual telefone" abertos fechava a conversa atrás | os dois entraram na escada do Esc |
| o menu ⋮ do alto abria por cima do próprio botão, e o segundo toque caía em "Marcar todas como lidas" | abre abaixo |
| assuntos do "Já tratei" que não carregavam viravam "Nenhum assunto cadastrado — crie a lista" | a janela diz que não carregou, e relê ao abrir |
| fechar "Departamentos e acessos" com a releitura falhando esvaziava a barra de telefones | só se grava o que veio |
| filtro de atendente e de etiqueta: escolhido e sem resposta, mostravam **tudo** | três estados, e a falha é dita |
| a agenda achava a pessoa pelo nome do cadastro e a tela a escondia por o WhatsApp chamá-la de outro jeito | `contatoCasaComABusca`, pelos mesmos campos do banco |
| "Voltar para a fila" desfazia TODOS os "Já tratei" da conversa e não conferia a gravação | só o último clique (o mesmo `quando`), e a falha é dita |
| "Apagar para todos" marcava como apagada a bolha que ainda estava saindo | só as que vão mesmo ser apagadas |
| a agendada que falhava na hora sumia da conversa aberta | ganha a bolha vermelha na hora (`bolhaDaFilaQueFalhou`, uma escrita só) |
| "esperando" sem desempate no banco: a paginação pulava ou repetia conversas | desempate por `ultima_atividade` e `id`, numa função só (`porOrdem`) |
| a citação procurava 120 mensagens para trás, e não 360 | a trava é um ref e o ponto de partida vem do lote |
| cada tecla na legenda de um anexo invalidava as prévias dos outros | só se libera a prévia que saiu da lista |
| importar um `.txt` antigo puxava a conversa para baixo e zerava as não lidas | só avança, e reconta a espera |
| exportação de celular em inglês (mês/dia) entrava com as datas trocadas | a ordem é decidida pelo arquivo inteiro |
| tabela que falta só era reconhecida por `42P01` — o Supabase de hoje responde `PGRST205` | `semATabela`, em `gravar.js` |
| "7 dias" cobria 8 | `ultimosDias` conta hoje |
| tarefa atrasada não se editava sem trocar a hora | a hora de sempre serve, e vai até o segundo (o lembrete não toca de novo) |
| a palavra da casa só mudava na barra depois de F5 | `palavrasMudaram` |
| entrada sem Vantoro podia girar para sempre | o prazo vale também para o Auth |

**A bancada aprendeu a ordenar por várias colunas.** `.order(a).order(b)`
reordenava pela segunda — o desempate virava a ordem principal. Sem isto o
desempate da fila de espera não teria como ser medido.

**O que não foi feito, e por quê:**
- a reação em grupo e o envio para grupo com `@g.us` (ponte) — depende de
  como a Uazapi responde, e a regra é não supor; fica para medir com um
  grupo de verdade;
- a conversa nova que some da lista se a pessoa troca antes de a ponte
  mandar a primeira mensagem — raro e com saída (a busca);
- a transcrição gravável por quem já edita a mensagem — fechar a coluna
  exigiria refazer as permissões da tabela inteira.

**Duas lições de processo:**
- **o Esc não passa pelo botão de fechar.** Escrevi a cena de "fechar
  Departamentos com a releitura falhando" com Esc, e ela passava sem medir
  nada: quem relê é o botão da tela. Hoje a cena clica no X;
- **a suíte inteira pegou a remontagem da ficha**: no desenvolvimento o
  React monta duas vezes, e as duas perguntavam ao Vantoro antes de a
  primeira resposta ficar guardada — "ir e voltar não consulta de novo"
  reprovou. Daí `perguntarFicha`.

Prova: `a-auditoria-de-07-10`, 27 conferências, **11 sabotagens e 11 pegas**.

## A auditoria de 27/10 (28/10)

Pedido do Rodrigo: *"Faça uma auditoria completa, analise todos os arquivos,
encontre possíveis erros, faça os ajustes necessários, me dê sugestões de
melhorias e revise todo o layout, veja se todas as telas estão responsivas"*.
Sete leituras do código em paralelo (o `Painel.jsx` em três pedaços, os
componentes, a ponte em dois e os scripts SQL), mais uma **varredura das telas
em sete larguras** (1920, 1366, 1280, 1024, 768, 390 e 360). **Cada achado foi
conferido no código ou medido na bancada antes de mexer**; os que não se
sustentaram ficaram de fora. A lista inteira está na PR; aqui fica o que mudou
no painel, e por quê. A da ponte está no CLAUDE.md dela.

### O layout

| o que acontecia | agora |
|---|---|
| **a ficha fixa espremia a conversa** entre 768 e ~1170 pontos — MEDIDO: a 1024 a conversa ficava com 274 pontos e a caixa de escrever com uma letra por linha; a 800, com 48. É o notebook com zoom de 125%, ou a tela dividida ao meio | abaixo de `FICHA_EM_COLUNA_A_PARTIR` (a lista, a barra, a ficha e uma conversa de 420) ela vira uma **gaveta** por cima da conversa (`data-ficha-sobreposta`), aberta pelo mesmo botão e fechada pelo X, pelo Esc ou pela troca de conversa. **A lista continua à vista** — o pedido de 28/09. A preferência guardada não muda |
| sem Vantoro, a conta da largura do cabeçalho descontava os 330 da ficha que não é desenhada, e a fila recolhia no ⋮ à toa | só a coluna desconta, e só com Vantoro |
| o "+ Novo" das Configurações ficava debaixo do X de fechar | o cabeçalho de cada aba guarda o canto do X (`CABECALHO_DA_ABA`) |
| no celular, os três botões de cada assunto do "Já tratei" passavam uns por cima dos outros | a linha quebra, e o nome tem piso — a régua que as etapas do funil já seguiam |
| no celular, os selos da linha do número viravam "sem r…", "for…", "se…" | sem espaço, a **etapa e a tarefa viram ícone** (`selosDoCelularCompactos`: a bolinha da cor da etapa e o sino), com o que dizem no `title` e no `aria-label`; **o responsável continua escrito** — é a pergunta de todo dia. Onde cabe (a 700, por exemplo), continuam escritos |
| a 360, a caixa de busca dizia "Buscar por nome, mensagem, CPF ou proc" | no celular a frase é curta: "Buscar por nome, CPF…" |
| o "Mostrar senha" da entrada tinha 26 pontos, e no celular o toque caía no campo | 40 pontos de alvo, sem a caixa do campo crescer |
| a janela de agendar um anexo saía pela esquerda da tela no celular | no celular ela é centrada, presa à tela |
| a faixa de aviso ("Contato salvo!") ficava por baixo das Mídias e das telas por cima | por cima de todas as camadas |
| **num Chrome com leitor de PDF (o do escritório), o menu de um PDF recebido não abria**: a prévia vinha depois da seta no documento e era pintada por cima dela | a seta tem `zIndex: 1`. O navegador das provas não tem leitor de PDF e não desenhava a prévia — por isso nenhuma prova via. A cena 8b **força o leitor** e mede o que está pintado no centro da seta |

### O que é de uma conversa fica nela

- **o áudio gravado em A aparecia na caixa de B, e "Enviar" mandava para A.**
  A gravação termina na troca de conversa e o áudio fica, como prévia, na
  conversa onde foi gravado (`gravandoConv`, `audioPronto.convId`); gravar um
  novo com um áudio pendente noutra conversa pergunta antes;
- **a etapa do funil do cliente de antes aparecia na conversa seguinte** — a
  resposta atrasada passava pela guarda quando a conversa nova não tinha funil
  (um grupo, um telefone sem departamento). Hoje vale a chave pedida por
  último (`funilPedidoRef`);
- **o Esc no menu do "/" e no de departamentos fechava a CONVERSA**, e não o
  menu;
- **a seleção de mensagens atravessava a troca**: marcadas em A, a barra
  "2 selecionadas" ficava no lugar da caixa de B;
- "Respondendo você mesmo" para mensagem que não era sua (a mandada pelo
  celular, as antigas sem `enviado_por_id`): hoje só quando é você;
- a importação de histórico oferecia telefones que a pessoa não alcança, e os
  desativados.

### O envio e o eco (a prova `a-bolha-que-saiu-nao-fica-vermelha`)

Desde 26/10 a ponte confirma pelo eco do WhatsApp a mensagem que tinha dado
tempo esgotado, às vezes um minuto e meio depois. O painel não acompanhava:
**a bolha vermelha não sumia**, e **o "reenviar" gravava "descartada" por cima
de "enviada"** e mandava de novo — o cliente recebia duas vezes, o caso medido
em 26/10. Hoje o reenviar só aposenta o item que ainda está em erro
(`.eq("status", "erro")`); zero linhas, ele relê e diz o que houve (saiu, um
colega já reenviou, ainda está saindo). **Sem conseguir perguntar** (a rede, o
tempo esgotado), ele não manda: diz que não conferiu, e a bolha continua
vermelha. **A recusa do banco é outra coisa**: ela só alcança a linha que ainda
está em erro, então a mensagem não saiu, e reenviar continua valendo — é o
caso da prova `dispensar-aviso`. E três vizinhos da mesma fila: a
reação, a correção e o "apagar para todos" que falham não viram bolha
(`GESTOS_DA_FILA`), encaminhar sem legenda não manda `texto: null`, e o
"reenviar" virou botão, com alvo de dedo no celular.

**E vários anexos saem na ordem da prévia.** Cada um entrava na fila quando o
arquivo dele terminava de subir: a procuração de 200 KB passava na frente do
vídeo de 20 MB escolhido antes dela. Hoje os arquivos sobem juntos e entram na
fila um atrás do outro (`vez`, a vez do anterior). E a bolha que falhou guarda
o nome do arquivo, em vez de dizer só "Documento".

**E três frases do CLAUDE.md passaram a mentir**, e foram corrigidas: a de "E
os outros dezoito lugares" que dizia que o reenviar ficava sem perguntar, e as
das tabelas do funil e das tarefas, que diziam que no celular a linha escreve
a etapa e a tarefa — sem espaço, hoje ela mostra a bolinha e o sino. A do
responsável continua certa: no celular ele segue escrito.

### O que falhava calado

A armadilha nº 2, com oito roupas novas:

| onde | o que a tela dizia | agora |
|---|---|---|
| os filtros de **grupos**, das **minhas**, das **tarefas** (a segunda ida) e de **quem participou** (a segunda ida) | a lista curta, com cara de todas: três grupos onde há sete | a faixa âmbar diz o que não veio, e o que veio fica |
| a lista de **quem atende o telefone** | o botão do filtro sumia, como se o recurso não existisse | sumir, só sem a função no banco (`semAFuncao`); qualquer outra falha é dita |
| **o "Tentar de novo" da faixa** | não refazia os filtros, nem os departamentos e telefones relidos ao fechar a administração — e essas falhas nunca saíam da faixa | refaz todos (`tentativaDosFiltros`, `lerDepartamentosETelefones`), e a faixa sai quando a leitura dá certo |
| **a aba que não veio** | "Carregando as conversas…" para sempre, debaixo de uma faixa dizendo que não carregou | "Não consegui carregar as conversas desta aba", com o código |
| **o contato que não deu para conferir** | era criado de novo — e, gravado noutra forma do número, nascia o duplicado | nada é gravado, e a faixa diz por quê |
| **a equipe que não carregou** (Atendentes) | "Ninguém com esse nome." com a pesquisa vazia | a falha, com "Tentar de novo"; e a equipe vazia diz "Ninguém na equipe ainda" |
| **Fora do horário que não carregou** | o formulário de um departamento nunca configurado — e "Salvar" gravava isso por cima do que existe | sem saber o que está gravado, não há formulário |
| a lista vazia de **Não lidas, Favoritas ou uma etiqueta** | "Nenhuma conversa ainda" | a frase do que foi pedido |
| a aba **Contatos** das Configurações | "Nenhum contato ainda" numa sessão nova, com 1.432 contatos no banco (contados em 28/10) — só a "Nova conversa" carregava a agenda —, e depois só o que a última busca de lá tinha trazido | carrega a agenda também ali (`agendaNaTela`) |

**E uma frase da tela mentia desde 13/10.** A aba Distribuição dizia que *"o
aviso de mensagem nova não muda: até alguém responder, todo mundo continua
sendo avisado"* — e desde aquele dia ele vai só para quem recebeu a conversa.
Hoje ela diz a regra de agora, com o contrapeso: se ninguém do rodízio puder
receber a conversa, todo mundo é avisado.

### O nome que se vê

- **as conversas que a busca e os filtros trazem de fora da lista vinham sem
  etiqueta** — a leitura das etiquetas só conhecia a lista. Hoje ela lê também
  as de fora (`idsDosExtras`), e vale a última pergunta (`geracaoDasTagsRef`):
  as duas leituras podem sair no mesmo instante, e a mais velha não pode
  apagar o que a mais nova trouxe;
- **a citação e o avatar do alto usavam o nome cru do WhatsApp** ("Deusdete"
  debaixo de um cabeçalho que diz "MARIA DAS GRAÇAS PEREIRA"); hoje o nome da
  casa, como a linha da lista;
- **o nome salvo pela agenda sumia na mensagem seguinte do cliente**: ia só
  para `contatos.nome`, que a ponte regrava com o nome do WhatsApp a cada
  mensagem. Hoje vai também para `nome_zorvin` (`gravarNomeDaAgenda`), que a
  ponte não toca e `nomeDoContato` mostra antes; numa base sem a coluna, ela
  sai do pedido uma vez só.

### A ficha

- **"Só abrir o cadastro, sem acrescentar este número" ligava a conversa a
  ele.** É o "não é ele" — a mãe falando pelo celular do filho —, e ligada a
  conversa dela ganhava o nome do filho e as notas subiam para a ficha dele,
  enquanto a ficha, na abertura seguinte, voltava a dizer que o número não tem
  cadastro. Hoje abre só para ver (`escolher(c, { ligar: false })`), e diz;
- o pré-cadastro criado mostrava a lista de telefones de antes (vazia);
- "conversar por este" colava "55" na frente de dígitos que às vezes já têm o
  55 — hoje `numeroCanonico`;
- **o rascunho da ficha era de quem viesse depois.** Desde 22/10 outra pessoa
  pode entrar na mesma aba quando a sessão acaba, e a ficha dela abria com o
  que a anterior deixou por salvar — senhas do SERASA e do GOV inclusive.
  Hoje os rascunhos da ficha são por pessoa (`quem`), como os da caixa de
  escrever.

### O Painel de números

- **as setas do período esticavam o período**: andavam "N dias menos 1 ms", e
  7 dias viravam 8, 9, 10. Hoje andam N dias de calendário;
- o filtro de atendente escrevia o nome de quem olha sobre os números de outra
  pessoa;
- um erro de DENTRO da função ("column … does not exist") virava "falta uma
  atualização" — hoje a falta é reconhecida pelo código (`semAFuncao`), e o
  resto é dito como erro;
- **um nome começando com "=" virava fórmula na planilha** (o nome do cliente
  é ele quem escreve no WhatsApp). `planilha.js` põe um apóstrofo na frente, e
  número de verdade continua número.

### A bancada fora do pacote

`src/bancada.js` (os dados de mentira, ~35 KB) **entrava no pacote que vai
para o ar**, e era carregado em toda abertura. Hoje o `vite.config.js` troca o
import por `bancada-desligada.js` quando `VITE_BANCADA` não é `1`, e a cena 15
monta o pacote de produção e confere que os dados de mentira não estão nele.

### Quatro lições desta rodada

- **a seta do PDF**: a prova passava num navegador que não desenha o que o
  escritório vê. Quando o defeito depende do navegador, a cena força o mundo
  do escritório;
- **o vigia `provas-que-reprovam` pegou três conferências minhas** — um
  `.every` sem o tamanho, um `.every` sobre uma lista escrita ali e um
  `ok(…, false)` dentro de um `if` — **e reclamou do filtro de cenas**
  (`if (vale("13b"))`). O filtro é legítimo, e por isso o vigia foi ENSINADO,
  e não calado (`olho-nas-provas.mjs`): ele aceita a função que só olha
  `CENAS`, lida do ambiente, e só com o nome da cena escrito ali. E a prova
  reprova quando uma cena pedida em `CENAS` não existe — um erro de digitação
  não pode terminar verde sem ter rodado nada;
- **a prova `tarefas-e-lembretes` foi INVERTIDA, e não apagada**: ela exigia,
  a 390, a tarefa escrita na linha — o que o celular não comporta. Hoje confere
  o sino com o rótulo a 390 e o texto a 700, onde cabe;
- **uma conferência minha usava um contato que só outra prova planta** ("ct-deus"),
  e reprovou dizendo que não achou nada. Cena de prova usa o que a bancada tem
  de sempre, ou planta o seu.

### O que ficou como sugestão

O Encaminhar só lista as conversas da aba aberta; "Passar para" oferece a
equipe inteira (inclusive quem não vê o telefone); a busca da lista recomeça a
cada conversa nova que chega; a releitura da conversa aberta troca a lista
inteira; colar do Excel abre a prévia de anexo; os colegas não veem ao vivo a
edição e a exclusão; a prévia de mídia só olha as 300 mais recentes; no
celular, o canto da figurinha favorita a remove para a equipe toda sem
perguntar; editar uma mensagem apaga o rascunho da caixa; o CEP sem guarda de
ordem; e no celular as tabelas do Painel de números não têm rolagem própria.

Provas: `a-auditoria-de-27-10` (205 conferências; `CENAS=13b,13c` roda só as
pedidas, para as sabotagens) e `a-bolha-que-saiu-nao-fica-vermelha` (100), mais
a conferência nova da prova do CPF (o "Só abrir" não liga). **64 sabotagens e
64 pegas**, todas limpas, rodadas em cópias e lidas uma a uma — 46 na prova da
auditoria e 18 na do envio:

- **o layout:** a ficha sempre em coluna (14 reprovações); a conta da largura
  descontando a ficha sem Vantoro; o "+ Novo" debaixo do X (8); os selos do
  celular nunca compactos (4); a frase longa da busca no celular; o "Mostrar
  senha" pequeno; a janela de agendar fora da tela no celular; o aviso por
  baixo das Mídias; a seta do PDF por baixo da prévia;
- **o que é de uma conversa:** o áudio de outra conversa na caixa; a etapa do
  funil do cliente de antes; o Esc do "/" fechando a conversa; a seleção
  atravessando a troca; o "você mesmo" sempre; a importação com todos os
  telefones; os anexos fora da vez;
- **o envio:** o painel de antes inteiro (33); o aviso "enviada" sem procurar
  a vermelha; a linha de verdade que não substitui a bolha da fila; a vermelha
  que fica sempre na releitura; as vermelhas na mesma passada das que saem; o
  reenviar de antes (9); o reenviar com o `.eq` e sem reler (8); a reenviada
  pela colega, a que ainda está saindo e a sem conexão indo de novo; a recusa
  do banco que deixa de reenviar; a dispensada antes de decidir; os gestos que
  falharam virando bolha, e o que falha na hora sem aviso; encaminhar com o
  texto nulo; a bolha da fila sem o nome do arquivo; o reenviar de volta a ser
  um texto; a linha do envio presa em 15;
- **o que falhava calado:** os grupos, as minhas, a segunda ida das tarefas e
  quem atende, calados; quem atende sem a função acendendo a faixa; o "Tentar
  de novo" sem refazer os filtros (4), as tarefas e os departamentos; a
  releitura que não limpa a faixa; a aba que fica carregando; o contato que
  não conferiu sendo criado; a equipe que falhou virando "ninguém"; Fora do
  horário que falhou virando formulário; o recado das favoritas; a aba
  Contatos sem a agenda; e a frase antiga da Distribuição;
- **o nome que se vê:** as etiquetas só da lista; sem reler pelos extras; a
  citação e o avatar com o nome cru; a agenda gravando só o nome;
- **a ficha:** o "Só abrir" ligando a conversa; o pré-cadastro sem os
  telefones; o "55" colado; o rascunho de todo mundo;
- **o Painel de números:** as setas esticando o período; o rótulo do atendente
  virando o meu; a falta da função pela frase; a planilha com fórmula (4);
- **e a bancada de volta ao pacote.**

## A auditoria de 28/10 — o layout em todas as telas e a revisão inteira

Pedido: *"Pode auditar o zorvin-painel do mesmo jeito"* — o roteiro da
auditoria do Vantoro: ferramentas automáticas, o layout de todas as telas,
uma leitura de todos os arquivos, as dependências, e cada conserto com prova
e sabotagem.

**Como foi feito.**
- **Ferramentas:** build, `npm audit` e um ESLint com as regras de hooks do
  React, rodado de fora do repositório (a casa não tem lint, e não ganhou um).
- **Layout:** uma varredura na bancada abriu **432 estados** — cada botão da
  tela principal e da conversa, cada item do ⋮, cada aba das Configurações e
  de Departamentos — em 375, 768 e 1366px, claro e escuro, medindo rolagem de
  lado, o que sai da tela, texto cortado, alvo de toque, letra de campo no
  celular, contraste e erro de JavaScript.
- **Leitura:** cinco revisões em paralelo (o `Painel.jsx` em três pedaços, os
  componentes, os módulos com o SQL) deram **~60 achados**.
- **Consertos:** quatro frentes, cada uma na sua cópia da branch. Cada achado
  foi **reproduzido por uma prova que reprova antes do conserto**, e cada
  conserto foi sabotado. São **42 provas novas**.

### A junção com a auditoria de 27/10 (#290) — 29/10

Enquanto o CI desta PR rodava, o Rodrigo juntou ao main a **#290**: outra
auditoria, pedida em 27/10, feita em paralelo por outra sessão. Ela consertou
por outro caminho muitos dos mesmos defeitos — a ficha que espremia a
conversa, o que é de uma conversa ficar nela, as falhas caladas, a ficha, o
painel de números, a bancada fora do pacote. Oito arquivos em conflito.

**Como foi junta.** Nos oito arquivos, ficou a versão do main, que é a
aprovada. As 42 provas desta PR viraram o juiz do que faltava: rodadas contra
o main, **14 passaram** (a #290 já cobria, ou não tocava) e **28 reprovaram**.
Cada reprovação foi lida e virou uma de três coisas:
- **o defeito estava lá**: o conserto desta PR voltou, adaptado ao código da
  #290 e sabotado de novo;
- **a #290 escolheu outro desenho de propósito**: a prova passou a pedir o que
  os dois desenhos garantem (está dito no alto de cada uma);
- **a #290 cobria só parte**: voltou só o resto.

Nenhum conserto da #290 foi desfeito. As provas dela (`a-auditoria-de-27-10`,
205 conferências; `a-bolha-que-saiu-nao-fica-vermelha`, 100) passam junto
com as desta PR. A #292 (a prévia do PDF) entrou depois, sem conflito.

**As provas que mudaram de pedido, e por quê:**

| prova | a #290 escolheu | a prova pede agora |
|---|---|---|
| `a-ficha-nao-esmaga-a-conversa` | a ficha das larguras médias é uma gaveta por cima da conversa (`data-ficha-sobreposta`), e não troca de lugar com ela | a ficha sobreposta e a conversa com a mesma largura de antes de abri-la |
| `o-que-e-de-uma-conversa-fica-nela` | gravar em B com o áudio de A esperando PERGUNTA (`window.confirm`) | responde "não" e confere que nada se grava e que a pergunta diz por quê |
| `o-olho-da-senha-cabe-o-dedo` | mínimos de 40 no botão | a simulação do "antes" zera também os mínimos; a margem sai metade de cada lado (`-8px -7px`), e o ícone fica onde estava |
| `a-aba-que-falha-diz-que-falhou` | a aba que não carregou leva a marca `falhou-aba` | a marca dela nas abas; nas Arquivadas, que a #290 não cobria, a falha é medida pela lista filtrada |
| `o-filtro-de-atendentes-nao-some` | com a função falhando, o botão de quem atende some e a faixa âmbar diz a falha (cena 13b dela) | o caminho dela: a falha dita, e o "Tentar de novo" traz o botão e as pessoas |
| `os-filtros-nao-afirmam-ausencia` | a etiqueta vazia diz "com esta etiqueta", sem o nome | a frase dela; e o rodapé das Favoritas e das Não lidas passou a conferir o "+" do teto |

**O que a #290 já cobria, e ficou como ela fez:** a ficha nas larguras
médias (gaveta), a bancada fora do pacote (`bancada-desligada.js`), o
rascunho da ficha por pessoa, os telefones do pré-cadastro, as setas em dias
de calendário, o nome da pessoa no filtro do Painel de números, o Esc do "/"
e dos departamentos, a seleção e o áudio na troca de conversa, a ordem dos
anexos, os gestos que falham (`GESTOS_DA_FILA`), a aba que não carregou
(`falhou-aba`), as faixas de departamentos e telefones
(`lerDepartamentosETelefones`), a agenda na aba Contatos, a conferência do
número que falha, o alvo de 40 do "Mostrar senha" e os selos do celular em
ícone.

**O que esta PR acrescenta ao que a #290 fez:**

| o que acontecia (no main de 29/10) | agora |
|---|---|
| o "não enviado · reenviar" em #e53935: **1,9:1** sobre a bolha verde no escuro; as frases de erro das telas em #c0392b, 3,2:1 no escuro | tokens `erroTexto` e `ambarTexto` nas letras miúdas (4,7 e 5,1); o ícone e a borda continuam com a cor viva |
| os menus dos selos (responsável, etapa, tarefas) e o painel de emojis passavam da borda a 768 (o de tarefas ia até 933px) | `encaixarNaJanela` empurra para dentro ao aparecer |
| a mensagem que o tempo real trazia **durante a carga** da conversa sumia; o eco da própria mensagem também | `chegaramDuranteACarga`, ao lado do `provisoriasQueFicam` da #290 |
| com o relógio aberto, virar a caixa para nota e agendar mandava a **nota ao cliente** | a janela da hora só existe fora da nota e da edição |
| começar a editar apagava o que se escrevia e a citação; a correção recusada se perdia; o segundo Enter mandava duas vezes (era uma sugestão da #290) | a edição guarda e devolve o rascunho; só sai da caixa depois de gravar |
| pelo teclado, o "Enviar" da prévia de anexos de A mandava a B; dois anexos de mesmo nome caíam no mesmo endereço do depósito (com a subida junta da #290, sempre) | a troca fecha a prévia e a confirmação de apagar; `caminhoNoDeposito` |
| a busca na conversa, acima do teto, trazia as 500 mais antigas | as 500 mais recentes |
| "Salvar no Vantoro" apagava o que se digitou durante a gravação | só o que não mudou depois do clique vem do Vantoro |
| Fora do horário: com a configuração falhando, os feriados nem eram lidos; a falha deles virava "Nenhum feriado daqui para a frente" | os feriados valem por si, e a falha deles é dita na seção |
| Painel de números: o ano andava os dias corridos; quem administra e escolhe outra pessoa lia "os seus números"; os rótulos de data cortados no celular | ano civil; "a pessoa escolhida"; o passo dos rótulos acompanha a largura |
| Configurações › Contatos dizia "Nenhum contato ainda" enquanto a agenda vinha | "Lendo a agenda…"; as recargas levam o termo escrito |
| o histórico de atendimento com uma ponta faltando derrubava o painel; o assunto que não carregou aparecia como "removido" | só o par, a falha dita, "assunto não carregado" |
| a importação juntava mensagens iguais no mesmo minuto | a ordem da repetição entra na chave (a primeira mantém a antiga) |
| o pulso de "Estou atendendo" não gravava quem atende | renova a própria marca, toma a vazia ou a vencida — e não a da conversa deixada no meio do pulso (guarda `vivo`) |
| os filtros (minhas, grupos, tarefas, etiqueta, não lidas, favoritas, arquivadas) diziam "nenhuma" com a pergunta no ar ou depois de ela falhar — a faixa da #290 avisava, e a lista logo abaixo afirmava | três desfechos na lista (`perguntasDoFiltro`): procurando, falhou (com o código) e pronto; o teto é dito; tudo pelo `tentativaDosFiltros` da #290 |
| o Encaminhar só listava a aba aberta (sugestão da #290) | procura no banco (`encaminharNoBanco`) |
| a busca da lista se refazia ao abrir uma conversa achada (sugestão da #290) | a busca lê a lista por um espelho, e abrir não a refaz |
| a página pedida antes de uma releitura da página 0 apagava páginas da lista | contador de geração, e 20 linhas de sobra por página |
| entrar nas Arquivadas com a leitura falhando dizia "Nenhuma conversa arquivada." | a falha é dita |
| o ⌄ da linha, Mídias, Arquivadas, a agenda e o Vantoro na Nova conversa, a barra das fixadas, o som e a caixinha de seleção não eram alcançados pelo teclado | botões, e as teclas valem também nos filhos da linha |
| os selos da barra não diziam a falha; o "Tentar de novo" não relia as figurinhas; a conta das Arquivadas ficava presa ao telefone de antes | a falha dita e relida; presa ao telefone certo |
| as linhas de fora do filtro de atendentes piscavam ao abrir uma delas e sumiam quando a releitura falhava; o teto de 500 era calado | só se esvaziam quando a escolha muda; o teto é dito |
| o SQL `dispensar_aviso_de_falha.sql`, rodado hoje, faria todo "Cancelar" de agendada dar 23514 (e reabria a permissão para `anon`); o de 2026-09 desfazia a `zorvin_saude()` da ponte | acrescenta 'descartada' à lista existente, como o 014 da ponte; o outro só cria onde não existe |
| telefones de casos reais em provas e comentários (inclusive o do relato de 28/09) | números de exemplo com as mesmas propriedades |

**O que não foi feito, e por quê:**
- **número estrangeiro com "+"**: o painel e a ponte (`numeroLimpo`) põem o 55
  na frente; consertar um lado só faria os dois divergirem. A prova
  `o-numero-com-zero-na-frente` registra o defeito como está, e reprova se
  só um dos lados mudar;
- **a ponte ignora o `error`** das duas leituras de `/historico/contato` — é do
  outro repositório (a zorvin-bridge#211 não tratou disso);
- **o Vite 5** tem um alerta de segurança do `esbuild` só no servidor de
  desenvolvimento; sair dele é trocar de versão maior;
- **a bancada difere do Postgres** em dois pontos que esconderam casos aqui:
  aplica o `.eq` de uma gravação quando o pedido é montado, e não quando é
  executado; e no `lt` trata o nulo como menor que tudo;
- os telefones de casos reais **continuam no histórico do git**: tirá-los de
  lá é reescrever o histórico, decisão do Rodrigo.

**Quatro lições:**
- **Duas auditorias do mesmo código ao mesmo tempo** custam a segunda junção
  inteira. Antes de começar uma, olhar as PRs abertas e os ramos recentes. Se
  elas se cruzarem, a aprovada fica, e as provas da outra dizem o que falta —
  rodar as provas contra o main foi o que separou, em minutos, os 14 casos já
  cobertos dos 28 que não estavam.
- **O que o build leva não é o que o código usa.** Um `import` estático de
  módulo com efeito no nível de cima entra no pacote mesmo atrás de um
  ternário que nunca o escolhe. As duas auditorias chegaram nisso sozinhas.
- **Toda prova roda em 1360 ou em 390.** O defeito da ficha e o dos menus
  moravam entre as duas larguras, onde nenhuma prova olhava — e o iPad em pé
  mora ali.
- **SQL do painel que a tela manda rodar envelhece.** A ponte refaz as funções
  e as regras nos scripts automáticos dela; um script daqui que faz `create or
  replace` ou apaga regra desfaz o que veio depois. Os dois daqui agora só
  acrescentam ou só criam o que falta.

## Banco de dados (tabelas que o painel lê/escreve)

- `advogados` — lê (id, nome, numero, foto_url) onde `ativo = true`
- `conversas` — lê (com join em `contatos`), atualiza `nao_lidas = 0` ao abrir
- `mensagens` — lê
- `fila_envio` — insere (é assim que envia)

RLS está **ligado** com políticas para o papel `authenticated`. Se uma consulta voltar vazia sem erro, suspeite de RLS antes de qualquer outra coisa.

## Armadilhas já encontradas (não repetir)

1. **RLS**: o painel usa a chave anon e respeita RLS. Ao criar tabela nova, criar a política junto, ou o painel verá vazio sem mensagem de erro.
2. **Erro de leitura engolido** (04/09/2026): `if (error) return;` e `if (!error) setX(...)` faziam a tela desenhar **ausência** no lugar de **falha**. As etiquetas sumiram de todas as conversas do escritório, e as notas internas junto — sem uma palavra na tela. O diagnóstico custou três rodadas para descobrir o que a tela sabia desde o primeiro segundo. Hoje as leituras de etiquetas, notas, respostas rápidas e fila anunciam a falha numa faixa no alto (`data-falha-de-leitura`), com o código do banco. **Ao acrescentar uma leitura nova, trate o `error`** — a prova `a-tela-diz-o-que-nao-carregou` cobre esse contrato.
3. **Política RESTRITIVA que lê outra tabela** (a causa do item acima): existem no banco `zorvin_setor_conversa_tags` e `zorvin_setor_notas`, que conferem `advogados.setor` antes de liberar a linha. Restritiva soma por "e", então **sempre** é avaliada — e, sem permissão na coluna que ela lê, a leitura da tabela inteira morre com `permission denied`. Antes de mexer em permissão de coluna, rode a varredura da parte 3b de `sql/2026-09-a-chave-da-uazapi-fica-guardada.sql` (no repo da ponte).
4. **Duplicação de mensagens enviadas**: já corrigida **na ponte** (ignora eco com `wasSentByApi === true`). Se voltar a duplicar, o problema é lá, não aqui.
5. Chatwoot foi tentado antes e abandonado (estourava a memória do plano free do Render). Não sugerir voltar sem discutir custo.

## Os avisos de que algo parou

A ponte é cheia de proteções que **avisam no log** — e ninguém abre o log. Foi
assim com a linha do escritório que caiu em 19/08 e com o `IMPORT_TOKEN` que
nunca foi criado: a máquina vinha dizendo o que estava errado, para uma tela que
ninguém olhava.

Hoje o painel pergunta `zorvin_saude()` de minuto em minuto e mostra numa faixa
**vermelha** no alto (`data-aviso-de-saude`). A função devolve **contagens**, não
conteúdo: o painel não alcança `eventos_recebidos`, que guarda texto de cliente e
nasceu fechada, e não é por causa de um número que isso muda.

**Duas plateias.** Quem atende vê só o que muda o que ela deve fazer agora —
mensagem que não saiu, linha caída (com o nome do telefone), mensagem de cliente
que não entrou. Quem administra vê também o que se resolve sozinho (a caixa
atrasada). Alarme que não pede ação se aprende a ignorar, e aí o próximo passa
batido junto.

A faixa vermelha e a **âmbar** (`data-falha-de-leitura`) dizem coisas
diferentes: a âmbar é sobre ESTA tela estar incompleta, a vermelha é sobre o
SISTEMA ter parado. As duas moram numa coluna fixa comum — cada uma `fixed` por
si punha uma em cima da outra.

SQL: `sql/2026-09-o-painel-avisa-quando-algo-para.sql`. **Sem a função, tudo como
antes** (aviso no console e nada na tela). Prova:
`o-painel-avisa-quando-algo-para`.

### A linha que voltou não fica caída (29/09)

Relato com foto: a faixa vermelha dizia *"A linha de SAC está desconectada do
WhatsApp. Nada sai por ela até alguém reconectar o aparelho."* — **e o
aparelho já tinha sido reconectado e testado**.

**A frase era falsa, e é por isso que ela saiu; não por incomodar.** O sinal
`linhas_caidas` deduzia "está caída" olhando **só para o passado** — erros de
desconexão nos últimos 30 minutos — e não perguntava nada sobre o presente.
A única saída do aviso era o **relógio**: meia hora de faixa vermelha depois
de o problema ter acabado. O script original já previa isso e escolheu
conviver; a escolha estava errada.

Hoje a linha só conta como caída se **não deu sinal de vida** depois do último
erro — uma mensagem que saiu por ela, ou uma que chegou. A janela de 30
minutos fica como teto.

A conta inteira é do banco, em
`sql/automaticos/007-a-linha-que-voltou-nao-fica-caida.sql` (repo da ponte),
onde estão o raciocínio e as nove cenas conferidas num Postgres de verdade.

### E a faixa FICAVA POR CIMA da tela — que era o estrago maior

Segundo relato do mesmo dia: *"essa mensagem vermelha atrapalha o
funcionamento do sistema. **Não dá para ver o nome dos contatos e outras
funções.**"*

A coluna das duas faixas era `position: fixed` no topo, com `zIndex: 130`.
Ela flutuava **por cima** do painel e comia os primeiros pixels de tudo — a
marca, a linha do departamento, o alto da barra lateral. **Medido pela
sabotagem:** a faixa termina em **33px** e a marca do escritório começava em
**8** — debaixo dela.

**Um aviso que esconde a tela sobre a qual avisa é pior do que aviso nenhum:**
ele não some quando a pessoa precisa trabalhar, e não há gesto que o tire.

Hoje a tela inteira é uma **coluna**: as faixas em cima, e a fila de colunas
(barra, lista, conversa, ficha) ocupando o que sobra com `flex: 1`. O painel
**encolhe** em vez de ser coberto, e o quanto ele encolhe é a altura real das
faixas — sem ninguém medir o DOM nem adivinhar um recuo.

**`minHeight: 0` na fila não é enfeite:** sem ele um filho que rola (a lista
de conversas) empurra a altura do flex para além da tela, e quem some por
baixo é a caixa de escrever — trocaria um defeito por outro.

**A régua da prova é a SOBREPOSIÇÃO**, e não "a faixa apareceu": ela aparecia
antes e continua aparecendo; o que mudou é onde o painel começa. E há o
contraste — **sem faixa nenhuma, o painel começa no pixel zero** —, senão um
conserto que deixasse um recuo permanente no topo passaria igual, comendo tela
em todo dia sem problema nenhum.

Prova: `o-painel-avisa-quando-algo-para`, 28 conferências; a sabotagem que
devolve o `position: fixed` reprova duas delas.

### O tempo real que cai

O canal era assinado com `.subscribe()` **sem retorno de chamada**: o painel
nunca sabia se ele estava de pé. Caindo a conexão, as mensagens novas paravam de
aparecer — e a tela de uma conversa sem mensagem nova é **idêntica** à de uma
conversa em que o cliente não respondeu.

Hoje o estado do canal entra na mesma faixa vermelha, depois de **10 segundos**
de carência (`CARENCIA_TEMPO_REAL_MS`) — um soluço de reconexão não pode fazer a
faixa piscar.

**E a volta RELÊ.** O `postgres_changes` não repete o que passou: o que o banco
publicou durante a queda não chega nunca. Avisar sem reler deixaria a pessoa
informada e a tela errada. A releitura vai por um **espelho** (`reporRef`), e não
pelas dependências do efeito — pôr `carregarMensagens` ali derrubaria o canal a
cada conversa aberta, que é o defeito das "trinta janelas de silêncio" descrito
no próprio arquivo. Prova: `o-tempo-real-que-cai-e-volta`.

#### E por que ele caiu — a quinta roupa da mesma forma

O motivo da queda CHEGAVA e era jogado fora: `subscribe` chama de volta com
**dois** argumentos — `(status, err)` —, e o painel recebia só o primeiro, sem
nem um `console.error`. Três hipóteses minhas sobre a causa caíram, uma atrás
da outra, porque não havia uma única linha de evidência em lugar nenhum.

Hoje o motivo vai para o console, e ele separa defeitos que pedem coisas
opostas:

| o que aparece | o que é |
|---|---|
| `CHANNEL_ERROR: mismatch between server and client bindings…` | o canal **morreu**; só recarregar resolve (ver `ESPERAS_DE_VOLTA`) |
| `CHANNEL_ERROR` seco | quase sempre assinatura recusada — RLS, ou a tabela fora da publicação `supabase_realtime` |
| `TIMED_OUT` / `CLOSED` | é rede |

**Guarda-se o PRIMEIRO, não o último:** cada tentativa do vigia que não pega
gera outro `CHANNEL_ERROR`, e o último seria sempre o do vigia — a causa
soterrada pelas consequências. Prova: `o-tempo-real-diz-o-motivo`.

#### E a faixa vermelha saiu — porque deixou de ser verdade

Pedido do Rodrigo em 28/09, pela **terceira** vez: *"elimine essa mensagem
vermelha, não quero que fique aparecendo, isso já está acontecendo há muito
tempo, resolva logo"*.

**Ela não mentia.** Enquanto aparecia, mensagem nova não chegava sozinha, e
apagá-la teria escondido isso — a armadilha nº 2 outra vez, agora de propósito.
**Mas mantê-la também não resolvia nada:** não há gesto do atendente que
conserte o canal, e alarme que não pede ação se aprende a ignorar. Ficou
semanas de pé sendo lida como decoração vermelha.

**Então o conserto não foi a faixa: foi a CONSEQUÊNCIA.** Com o canal fora, o
painel passou a **reler sozinho de 20 em 20 segundos** (`CADENCIA_DA_PESCA_MS`,
pela mesma `reporRef` que a volta do canal já usava). As mensagens voltam a
chegar sem ninguém clicar — mais devagar, e chegam. Aí a frase *"as mensagens
novas não estão chegando sozinhas"* deixou de ser verdade, e **é por isso que
ela pôde sair: não foi escondida, foi resolvida.**

**Vinte segundos, e não cinco:** cada releitura são ~7 idas a `conversas`, e
oito atendentes a cada cinco segundos seriam onze consultas por segundo num
banco de plano gratuito — trocaríamos um defeito por outro. E ela só começa
**depois da carência**, aproveitando o relógio que já existia: um soluço de
três segundos não merece uma rodada de consultas.

**O que NÃO se perdeu:** o motivo continua indo para o console, e a releitura
que falhar continua acendendo a faixa **âmbar** (`data-falha-de-leitura`), que
é a que diz "esta tela está incompleta". Ninguém fica sem aviso quando há algo
a fazer; some o aviso de um problema que o painel passou a contornar.

**Saíram junto:** `tempoRealCaiu`, `tempoRealDesistiu`, o relógio da promessa e
o "recarregue a página" — não havia mais o que prometer. **O vigia ficou**, e
há uma cena só para isso: o conserto não podia ir embora junto com o alarme.

**As conferências das três provas do tempo real foram INVERTIDAS, e não
apagadas.** Escritas ao contrário, são o que impede a faixa de voltar por
engano numa limpeza futura.

**E a prova nova custou três medidas erradas minhas, todas do mesmo feitio —
medir a coisa próxima em vez da coisa certa:**

1. exigir *"no máximo 2 consultas"* no soluço curto — uma releitura sozinha
   custa ~7, e o número estava errado, não o painel;
2. contar **rodadas** separadas por 200ms — uma releitura se parte em duas com
   o atraso que a bancada simula;
3. contar rodadas separadas por 400ms — no soluço as duas releituras ficam a
   130ms uma da outra, e o agrupamento as via como **uma só**. A sabotagem que
   tirava a carência **passou**.

O que ficou: a prova **mede o custo de uma releitura na hora** e compara com
ele. A régua se ajusta sozinha no dia em que a releitura ficar mais cara.

**Ainda em aberto:** a causa da queda no escritório. Isto não conserta — faz a
próxima ocorrência não custar nada a quem atende, e deixar rastro no console
para quem for consertar.

Prova: `a-pesca-enquanto-o-canal-esta-fora`, 11 conferências, 4 sabotagens e
4 pegas.

**E a carência deixava relógios órfãos** — o `CLOSED` da saída do canal
chegava depois da limpeza e abria uma pesca que ninguém fechava, uma por
troca de aba. Ver "O tempo real que entupia" (20/10).

### A linha desativada não some

A ponte recusa enviar por um telefone desativado (ver o CLAUDE.md dela). Só que
o painel lia `advogados` com `ativo = true`, e a conta não fechava: as conversas
daquela linha ficavam **gravadas e invisíveis**. O cliente que não soube da
mudança continua escrevendo para o número antigo, a mensagem entra no banco, e
ninguém no escritório alcança.

**Duas metades, e as duas importam:**

- `filtrarPermitidos` corta a desativada **para todo mundo, admin incluído**.
  Dessa lista sai tudo o que a tela OFERECE — nova conversa, encaminhar,
  escolher departamento —, e a ponte recusaria o envio: oferecer o gesto seria
  deixar alguém escrever uma resposta inteira para virar bolha vermelha depois.
- `desativadosVisiveis` traz as conversas de volta, numa seção separada da barra,
  **só para quem administra** — foi ele que desativou, e é ele quem vai querer
  saber o que ainda chega ali. Um atendente não tem o que fazer com elas.

Com a conversa aberta, a caixa de escrever dá lugar à explicação
(`data-linha-desativada`), que diz **o que fazer**: responder por outro telefone,
ou reativar. Prova: `a-linha-desativada-nao-some`.

### Armadilha das provas de navegador: `addInitScript` acumula

Cada chamada acrescenta **mais um** script, e todos rodam a cada carregamento.
Uma bandeira ligada num cenário continua valendo nos seguintes, e a prova passa a
reprovar falando de outro assunto. Aconteceu duas vezes. A saída é o ajudante que
abre a página escrever **todas** as bandeiras, sempre — a última escrita vence.

### O anexo que não vem mais

A tela dizia **"indisponível"** para duas coisas opostas: o arquivo que chega em
dois minutos e o que não existe mais. Quem atende esperava, recarregava, esperava
mais — e no segundo caso esperava por nada, sem saber que precisava pedir ao
cliente que mandasse de novo.

`mensagens.midia_erro` é a resposta **definitiva** da Uazapi, gravada pela ponte
(ela só marca quando a resposta não muda com o tempo; falha passageira continua
sendo tentada e não marca nada). Com ela preenchida, a bolha diz **"não veio —
peça para reenviar"**; sem ela, segue "indisponível". O motivo técnico vai no
`title`, não na bolha.

**Imagem e vídeo sem arquivo não desenhavam NADA** — a condição era
`tipo === "imagem" && midia_url`, então a bolha saía vazia e o cliente mandava
uma foto sem a conversa mostrar que ele mandou. Foi consertado junto; a figurinha
já tinha passado por isso, e a imagem ficara de fora.

SQL: `sql/2026-09-o-anexo-que-nao-vem-mais.sql` (no repo da ponte). Prova:
`o-anexo-que-nao-vem-mais`.

### Abrir a conversa baixava arquivos sozinho (29/09)

Relato do Rodrigo, com foto: só de abrir a conversa do CRISTIANO RIBEIRO DE
JESUS o Chrome pedia *"fazer o download de vários arquivos"* e abria o
"Salvar como" com um arquivo chamado `AC89EEE7…`, tipo **planilha CSV** —
sem ninguém ter clicado em nada.

**Era a prévia do documento.** Ela é um `<iframe>` apontando para o anexo, e
**quem decide o que um iframe faz é o tipo que o SERVIDOR diz, e não o nome
do arquivo**. Medido no Chromium, um tipo por vez:

| o servidor diz | o iframe |
|---|---|
| `application/pdf`, `text/plain`, `application/json`, `text/xml` | desenha |
| **`text/csv`** | **baixa** |
| **`application/octet-stream`** | **baixa** |

Os dois que baixam eram justamente os que `comoPrever` aceitava por caminho
próprio: o CSV como "texto", e o PDF que o WhatsApp manda **sem tipo**,
reconhecido só pelo nome `.pdf`. O nome do arquivo salvo é o `messageid`,
porque é esse o endereço no depósito (`recebidos/{messageid}`).

**O conserto separa duas perguntas.** `comoPrever` continua dizendo o que o
arquivo **é**; `oQuadroDesenha` diz o que o iframe vai **fazer** com ele, e só
responde depois de perguntar o tipo ao servidor (`tipoServido`, um `HEAD` —
só o cabeçalho, nunca o arquivo). **Na dúvida, não mostra:** sem resposta, fica
o cartão de sempre, que continua dizendo "PDF" e abrindo com um clique.

**O texto saiu do iframe de vez.** Ele é **lido** (`comecoDoTexto`, só os
primeiros 4 KB, com `Range`) e escrito na bolha. Ler nunca baixa, e um CSV de
extrato com megas não vem inteiro para mostrar dez linhas.

**E a leitura só sai quando a bolha chega perto da tela** — como o
`loading="lazy"` que o iframe já tinha. Uma conversa de cliente antigo tem
dezenas de anexos lá em cima, e perguntar por todos ao abrir seria a conta de
banda de 21/08 com outra roupa.

**Uma terceira porta, que ninguém relatou:** no Chrome dá para escolher
*"baixar PDFs em vez de abrir"*. Aí até o PDF certo baixaria.
`navigator.pdfViewerEnabled` diz qual das duas a pessoa escolheu, e com o
leitor desligado a prévia não nasce.

**A prévia antes de MANDAR tinha uma segunda cópia do mesmo iframe** —
escolher um CSV para mandar a um cliente baixava o arquivo de volta para a
própria máquina. Hoje ela usa o mesmo componente da bolha, em tamanho grande
(`inteira`). Duas cópias foram exatamente o que deixou uma para trás.

**A bancada ganhou os dois anexos do defeito**, servidos em `data:` com o
tipo que o depósito diria: `extrato.csv` (`text/csv`) e `comprovante.pdf`
(`application/octet-stream`). E a prova **espiona os downloads** da página
inteira: ninguém clica em baixar nada, então a lista tem de terminar vazia.
Com o painel de antes, ela pega `download.csv` e o PDF sem tipo — o relato,
reproduzido.

**E a integração contínua me corrigiu na primeira rodada.** Escrevi a
conferência *"o PDF ganha prévia"* e ela passou aqui, num Chrome com leitor de
PDF. Lá ela reprovou: o Playwright usa o `headless_shell`, que **não tem
leitor** (`navigator.pdfViewerEnabled` é `false`) — e o painel, certo, não
montou o iframe. A prova supunha um mundo só. Hoje ela pergunta ao navegador
e confere o lado que valer, e ganhou uma cena que **força** o navegador sem
leitor, para esse mundo ser visto também numa máquina que tem leitor. Nele o
painel de antes baixava **até o PDF certo** (`download.pdf`), um terceiro caso
que o relato nem chegou a mostrar.

Prova: `documentos`, 42 conferências, **6 sabotagens e 6 pegas** (o painel de
antes inteiro, nos dois navegadores; o PDF sem perguntar o tipo; o texto de
volta no iframe; a prévia de mandar com o iframe próprio; o leitor ignorado).

**Mudou em 29/10, na bolha:** o PDF deixou de usar o iframe e ganhou a foto da
primeira página, desenhada pelo pdf.js — com ou sem o leitor do navegador, e
também o PDF servido sem tipo. O que esta seção conserta continua consertado
(nenhum iframe nasce numa bolha). O iframe ficou só na prévia antes de mandar
um anexo. Ver "A prévia do PDF, como a das imagens (29/10)"; as conferências
de `documentos` que pediam o iframe foram invertidas.

## As atualizações do banco — o que a ponte fez ao subir (08/10)

Pedido do Rodrigo: *"pode seguir com os scripts automáticos"* — parar de colar
SQL. Desde 08/10 a ponte aplica sozinha os scripts de `sql/automaticos/` ao
subir (ver "Ligar no escritório" no CLAUDE.md dela). Até ali, a resposta de
"deu certo?" era a última linha que o Rodrigo via no editor da Supabase; agora
ninguém vê o script rodar, e **o log da ponte é o lugar onde este projeto já
perdeu dois avisos**. Então quem administra lê aqui.

**Quem responde é a PONTE** (`GET /scripts/estado`, só para `admin` E `ativo`),
e não o banco: os defeitos mais prováveis — a senha do banco errada, o endereço
errado — acontecem antes de a ponte alcançar o banco, e o banco não conta o que
nunca chegou a ele. A pergunta e as frases moram em `scriptsDoBanco.js`.

**Dois lugares, e o segundo só quando há o que fazer:**

| onde | o quê |
|---|---|
| Departamentos e acessos → **Atualizações do banco** (`AtualizacoesDoBanco.jsx`) | a situação da última subida, a frase e o motivo técnico da ponte, o que entrou nesta subida, o que ficou esperando, e a **conferência de cada script** |
| a faixa vermelha (`data-frase-dos-scripts`), **só para quem administra** | falhou, parou (script editado depois de aplicado), falta a configuração, configuração errada, não falou com o banco, scripts esperando no modo conferir — e a conferência que não fechou **num script desta subida** |

**Uma aba própria, e não uma seção no fim de "Departamentos e telefones":** a
faixa manda a pessoa para cá, e "lá embaixo da terceira lista" não se acha com
pressa. **O botão da faixa abre a administração JÁ nessa aba** (`abaInicial`).
Com a quarta aba, a fileira quebra em linha no celular (`flexWrap`).

**"Em dia", "desligada", "conferindo" e "esperando a outra ponte" não acendem
nada** — alarme que não pede ação se aprende a ignorar. **E a conferência que
não fechou acende só pelo script que entrou nesta subida:** a de antes já foi
dita na subida dela, e acender de novo a cada abertura seria a faixa que nunca
apaga. Na aba ela continua marcada, com o valor pintado (`data-valor-preocupa`:
`false`, "NÃO…", "rode o script…" — a convenção do LEIA-ME da ponte).

**A pergunta que falha não vira "em dia" nem "desligada"** — a armadilha nº 2
com outra roupa. A aba diz que não conseguiu perguntar, e a faixa não acende por
isso (a ponte fora do ar tem os avisos dela). **A ponte de antes desta tela**
(404, ou uma resposta sem `situacao`) é dita como tal, e não como erro.

**Os vinte colados à mão ficam RECOLHIDOS numa linha** ("20 scripts colados à
mão… (001 a 020)"): abertos, empurrariam para fora da vista o script de hoje,
que é o que se veio olhar.

**"Perguntar de novo" atualiza a faixa** (`aoSaber`): sem isso, quem lê "em
dia" na aba continuaria vendo a faixa da pergunta de quinze minutos antes.

**Pergunta-se pouco:** três segundos depois de abrir, depois de quinze em
quinze minutos — e de um em um enquanto a ponte diz que está conferindo ou que
vai tentar de novo. A resposta só muda quando a ponte sobe.

Prova: `as-atualizacoes-do-banco`, 38 conferências, **13 sabotagens e 13
pegas**, todas limpas — rodadas em CÓPIAS do repositório, cada uma com o seu
servidor da bancada (`cacheDir` próprio, porque o `node_modules` ligado por
atalho faria as cópias escreverem no mesmo `.vite`), e o arquivo de verdade
nunca foi tocado. A ponte é fingida pela prova; a de verdade, com um Postgres de
verdade, é provada no repositório dela (seção 51).

### Qual ponte está no ar (15/10)

Em 14/10 três PRs da ponte (os scripts 025, 026 e 027) foram mesclados à tarde,
e a Render **não publicou nenhum**: o serviço não tem um único evento naquele
dia. Na manhã seguinte o Rodrigo viu a lista do "Já tratei" na ordem antiga, e
esta aba dizia **"Em dia"**. Ela estava certa para a ponte que estava no ar,
que não conhecia script nenhum depois do 024 — e nada na tela dizia qual ponte
era essa. **Já tinha acontecido em 20/08.** Resolveu com o Manual Deploy.

**A ponte diz qual versão é** (`versao`, em `GET /scripts/estado`: o commit
inteiro, o ramo, o repositório, o nome do serviço na Render e o último script
da pasta), e **o painel pergunta ao GitHub** quais são as versões mais novas do
ramo dela. Os dois repositórios são públicos. Quem pergunta é o navegador de
quem administra, e não a ponte: o GitHub limita as perguntas sem senha **por
endereço** (60 por hora), e a Render sai para a internet por endereços que
muitos serviços dividem. Do escritório são umas quatro por hora por pessoa que
administra.

**Uma pergunta só, e pequena** (`/repos/{repo}/commits?sha={ramo}&per_page=20`,
sem os arquivos). É nela que se acha a versão no ar, o que veio depois dela, e
quando. A conta mora em `scriptsDoBanco.js` (`conferirNoGitHub`).

**No alto da aba, antes da situação dos scripts**, porque é ela que dá sentido
ao resto: "em dia", embaixo, quer dizer em dia com ESTA ponte. E com versão
nova esperando, a caixa do "Em dia" passa a dizê-lo com todas as letras
(`data-em-dia-com-esta-ponte`) — era a confusão de 15/10, e a foto da primeira
escrita a mostrava de novo: "desatualizada" e, logo abaixo, "Em dia".

| o que se sabe | a aba diz | a faixa |
|---|---|---|
| é a mais nova do ramo | a versão, a data, o título e o selo **a mais nova** | nada |
| há mais nova, mesclada há menos de 20 min | **publicando** — pergunte de novo daqui a pouco | nada |
| há mais nova há mais de 20 min | **desatualizada**, as que faltam e como publicar | acende, para quem administra |
| mais velha que as 20 olhadas | **desatualizada** | acende |
| o GitHub não respondeu | a versão no ar e "não consegui conferir", **sem selo** | nada |
| a ponte não diz a versão | "é de antes desta linha existir" | nada |
| a ponte fora da Render | até qual atualização ela conhece | nada |

**Os 20 minutos contam da PRIMEIRA versão que falta**, e não da mais nova. Com
duas entregas seguidas, a segunda recém-mesclada esconderia a primeira, que já
devia estar no ar. E antes dos 20 minutos, estar atrás do GitHub é o normal de
toda entrega: acender ali seria o alarme que se aprende a ignorar.

**A hora é a do merge** (`committer`), e não a de quem escreveu (`author`), que
pode ser dias antes.

**O GitHub que não responde não vira "a mais nova"** — a armadilha nº 2 com
outra roupa. E não apaga o que já se sabia (`manterOQueSeSabia`): a faixa que
acendeu por uma ponte desatualizada continua acesa se a pergunta seguinte ao
GitHub falhar, **desde que seja a mesma ponte**. Trocou o commit, publicou, e o
que se sabia era da outra.

**A frase de publicar diz o nome do serviço** (`RENDER_SERVICE_NAME`), e o link
de cada versão usa o repositório que a ponte disse: escrito aqui, um comprador
com o repositório dele cairia no do escritório.

**A função que desce para a aba é estável** (`saberDosScripts`, num
`useCallback`). A aba pergunta de novo sempre que ela muda; feita de novo a
cada desenho, cada resposta redesenharia o painel e puxaria a pergunta
seguinte — à ponte e ao GitHub, sem parar. A prova tem uma conferência para
isso, e ela conta **três** perguntas ao abrir, e não duas: no desenvolvimento o
React monta a aba duas vezes. **Medido na sabotagem que a desfaz: 131
perguntas à ponte e 131 ao GitHub em poucos segundos**, e subindo.

**E a prova envelheceu a própria cena, na primeira escrita.** As horas dos
commits de mentira saíam do relógio do começo da prova; a cena do "mesclada há
cinco minutos" roda minutos depois, e leu "há 7 minutos". Hoje cada commit de
mentira marca a hora no relógio de quando é criado.

**Fica de fora, e é decisão:** a versão do próprio PAINEL. Ela separaria "a
Render não publicou o painel" de "o navegador está com o painel velho
guardado" (o Ctrl+Shift+R), mas são dois diagnósticos diferentes, e o de 14/10
foi na ponte.

Prova: `as-atualizacoes-do-banco`, agora com 86 conferências — o GitHub também
é fingido pela prova. **23 sabotagens e 23 pegas**, todas limpas, rodadas em
cópias, cada uma lida, e não só contada. Entre elas: o GitHub que falha virando
"a mais nova"; a conta pela versão mais nova, e não pela primeira que falta; a
hora do autor; o painel perguntando sem a versão da ponte; o aviso guardado de
uma ponte que já foi trocada; a função que desce para a aba refeita a cada
desenho; e o "Em dia" sem dizer com quem. A ponte que diz a versão é provada no repositório dela (seção 20).

## Pendências / próximos passos

- ~~Mídias em alta resolução~~ e ~~enviar anexos pelo painel~~ — **as duas foram
  feitas**, e esta lista ficou meses dizendo o contrário. Isso tem custo: em
  11/09 uma sessão leu a lista em vez do código e recomendou refazer o que já
  estava pronto. **Ao terminar algo daqui, risque na mesma entrega.**
  - Enviar: `enviarArquivo` cobre imagem, vídeo, áudio, documento e figurinha,
    com prévia local; o microfone grava por `MediaRecorder` (ogg/opus, webm de
    reserva). Vai para `fila_envio` e a ponte envia por `/send/media`.
  - Receber: a ponte baixa pela Uazapi e guarda no Storage (`anexos`). **Em
    aberto, e é empírico**: neste servidor as três rotas de download
    responderam 405 ao POST (medido em 11/09); as tentativas por GET entraram
    depois e ainda não foram confirmadas com anexo de verdade.
- Ícones da barra lateral (telefone, engrenagem) ainda são decorativos.
- **E-mails (Gmail)**: fase futura, fora do escopo atual.

## Preferências de design já acordadas

- Visual o mais parecido possível com o **WhatsApp Web** (cores, bolhas, layout) — a equipe já conhece.
- Modo claro e escuro, alternável.
- Textos da interface em português.

## As provas rodavam duas vezes, e a franquia acabou

**MEDIDO em 28/09**, com a página de cobrança do GitHub aberta: **2.000 de
2.000 minutos usados**. E o efeito não foi um aviso — foi as provas **pararem
de rodar nos dois repositórios desde 25/09**, com os trabalhos falhando em
5 segundos, **sem log e sem passo nenhum**. Cara de defeito de código, e eu
cheguei a procurar defeito no código.

A conta que estourou:

| | tempo |
|---|---|
| painel, na PR | ~29 min |
| painel, **de novo** depois do merge | ~29 min |
| ponte, na PR | ~7 min |
| ponte, **de novo** depois do merge | ~7 min |
| **por entrega** | **~72 min** → 28 entregas/mês |

**A rodada do `push: main` saiu.** Ela existia por uma razão verdadeira — duas
PRs verdes separadas podem se somar numa `main` vermelha —, mas testava de
novo, minutos depois, o mesmo código que a PR tinha acabado de aprovar. E uma
proteção que se desliga sozinha por falta de minutos protege menos do que uma
que roda. Agora são ~36 min por entrega, ou ~55 entregas.

**O risco que ela cobria não ficou descoberto.** Entrou uma **rodada semanal**
(segunda de manhã) mais o disparo à mão, e ela pega o que a rodada de PR nunca
pegaria: uma versão nova de dependência quebrando a `main` parada — o
`package-lock.json` está no `.gitignore`, então `npm install` traz o que
houver no dia. Custa ~36 min/mês contra os ~1.000 que o `push` custava.

**A lição maior é a de sempre nesta casa, com outra roupa:** o alarme ficou
três dias desligado e ninguém soube. Ao mexer em qualquer coisa que AVISA,
pergunte quanto ela custa para continuar de pé — e o que se vê no dia em que
ela parar.

### E no mesmo dia o teto de 30 minutos matou a suíte inteira

O `timeout-minutes` da rodada estava em 30, com o comentário *"folga com
sobra"*. **Medido em 28/09:** a última rodada verde levou **28min41s** — 79
segundos de folga, e não sobra nenhuma. A entrega seguinte (uma prova nova
mais duas que cresceram) foi cortada aos **29min43s**, no meio da
`selos-em-rajada` — que é a **última** da suíte, porque `rodar.mjs` agrupa
por servidor (dev, sem-vantoro, producao) e não pelo alfabeto puro. Ela foi
cortada a segundos do fim. **Eu li errado da primeira vez** e escrevi aqui que
faltavam cinco provas: ordenei os nomes no alfabeto sem olhar como o corredor
agrupa.

**E o corte é o pior desfecho que existe aqui:** a conta paga os 30 minutos
inteiros e não responde nada. Não é economia — é gastar sem comprar. Pior, o
X vermelho por relógio é igual ao X vermelho por defeito de código, que é
exatamente o sintoma de 25/09 outra vez.

O teto foi para **45** e a rodada seguinte fechou em ~30 min; o comentário
diz o número medido em vez de um adjetivo. **Em 07/10 subiu para 60**: a
rodada do relatório do funil levou ~43 min, a dois do teto, e a auditoria
trouxe mais uma prova. **O teto não muda o que a rodada consome** — ela custa o tempo que a
suíte leva; ele só decide quando uma prova TRAVADA é derrubada. **Ao
acrescentar prova, olhe quanto a suíte já leva.**

**Medido em 13/10:** a rodada verde da PR da distribuição levou **49min41s** no
passo das provas. A prova do aviso do responsável acrescenta ~1 min (68 s aqui,
com o servidor), e a folga cai para **~9 min**, menos do que os ~15 que o teto
vinha guardando. Subir de novo é decisão do Rodrigo, como foi a de 07/10.

**E ele decidiu no mesmo dia: o teto foi para 75.** A rodada da PR do aviso
fechou em **50min59s** no passo das provas, confirmando a conta. Numa PR
própria, e não junto com a da cópia que estava rodando: cada pedido vai numa
PR nova, e empurrar ali teria cancelado a rodada em andamento
(`cancel-in-progress`).

**Medido em 22/10: a folga voltou a encolher.** As rodadas verdes do #281, do
#283 e do #282 levaram **65, 66 e 67 minutos** do começo ao fim, contra 56 a
58 entre 15 e 19/10: a suíte cresceu uns 10 minutos numa semana. A prova da
sessão que acaba soma uns 2, e a folga para o teto de 75 cai para uns 6.
**Subir de novo é decisão do Rodrigo**, e ficou perguntado a ele.

**E ele decidiu no mesmo dia: o teto foi para 90.** A rodada do #284, já com
a prova da sessão, levou **68min11s**, confirmando a conta. Numa PR própria,
como em 13/10.

**E a franquia de minutos deixou de ser o risco.** Os dois repositórios são
públicos, e o GitHub não cobra os minutos de rodada em repositório público. O
que corta uma rodada agora é só o teto.

### E as provas passaram a rodar em três máquinas (23/10)

Pedido do Rodrigo, logo depois do teto de 90: *"Pode dividir as provas em três
computadores"*. Numa máquina só, a rodada do #285 levou **67min37s** no passo
das provas. Agora são três máquinas ao mesmo tempo, cada uma com uma parte, e a
espera é a da parte mais lenta: **uns 23 minutos pela conta** (22,5 de provas,
mais menos de um minuto para instalar tudo).

**Quem divide é `testes/rodar.mjs`**, com `PROVAS_PARTES` e `PROVAS_PARTE`.
Sem as duas variáveis, ele roda tudo, como sempre. `PROVAS_PARTES=3 node
testes/rodar.mjs --listar` mostra as partes sem rodar nada; com
`PROVAS_PARTE` junto, mostra o que aquela máquina rodaria.

**A divisão é pelo TEMPO de cada prova**, guardado em
`testes/tempos-das-provas.json`. A mais demorada vai primeiro, sempre para a
parte com menos tempo até ali. Com os tempos do #285:

| como dividir | as três partes | a espera |
|---|---|---|
| uma a uma, pelo alfabeto | 20,6 · 19,6 · 27,3 min | 27,3 |
| **pelo tempo** | 22,5 · 22,5 · 22,5 min | **22,5** |

**A tabela não é uma lista de provas**, e é isso que a deixa fora da armadilha
que o comentário do `rodar.mjs` conta (a prova esquecida numa lista escrita à
mão não rodava). Quem diz o que roda continua sendo a pasta:

- a prova nova, ainda sem tempo na tabela, roda com o tempo do meio (a
  mediana);
- a que saiu da pasta e ficou na tabela é ignorada;
- **tabela velha só desequilibra as partes**, e nunca deixa uma prova de fora.

**As máquinas não conversam.** Cada uma faz a conta inteira, sozinha, e roda a
sua parte. A conta só depende da pasta e da tabela, que são as mesmas no mesmo
commit, e todo empate é desfeito pelo nome. Antes de rodar, ela confere que
toda prova caiu numa parte só.

**O que não se entende, recusa** (código 2, com a frase): a parte sem o total,
um número fora da faixa, a variável que chega VAZIA, a parte junto com nome de
prova, a parte sem prova nenhuma, a tabela que não abre ou tem um tempo que não
é número. Uma parte mal configurada que rodasse tudo deixaria a rodada três
vezes mais lenta; uma que não rodasse nada ficaria verde.

**No GitHub (`provas.yml`):**

- **qual parte é cada máquina vem de `strategy.job-index`**, e não dos números
  da matriz. O `job-index` é sempre 0, 1, 2, sem pular nem repetir: uma matriz
  escrita `[1, 1, 3]` poria duas máquinas na parte 1 e nenhuma na 2. E a conta
  só é feita depois de conferir que o número veio: no shell, `$(( + 1))` vale
  1;
- **`fail-fast: false`**: uma parte que reprova não cancela as outras, e a
  rodada mostra todas as provas vermelhas de uma vez;
- **a verificação "Provas do painel" continua existindo, com o mesmo nome**,
  agora juntando as três partes. Uma regra do repositório que exija as provas
  procura por este nome (daqui não dá para ver se há uma: a leitura dá 403);
- **ela roda com `always()`, e não com `!cancelled()`**: para o GitHub, uma
  verificação PULADA conta como aprovada, e numa rodada cancelada a PR ficaria
  verde sem as provas terem terminado;
- **o teto de 90 é por máquina**, e ficou. Baixá-lo é decisão do Rodrigo.

**Refazer a tabela:** cada parte termina com a linha *"Tempos desta parte, em
segundos"*, seguida de um JSON. Os três JSONs de uma rodada, juntos, são a
tabela inteira. E eles se leem daqui: o `get_job_logs` devolve no máximo as
**últimas 5000 linhas**, e o log de uma parte tem um terço das ~6000 de antes.

**Foi esse corte que deixou dez provas sem tempo.** A rodada de uma máquina só
tinha 5965 linhas, e as 965 do começo não vieram. Essas dez foram medidas aqui
e escaladas para a soma que o log mostrava (7min18s, do começo do passo até a
11ª prova). A máquina da sessão tem quase a velocidade da do GitHub: 17,9 s
contra 17,3 na mesma prova.

Prova: `as-provas-em-partes`, 40 conferências. Ela chama o próprio `rodar.mjs`,
**sempre com `--listar`**, e confere as partes, cada máquina, as recusas, a
tabela velha e as três linhas do GitHub. **15 sabotagens, 14 pegas e uma que
vaza com razão**, todas rodadas em cópias e lidas uma a uma:

- cada máquina rodando tudo;
- a parte errada (uma a mais);
- uma a uma pelo alfabeto;
- a variável vazia valendo como não ter vindo;
- sem conferir a parte que passa do total;
- a prova sem tempo ficando de fora;
- o empate decidido na sorte;
- a máquina rodando na ordem da conta;
- `--listar` com a parte rodando de verdade;
- o juntador com `!cancelled()`;
- sem `fail-fast: false`;
- a parte tirada da matriz;
- sem recusar a parte vazia;
- sem conferir os valores da tabela;
- **e a que vaza:** tirar a conferência de dentro do `rodar.mjs` (toda prova
  numa parte só). Com a divisão certa, ela não tem o que pegar. Ela é a
  segunda guarda, e a prova confere o resultado: tirada junto com a divisão
  certa (a sabotagem da prova sem tempo), a prova pega.

**A sabotagem do `--listar` que roda de verdade travou em vez de reprovar, e
ensinou duas coisas.** A prova ocupa a porta da bancada quando roda sozinha,
para uma chamada que passe do `--listar` parar ali ("Já tem alguma coisa
respondendo…") em vez de subir servidor. Mas ela chamava com `spawnSync`, que
para o próprio processo enquanto espera: a porta ocupada não respondia, e a
chamada ficou esperando até o fim do prazo. Hoje a chamada é assíncrona, e a
sabotagem é pega em segundos. E a chamada esperando deixou um processo de pé
depois de a cópia ser apagada. **Depois de uma rodada de sabotagens, confira
com `ps` que nada ficou rodando.**

## Fluxo de trabalho — PRs (REGRA IMPORTANTE do Rodrigo)

- **Cada entrega/pedido deve ir numa PR NOVA.** Nunca reutilizar nem estender uma PR já mesclada.
- O Rodrigo faz o merge e, na rodada seguinte, quer **sempre uma PR nova** (não empilhar em cima da anterior).
- Fluxo por rodada: recomeçar a branch a partir da `main` mais recente
  (`git fetch origin main && git checkout -B <branch> origin/main`), aplicar a mudança,
  commit, push e **abrir uma PR nova**.
- Passo a passo (SQL, merge, etc.) vai **no chat**, não na descrição da PR — o Rodrigo não lê a descrição para instruções de setup.
- **O SQL pelo conector do Supabase roda sem pedir permissão a ele** — dito em
  26/10: *"Sempre que for para executar o SQL, não precisa me pedir permissão,
  pode sempre fazer."* O que isso não muda: **mudança de estrutura** (tabela,
  coluna, regra) continua indo por `sql/automaticos/`, no repo da ponte, que é
  o que mantém o banco e o código dizendo a mesma coisa; **correção de dados**
  se faz olhando antes o que vai mudar e contando a ele depois o que mudou; e
  a consulta é **pequena, uma pergunta de cada vez** — a pesada atrasa o
  webhook do escritório. Ver "Mandar SQL para o Rodrigo", no CLAUDE.md da
  ponte.
