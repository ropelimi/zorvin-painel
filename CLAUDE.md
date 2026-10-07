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

Build: `npm install && npm run build` · Publish directory: `dist`

**A PUBLICAÇÃO É AUTOMÁTICA.** A Render republica o site sozinha quando a
`main` recebe o merge — não há passo manual, e dizer ao Rodrigo para ir em
"Manual Deploy → Deploy latest commit" é mandá-lo fazer o que já foi feito.
Dito por ele em 25/09, depois de quatro entregas seguidas terminarem com esse
recado. Mesclou, está no ar; o que resta a pedir, quando faz diferença, é o
**Ctrl+Shift+R** — o navegador pode estar com a versão velha em cache.

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

**Uma seção própria, ABERTA, logo depois da identificação.** É onde o
escritório escreve o que não cabe em campo nenhum, e observação que ninguém
vê não serve de aviso — uma seção fechada no fim da ficha seria o mesmo que
não ter trazido o campo.

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
já é sanfonada como a do DataCrazy (Identificação, Endereço, Acessos, Origem);
apertar as linhas em rótulo-e-valor na mesma linha foi deixado para depois de
o Rodrigo ver a coluna fixa na tela — em vez de eu adivinhar o que "parecido
com o DataCrazy" quer dizer por dentro.

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

### As três regras

| Situação | Avisa? | Por quê |
|---|---|---|
| Eu já respondi nessa conversa | **sim**, em qualquer telefone | é o pedido |
| Outra pessoa atende | não | aviso que não pede ação de quem lê se aprende a ignorar, e aí o próximo passa batido junto |
| **Ninguém atendeu ainda** | **sim, todo mundo** | é a primeira mensagem de um lead: sem dono, e sem aviso ela fica sem resposta |

A terceira é o **contrapeso**, decidida pelo Rodrigo: "só as minhas" ao pé da
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

### A transcrição, ao clicar (05/10)

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

**Dois lugares ficam sem perguntar, de propósito:**

- o `fila_envio` do **reenviar** — o `guardarDispensado` local já resolve o caso
  de quem clicou, e uma faixa ali confundiria com a mensagem NOVA ter falhado,
  que é o que a pessoa está olhando. O botão "Dispensar este aviso" diz a recusa
  inteira, com código e arquivo;
- o `insert` do **histórico de alterações**, que é extra por desenho e não pode
  derrubar a ação que o gerou.

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

Relato do Rodrigo em 28/09: ele acrescentou `(71) 99259-0325` na ficha de um
cliente que já tinha `(71) 9259-0325`, o número novo apareceu na lista com o
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
(71) 9259-0325 — no WhatsApp o nono dígito não muda a conta"*. Acrescentar uma
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
| no celular | a linha só diz a etapa; trocar é pelo ⋮ ("Etapa no funil") |
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
| **criar e ver as da conversa** | na linha do número, depois da etapa: o selo diz a PRÓXIMA (vermelho atrasada, âmbar hoje) ou oferece **"Lembrar"**; no celular, pelo ⋮ |
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

## Fluxo de trabalho — PRs (REGRA IMPORTANTE do Rodrigo)

- **Cada entrega/pedido deve ir numa PR NOVA.** Nunca reutilizar nem estender uma PR já mesclada.
- O Rodrigo faz o merge e, na rodada seguinte, quer **sempre uma PR nova** (não empilhar em cima da anterior).
- Fluxo por rodada: recomeçar a branch a partir da `main` mais recente
  (`git fetch origin main && git checkout -B <branch> origin/main`), aplicar a mudança,
  commit, push e **abrir uma PR nova**.
- Passo a passo (SQL, merge, etc.) vai **no chat**, não na descrição da PR — o Rodrigo não lê a descrição para instruções de setup.
