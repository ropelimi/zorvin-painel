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

**A lista encolheu de 380 para 320px.** Os 380 foram medidos em 16/09, quando a
tela tinha DUAS colunas; com três, a conversa tinha caído para ~590px a 1360.
320 é o menor valor que ainda não corta nada na coluna — a marca, o nome do
telefone, o nome do cliente e a prévia —, e está num lugar só
(`LARGURA_DA_LISTA`), porque a prova mede este número.

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
entrou aqui.

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

### A linha desativada não some### A linha desativada não some

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

## Fluxo de trabalho — PRs (REGRA IMPORTANTE do Rodrigo)

- **Cada entrega/pedido deve ir numa PR NOVA.** Nunca reutilizar nem estender uma PR já mesclada.
- O Rodrigo faz o merge e, na rodada seguinte, quer **sempre uma PR nova** (não empilhar em cima da anterior).
- Fluxo por rodada: recomeçar a branch a partir da `main` mais recente
  (`git fetch origin main && git checkout -B <branch> origin/main`), aplicar a mudança,
  commit, push e **abrir uma PR nova**.
- Passo a passo (SQL, merge, etc.) vai **no chat**, não na descrição da PR — o Rodrigo não lê a descrição para instruções de setup.
