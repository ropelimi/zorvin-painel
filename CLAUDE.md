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

## Fluxo de trabalho — PRs (REGRA IMPORTANTE do Rodrigo)

- **Cada entrega/pedido deve ir numa PR NOVA.** Nunca reutilizar nem estender uma PR já mesclada.
- O Rodrigo faz o merge e, na rodada seguinte, quer **sempre uma PR nova** (não empilhar em cima da anterior).
- Fluxo por rodada: recomeçar a branch a partir da `main` mais recente
  (`git fetch origin main && git checkout -B <branch> origin/main`), aplicar a mudança,
  commit, push e **abrir uma PR nova**.
- Passo a passo (SQL, merge, etc.) vai **no chat**, não na descrição da PR — o Rodrigo não lê a descrição para instruções de setup.
