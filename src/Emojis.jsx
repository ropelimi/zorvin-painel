// ============================================================
//  O PAINEL DE EMOJIS
//
//  Existe em arquivo próprio por dois motivos. O primeiro é tamanho: são 800
//  emojis com os nomes para busca, e isso dentro do Painel.jsx tornaria o
//  arquivo pior de ler para todo o resto. O segundo é que ele é usado em DOIS
//  lugares — a caixa de mensagem e a reação numa bolha — e duas cópias
//  divergiriam na primeira vez que alguém acrescentasse um emoji em uma delas.
//
//  O catálogo é gerado a partir do próprio Unicode, e não digitado à mão. Cada
//  emoji vem com o nome oficial (em inglês) para a busca, mais sinônimos em
//  português nos que a equipe realmente procura: "coracao", "obrigado",
//  "prazo", "justica". Sem esses sinônimos, procurar "acordo" não acharia o
//  aperto de mãos, que em Unicode se chama HANDSHAKE.
//
//  Os RECENTES ficam no navegador de quem usa (localStorage). É a primeira
//  aba de propósito: quem manda emoji manda quase sempre os mesmos cinco, e
//  fazer essa pessoa procurar de novo a cada mensagem é o oposto de ajudar.
// ============================================================
import React, { useState, useMemo } from "react";
import { Search, Clock } from "lucide-react";

export const CATALOGO = [{"chave":"rostos","rotulo":"Smileys e pessoas","itens":[["😀","grinning face sorriso feliz"],["😁","grinning face with smiling eyes"],["😂","face with tears of joy chorando rindo risada"],["😃","smiling face with open mouth"],["😄","smiling face with open mouth and smiling eyes"],["😅","smiling face with open mouth and cold sweat"],["😆","smiling face with open mouth and tightly closed eyes"],["😇","smiling face with halo"],["😈","smiling face with horns"],["😉","winking face"],["😊","smiling face with smiling eyes feliz sorriso"],["😋","face savouring delicious food"],["😌","relieved face"],["😍","smiling face with heart shaped eyes apaixonado amor coracao"],["😎","smiling face with sunglasses"],["😏","smirking face"],["😐","neutral face"],["😑","expressionless face"],["😒","unamused face"],["😓","face with cold sweat"],["😔","pensive face"],["😕","confused face"],["😖","confounded face"],["😗","kissing face"],["😘","face throwing a kiss beijo"],["😙","kissing face with smiling eyes"],["😚","kissing face with closed eyes"],["😛","face with stuck out tongue"],["😜","face with stuck out tongue and winking eye"],["😝","face with stuck out tongue and tightly closed eyes"],["😞","disappointed face"],["😟","worried face"],["😠","angry face"],["😡","pouting face raiva bravo"],["😢","crying face triste choro"],["😣","persevering face"],["😤","face with look of triumph"],["😥","disappointed but relieved face"],["😦","frowning face with open mouth"],["😧","anguished face"],["😨","fearful face"],["😩","weary face"],["😪","sleepy face"],["😫","tired face"],["😬","grimacing face"],["😭","loudly crying face chorando muito triste"],["😮","face with open mouth surpreso uau"],["😯","hushed face"],["😰","face with open mouth and cold sweat"],["😱","face screaming in fear"],["😲","astonished face"],["😳","flushed face"],["😴","sleeping face"],["😵","dizzy face"],["😶","face without mouth"],["😷","face with medical mask"],["😸","grinning cat face with smiling eyes"],["😹","cat face with tears of joy"],["😺","smiling cat face with open mouth"],["😻","smiling cat face with heart shaped eyes"],["😼","cat face with wry smile"],["😽","kissing cat face with closed eyes"],["😾","pouting cat face"],["😿","crying cat face"],["🙀","weary cat face"],["🙁","slightly frowning face"],["🙂","slightly smiling face"],["🙃","upside down face"],["🙄","face with rolling eyes"],["🙅","face with no good gesture"],["🙆","face with ok gesture"],["🙇","person bowing deeply"],["🙈","see no evil monkey"],["🙉","hear no evil monkey"],["🙊","speak no evil monkey"],["🙋","happy person raising one hand"],["🙌","person raising both hands in celebration"],["🙍","person frowning"],["🙎","person with pouting face"],["🙏","person with folded hands obrigado por favor reza"],["🤐","zipper mouth face"],["🤑","money mouth face"],["🤒","face with thermometer"],["🤓","nerd face"],["🤔","thinking face pensando duvida"],["🤕","face with head bandage"],["🤖","robot face"],["🤗","hugging face"],["🤘","sign of the horns"],["🤙","call me hand"],["🤚","raised back of hand"],["🤛","left facing fist"],["🤜","right facing fist"],["🤝","handshake acordo aperto de maos"],["🤞","hand with index and middle fingers crossed"],["🤟","i love you hand sign"],["🤠","face with cowboy hat"],["🤡","clown face"],["🤢","nauseated face"],["🤣","rolling on the floor laughing rolando rindo"],["🤤","drooling face"],["🤥","lying face"],["🤦","face palm"],["🤧","sneezing face"],["🤨","face with one eyebrow raised"],["🤩","grinning face with star eyes"],["🤪","grinning face with one large and one small eye"],["🤫","face with finger covering closed lips"],["🤬","serious face with symbols covering mouth"],["🤭","smiling face with smiling eyes and hand covering mouth"],["🤮","face with open mouth vomiting"],["🤯","shocked face with exploding head"],["🥰","smiling face with smiling eyes and three hearts"],["🥱","yawning face"],["🥲","smiling face with tear"],["🥳","face with party horn and party hat comemorar festa"],["🥴","face with uneven eyes and wavy mouth"],["🥵","overheated face"],["🥶","freezing face"],["🥷","ninja"],["🥸","disguised face"],["🥹","face holding back tears"],["🥺","face with pleading eyes"],["🧐","face with monocle"],["🧑","adult"],["🧒","child"],["🧓","older adult"],["🧔","bearded person"],["🧕","person with headscarf"]]},{"chave":"gestos","rotulo":"Gestos e corpo","itens":[["👀","eyes"],["👁","eye"],["👂","ear"],["👃","nose"],["👄","mouth"],["👅","tongue"],["👆","white up pointing backhand index"],["👇","white down pointing backhand index"],["👈","white left pointing backhand index"],["👉","white right pointing backhand index"],["👊","fisted hand sign"],["👋","waving hand sign oi tchau ola"],["👌","ok hand sign ok otimo"],["👍","thumbs up sign joia positivo certo ok curtir"],["👎","thumbs down sign negativo ruim"],["👏","clapping hands sign palmas parabens"],["👐","open hands sign"],["🤘","sign of the horns"],["🤙","call me hand"],["🤚","raised back of hand"],["🤛","left facing fist"],["🤜","right facing fist"],["🤝","handshake acordo aperto de maos"],["🤞","hand with index and middle fingers crossed"],["🤟","i love you hand sign"],["✊","raised fist"],["✋","raised hand"],["✌","victory hand"],["✍","writing hand"]]},{"chave":"natureza","rotulo":"Animais e natureza","itens":[["🐀","rat"],["🐁","mouse"],["🐂","ox"],["🐃","water buffalo"],["🐄","cow"],["🐅","tiger"],["🐆","leopard"],["🐇","rabbit"],["🐈","cat"],["🐉","dragon"],["🐊","crocodile"],["🐋","whale"],["🐌","snail"],["🐍","snake"],["🐎","horse"],["🐏","ram"],["🐐","goat"],["🐑","sheep"],["🐒","monkey"],["🐓","rooster"],["🐔","chicken"],["🐕","dog"],["🐖","pig"],["🐗","boar"],["🐘","elephant"],["🐙","octopus"],["🐚","spiral shell"],["🐛","bug"],["🐜","ant"],["🐝","honeybee"],["🐞","lady beetle"],["🐟","fish"],["🐠","tropical fish"],["🐡","blowfish"],["🐢","turtle"],["🐣","hatching chick"],["🐤","baby chick"],["🐥","front facing baby chick"],["🐦","bird"],["🐧","penguin"],["🐨","koala"],["🐩","poodle"],["🐪","dromedary camel"],["🐫","bactrian camel"],["🐬","dolphin"],["🐭","mouse face"],["🐮","cow face"],["🐯","tiger face"],["🐰","rabbit face"],["🐱","cat face"],["🐲","dragon face"],["🐳","spouting whale"],["🐴","horse face"],["🐵","monkey face"],["🐶","dog face"],["🐷","pig face"],["🐸","frog face"],["🐹","hamster face"],["🐺","wolf face"],["🐻","bear face"],["🐼","panda face"],["🐽","pig nose"],["🐾","paw prints"],["🐿","chipmunk"],["🌰","chestnut"],["🌱","seedling"],["🌲","evergreen tree"],["🌳","deciduous tree"],["🌴","palm tree"],["🌵","cactus"],["🌶","hot pepper"],["🌷","tulip"],["🌸","cherry blossom"],["🌹","rose"],["🌺","hibiscus"],["🌻","sunflower"],["🌼","blossom"],["🌽","ear of maize"],["🌾","ear of rice"],["🌿","herb"],["🍀","four leaf clover"],["🍁","maple leaf"],["🍂","fallen leaf"],["🍃","leaf fluttering in wind"],["🍄","mushroom"],["🍅","tomato"],["🍆","aubergine"],["🍇","grapes"],["🍈","melon"],["🍉","watermelon"],["🍊","tangerine"],["🍋","lemon"],["🍌","banana"],["🍍","pineapple"],["🍎","red apple"],["🍏","green apple"]]},{"chave":"comida","rotulo":"Comida e bebida","itens":[["🍅","tomato"],["🍆","aubergine"],["🍇","grapes"],["🍈","melon"],["🍉","watermelon"],["🍊","tangerine"],["🍋","lemon"],["🍌","banana"],["🍍","pineapple"],["🍎","red apple"],["🍏","green apple"],["🍐","pear"],["🍑","peach"],["🍒","cherries"],["🍓","strawberry"],["🍔","hamburger"],["🍕","slice of pizza"],["🍖","meat on bone"],["🍗","poultry leg"],["🍘","rice cracker"],["🍙","rice ball"],["🍚","cooked rice"],["🍛","curry and rice"],["🍜","steaming bowl"],["🍝","spaghetti"],["🍞","bread"],["🍟","french fries"],["🍠","roasted sweet potato"],["🍡","dango"],["🍢","oden"],["🍣","sushi"],["🍤","fried shrimp"],["🍥","fish cake with swirl design"],["🍦","soft ice cream"],["🍧","shaved ice"],["🍨","ice cream"],["🍩","doughnut"],["🍪","cookie"],["🍫","chocolate bar"],["🍬","candy"],["🍭","lollipop"],["🍮","custard"],["🍯","honey pot"],["🍰","shortcake"],["🍱","bento box"],["🍲","pot of food"],["🍳","cooking"],["🍴","fork and knife"],["🍵","teacup without handle"],["🍶","sake bottle and cup"],["🍷","wine glass"],["🍸","cocktail glass"],["🍹","tropical drink"],["🍺","beer mug"],["🍻","clinking beer mugs"],["🍼","baby bottle"],["🍽","fork and knife with plate"],["🍾","bottle with popping cork"],["🍿","popcorn"],["🥐","croissant"],["🥑","avocado"],["🥒","cucumber"],["🥓","bacon"],["🥔","potato"],["🥕","carrot"],["🥖","baguette bread"],["🥗","green salad"],["🥘","shallow pan of food"],["🥙","stuffed flatbread"],["🥚","egg"],["🥛","glass of milk"],["🥜","peanuts"],["🥝","kiwifruit"],["🥞","pancakes"],["🥟","dumpling"],["🥠","fortune cookie"],["🥡","takeout box"],["🥢","chopsticks"],["🥣","bowl with spoon"],["🥤","cup with straw"],["🥥","coconut"],["🥦","broccoli"],["🥧","pie"],["🥨","pretzel"],["🥩","cut of meat"],["🥪","sandwich"],["🥫","canned food"],["🥬","leafy green"],["🥭","mango"],["🥮","moon cake"],["🥯","bagel"]]},{"chave":"viagem","rotulo":"Viagem e lugares","itens":[["🚀","rocket"],["🚁","helicopter"],["🚂","steam locomotive"],["🚃","railway car"],["🚄","high speed train"],["🚅","high speed train with bullet nose"],["🚆","train"],["🚇","metro"],["🚈","light rail"],["🚉","station"],["🚊","tram"],["🚋","tram car"],["🚌","bus"],["🚍","oncoming bus"],["🚎","trolleybus"],["🚏","bus stop"],["🚐","minibus"],["🚑","ambulance"],["🚒","fire engine"],["🚓","police car"],["🚔","oncoming police car"],["🚕","taxi"],["🚖","oncoming taxi"],["🚗","automobile"],["🚘","oncoming automobile"],["🚙","recreational vehicle"],["🚚","delivery truck"],["🚛","articulated lorry"],["🚜","tractor"],["🚝","monorail"],["🚞","mountain railway"],["🚟","suspension railway"],["🚠","mountain cableway"],["🚡","aerial tramway"],["🚢","ship"],["🚣","rowboat"],["🚤","speedboat"],["🌍","earth globe europe africa"],["🌎","earth globe americas"],["🌏","earth globe asia australia"],["🌐","globe with meridians"],["🌑","new moon symbol"],["🌒","waxing crescent moon symbol"],["🌓","first quarter moon symbol"],["🌔","waxing gibbous moon symbol"],["🌕","full moon symbol"],["🌖","waning gibbous moon symbol"],["🌗","last quarter moon symbol"],["🌘","waning crescent moon symbol"],["🌙","crescent moon"],["🌚","new moon with face"],["🌛","first quarter moon with face"],["🌜","last quarter moon with face"],["🌝","full moon with face"],["🌞","sun with face"],["🌟","glowing star"],["🌠","shooting star"],["🏠","house building"],["🏡","house with garden"],["🏢","office building"],["🏣","japanese post office"],["🏤","european post office"],["🏥","hospital"],["🏦","bank"],["🏧","automated teller machine"],["🏨","hotel"]]},{"chave":"objetos","rotulo":"Objetos","itens":[["💡","electric light bulb"],["💢","anger symbol"],["💣","bomb"],["💤","sleeping symbol"],["💥","collision symbol"],["💦","splashing sweat symbol"],["💧","droplet"],["💨","dash symbol"],["💩","pile of poo"],["💪","flexed biceps forca"],["💫","dizzy symbol"],["💬","speech balloon"],["💭","thought balloon"],["💮","white flower"],["💯","hundred points symbol cem certeza"],["💰","money bag dinheiro"],["💱","currency exchange"],["💲","heavy dollar sign"],["💳","credit card"],["💴","banknote with yen sign"],["💵","banknote with dollar sign"],["💶","banknote with euro sign"],["💷","banknote with pound sign"],["💸","money with wings"],["💹","chart with upwards trend and yen sign"],["💺","seat"],["💻","personal computer"],["💼","briefcase"],["💽","minidisc"],["💾","floppy disk"],["💿","optical disc"],["📀","dvd"],["📁","file folder"],["📂","open file folder"],["📃","page with curl"],["📄","page facing up documento papel"],["📅","calendar data calendario agenda"],["📆","tear off calendar"],["📇","card index"],["📈","chart with upwards trend"],["📉","chart with downwards trend"],["📊","bar chart"],["📋","clipboard"],["📌","pushpin fixar importante"],["📍","round pushpin"],["📎","paperclip anexo clipe"],["📏","straight ruler"],["📐","triangular ruler"],["📑","bookmark tabs"],["📒","ledger"],["📓","notebook"],["📔","notebook with decorative cover"],["📕","closed book"],["📖","open book"],["📗","green book"],["📘","blue book"],["📙","orange book"],["📚","books"],["📛","name badge"],["📜","scroll"],["📝","memo"],["📞","telephone receiver telefone ligar"],["📟","pager"],["📠","fax machine"],["📡","satellite antenna"],["📢","public address loudspeaker"],["📣","cheering megaphone"],["📤","outbox tray"],["📥","inbox tray"],["📦","package"],["📧","e mail symbol"],["📨","incoming envelope"],["📩","envelope with downwards arrow above"],["📪","closed mailbox with lowered flag"],["📫","closed mailbox with raised flag"],["📬","open mailbox with raised flag"],["📭","open mailbox with lowered flag"],["📮","postbox"],["📯","postal horn"],["📰","newspaper"],["📱","mobile phone"],["📲","mobile phone with rightwards arrow at left"],["📳","vibration mode"],["📴","mobile phone off"],["📵","no mobile phones"],["📶","antenna with bars"],["📷","camera"],["📸","camera with flash"],["📹","video camera"],["📺","television"],["📻","radio"],["📼","videocassette"],["📽","film projector"],["📾","portable stereo"],["📿","prayer beads"],["🔗","link symbol"],["🔘","radio button"],["🔙","back with leftwards arrow above"],["🔚","end with leftwards arrow above"],["🔛","on with exclamation mark with left right arrow above"],["🔜","soon with rightwards arrow above"],["🔝","top with upwards arrow above"],["🔞","no one under eighteen symbol"],["🔟","keycap ten"],["🔠","input symbol for latin capital letters"],["🔡","input symbol for latin small letters"],["🔢","input symbol for numbers"],["🔣","input symbol for symbols"],["🔤","input symbol for latin letters"],["🔥","fire fogo"],["🔦","electric torch"],["🔧","wrench"],["🔨","hammer"],["🔩","nut and bolt"],["🔪","hocho"],["🔫","pistol"],["🔬","microscope"]]},{"chave":"simbolos","rotulo":"Símbolos","itens":[["❤️","coracao amor"],["⚠️","atencao aviso"],["⚖️","justica direito advogado"],["⏰","hora prazo relogio"],["✉️","email carta"],["🎉","festa parabens"],["☀","black sun with rays"],["☁","cloud"],["☂","umbrella"],["☃","snowman"],["☄","comet"],["★","black star"],["☆","white star"],["☇","lightning"],["☈","thunderstorm"],["☉","sun"],["☊","ascending node"],["☋","descending node"],["☌","conjunction"],["☍","opposition"],["☎","black telephone"],["☏","white telephone"],["☐","ballot box"],["☑","ballot box with check"],["☒","ballot box with x"],["☓","saltire"],["☔","umbrella with rain drops"],["☕","hot beverage"],["☖","white shogi piece"],["☗","black shogi piece"],["☘","shamrock"],["☙","reversed rotated floral heart bullet"],["☚","black left pointing index"],["☛","black right pointing index"],["☜","white left pointing index"],["☝","white up pointing index"],["☞","white right pointing index"],["☟","white down pointing index"],["☠","skull and crossbones"],["☡","caution sign"],["☢","radioactive sign"],["☣","biohazard sign"],["☤","caduceus"],["☥","ankh"],["☦","orthodox cross"],["☧","chi rho"],["☨","cross of lorraine"],["☩","cross of jerusalem"],["☪","star and crescent"],["☫","farsi symbol"],["☬","adi shakti"],["☭","hammer and sickle"],["☮","peace symbol"],["☯","yin yang"],["☰","trigram for heaven"],["☱","trigram for lake"],["☲","trigram for fire"],["☳","trigram for thunder"],["☴","trigram for wind"],["☵","trigram for water"],["☶","trigram for mountain"],["☷","trigram for earth"],["☸","wheel of dharma"],["☹","white frowning face"],["☺","white smiling face"],["☻","black smiling face"],["☼","white sun with rays"],["☽","first quarter moon"],["☾","last quarter moon"],["☿","mercury"],["♀","female sign"],["♁","earth"],["♂","male sign"],["♃","jupiter"],["♄","saturn"],["♅","uranus"],["♆","neptune"],["♇","pluto"],["♈","aries"],["♉","taurus"],["♊","gemini"],["♋","cancer"],["♌","leo"],["♍","virgo"],["♎","libra"],["♏","scorpius"],["♐","sagittarius"],["♑","capricorn"],["♒","aquarius"],["♓","pisces"],["♔","white chess king"],["♕","white chess queen"],["♖","white chess rook"],["♗","white chess bishop"],["♘","white chess knight"],["♙","white chess pawn"],["♚","black chess king"],["♛","black chess queen"],["♜","black chess rook"],["♝","black chess bishop"],["♞","black chess knight"],["♟","black chess pawn"],["♠","black spade suit"],["♡","white heart suit"],["♢","white diamond suit"],["♣","black club suit"],["♤","white spade suit"],["♥","black heart suit"],["♦","black diamond suit"],["♧","white club suit"],["♨","hot springs"],["♩","quarter note"],["♪","eighth note"],["♫","beamed eighth notes"],["♬","beamed sixteenth notes"],["♭","music flat sign"],["♮","music natural sign"],["♯","music sharp sign"],["♰","west syriac cross"],["♱","east syriac cross"],["♲","universal recycling symbol"],["♳","recycling symbol for type 1 plastics"],["♴","recycling symbol for type 2 plastics"],["♵","recycling symbol for type 3 plastics"],["♶","recycling symbol for type 4 plastics"],["♷","recycling symbol for type 5 plastics"],["♸","recycling symbol for type 6 plastics"],["♹","recycling symbol for type 7 plastics"],["♺","recycling symbol for generic materials"],["♻","black universal recycling symbol"],["♼","recycled paper symbol"],["♽","partially recycled paper symbol"],["♾","permanent paper sign"],["♿","wheelchair symbol"],["⚀","die face 1"],["⚁","die face 2"],["⚂","die face 3"],["⚃","die face 4"],["⚄","die face 5"],["⚅","die face 6"],["⚆","white circle with dot right"],["⚇","white circle with two dots"],["⚈","black circle with white dot right"],["⚉","black circle with two white dots"],["⚊","monogram for yang"],["⚋","monogram for yin"],["⚌","digram for greater yang"],["⚍","digram for lesser yin"],["⚎","digram for lesser yang"],["⚏","digram for greater yin"],["⚐","white flag"],["⚑","black flag"],["⚒","hammer and pick"],["⚓","anchor"],["⚔","crossed swords"],["⚕","staff of aesculapius"],["⚖","scales"],["⚗","alembic"],["⚘","flower"],["⚙","gear"],["⚚","staff of hermes"],["⚛","atom symbol"],["⚜","fleur de lis"],["⚝","outlined white star"],["⚞","three lines converging right"],["⚟","three lines converging left"],["⚠","warning sign"],["⚡","high voltage sign"],["⚢","doubled female sign"],["⚣","doubled male sign"],["⚤","interlocked female and male sign"],["⚥","male and female sign"],["⚦","male with stroke sign"],["⚧","male with stroke and male and female sign"],["⚨","vertical male with stroke sign"],["⚩","horizontal male with stroke sign"],["⚪","medium white circle"],["⚫","medium black circle"],["⚬","medium small white circle"],["⚭","marriage symbol"],["⚮","divorce symbol"],["⚯","unmarried partnership symbol"],["⚰","coffin"],["⚱","funeral urn"],["⚲","neuter"],["⚳","ceres"],["⚴","pallas"],["⚵","juno"],["⚶","vesta"],["⚷","chiron"],["⚸","black moon lilith"],["⚹","sextile"],["⚺","semisextile"],["⚻","quincunx"],["⚼","sesquiquadrate"],["⚽","soccer ball"],["⚾","baseball"],["⚿","squared key"],["⛀","white draughts man"],["⛁","white draughts king"],["⛂","black draughts man"],["⛃","black draughts king"],["⛄","snowman without snow"],["⛅","sun behind cloud"],["⛆","rain"],["⛇","black snowman"],["⛈","thunder cloud and rain"],["⛉","turned white shogi piece"],["⛊","turned black shogi piece"],["⛋","white diamond in square"],["⛌","crossing lanes"],["⛍","disabled car"],["⛎","ophiuchus"],["⛏","pick"],["⛐","car sliding"],["⛑","helmet with white cross"],["⛒","circled crossing lanes"],["⛓","chains"],["⛔","no entry"],["⛕","alternate one way left way traffic"],["⛖","black two way left way traffic"],["⛗","white two way left way traffic"],["⛘","black left lane merge"],["⛙","white left lane merge"],["⛚","drive slow sign"],["⛛","heavy white down pointing triangle"],["⛜","left closed entry"],["⛝","squared saltire"],["⛞","falling diagonal in white circle in black square"],["⛟","black truck"],["⛠","restricted left entry 1"],["⛡","restricted left entry 2"],["⛢","astronomical symbol for uranus"],["⛣","heavy circle with stroke and two dots above"],["⛤","pentagram"],["⛥","right handed interlaced pentagram"],["⛦","left handed interlaced pentagram"],["⛧","inverted pentagram"],["⛨","black cross on shield"],["⛩","shinto shrine"],["⛪","church"],["⛫","castle"],["⛬","historic site"],["⛭","gear without hub"],["⛮","gear with handles"],["⛯","map symbol for lighthouse"],["⛰","mountain"],["⛱","umbrella on ground"],["⛲","fountain"],["⛳","flag in hole"],["⛴","ferry"],["⛵","sailboat"],["⛶","square four corners"],["⛷","skier"],["⛸","ice skate"],["⛹","person with ball"],["⛺","tent"],["⛻","japanese bank symbol"],["⛼","headstone graveyard symbol"],["⛽","fuel pump"],["⛾","cup on black square"],["⛿","white flag with horizontal middle black stripe"],["✅","white heavy check mark certo ok feito"],["❌","cross mark errado nao"],["❤","heavy black heart"],["💯","hundred points symbol cem certeza"],["🔝","top with upwards arrow above"],["🔞","no one under eighteen symbol"],["🔟","keycap ten"],["🔠","input symbol for latin capital letters"],["🔡","input symbol for latin small letters"],["🔢","input symbol for numbers"],["🔣","input symbol for symbols"],["🔤","input symbol for latin letters"]]}];


// O NOME DE CADA EMOJI, para o `title` do botão. Montado uma vez: são 800
// itens, e refazer isso a cada desenho do painel seria trabalho à toa.
const NOME_DO_EMOJI = new Map();
for (const c of CATALOGO) {
  for (const [ch, nome] of c.itens) if (!NOME_DO_EMOJI.has(ch) && nome) NOME_DO_EMOJI.set(ch, nome);
}

// Os oito primeiros de cada aba servem de amostra no topo da lista fechada.
export const RECENTES_CHAVE = "zorvin_emojis_recentes";

export function lerRecentes() {
  try {
    const cru = JSON.parse(localStorage.getItem(RECENTES_CHAVE) || "[]");
    return Array.isArray(cru) ? cru.filter((e) => typeof e === "string").slice(0, 32) : [];
  } catch (_) { return []; }
}

export function guardarRecente(emoji) {
  try {
    const lista = [emoji, ...lerRecentes().filter((e) => e !== emoji)].slice(0, 32);
    localStorage.setItem(RECENTES_CHAVE, JSON.stringify(lista));
  } catch (_) { /* navegador sem localStorage: só não guarda */ }
}

// `aoEscolher` recebe o emoji. `C` são as cores do tema, para o painel não ter
// uma paleta própria que descolaria do resto na próxima mudança de tema.
// `rodape` é opcional: a barra "emojis | figurinhas" da caixa de digitação. Ela
// entra DENTRO da moldura do painel — colada por fora, com borda própria,
// pareceria uma segunda caixa em cima da primeira.
export default function PainelEmoji({ C, aoEscolher, largura = 400, altura = 320, rodape = null }) {
  const [aba, setAba] = useState("recentes");
  const [termo, setTermo] = useState("");
  const [recentes, setRecentes] = useState(lerRecentes);

  const abas = useMemo(() => ([
    { chave: "recentes", rotulo: "Usados recentemente", itens: recentes.map((e) => [e, ""]) },
    ...CATALOGO,
  ]), [recentes]);

  // SEM ACENTO DOS DOIS LADOS.
  //
  // Os sinônimos em português estão escritos sem acento no catálogo
  // ("coracao", "atencao", "justica", "parabens"), e a comparação era letra por
  // letra. Quem digitava a palavra do jeito certo — "coração", que é como
  // qualquer pessoa escreve — não achava nada, e o painel parecia não ter
  // aquele emoji. Escrever os sinônimos com acento não resolveria: aí quem
  // digitasse sem acento é que não acharia.
  const semAcento = (t) => String(t ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase();

  // A busca varre TODAS as abas: quem digita "coracao" quer o coração, não
  // quer descobrir antes em que categoria ele mora.
  const mostrados = useMemo(() => {
    const q = semAcento(termo.trim());
    if (q) {
      const achados = [];
      const vistos = new Set();
      for (const c of CATALOGO) {
        for (const [ch, nome] of c.itens) {
          if (!vistos.has(ch) && semAcento(nome).includes(q)) { vistos.add(ch); achados.push(ch); }
        }
      }
      return achados;
    }
    const atual = abas.find((a) => a.chave === aba) || abas[0];
    return atual.itens.map((i) => i[0]);
  }, [termo, aba, abas]);

  function escolher(e) {
    guardarRecente(e);
    setRecentes(lerRecentes());
    aoEscolher(e);
  }

  const BOTAO_ABA = (ativa) => ({
    border: "none", background: "transparent", cursor: "pointer",
    padding: "7px 0 5px", flex: 1, display: "flex", justifyContent: "center",
    borderBottom: `2px solid ${ativa ? C.green : "transparent"}`,
    color: ativa ? C.green : C.textSecondary, fontSize: 17, lineHeight: 1,
  });

  return (
    // ALTURA FIXA, e não "cresce conforme o conteúdo".
    //
    // A grade tem `flex: 1`, e num contêiner sem altura definida isso a deixa
    // esticar até caber TODOS os emojis — oitocentos deles. O painel virava uma
    // coluna de mais de 2000px, que subia muito além do topo da janela: as abas
    // e a busca ficavam fora da tela, e o que sobrava era um paredão de rostos.
    //
    // Com a altura amarrada aqui, a grade rola por dentro em vez de empurrar o
    // painel para cima.
    <div style={{ width: largura, maxWidth: "calc(100vw - 24px)",
                  height: altura + 92, maxHeight: "calc(100vh - 120px)",
                  background: C.panel,
                  border: `1px solid ${C.divider}`, borderRadius: 12,
                  boxShadow: "0 8px 28px rgba(0,0,0,.35)", overflow: "hidden",
                  display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", borderBottom: `1px solid ${C.divider}` }}>
        <button onClick={() => { setAba("recentes"); setTermo(""); }} title="Recentes"
                style={BOTAO_ABA(!termo && aba === "recentes")}>
          <Clock size={17} />
        </button>
        {CATALOGO.map((c) => (
          <button key={c.chave} onClick={() => { setAba(c.chave); setTermo(""); }} title={c.rotulo}
                  style={BOTAO_ABA(!termo && aba === c.chave)}>
            {c.itens[0] ? c.itens[0][0] : "•"}
          </button>
        ))}
      </div>

      <div style={{ padding: "8px 8px 4px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.searchBg,
                      borderRadius: 8, padding: "6px 10px" }}>
          <Search size={15} color={C.textSecondary} />
          <input value={termo} onChange={(e) => setTermo(e.target.value)}
                 placeholder="Pesquisar emoji"
                 style={{ border: "none", outline: "none", background: "transparent",
                          fontSize: 13.5, flex: 1, color: C.textPrimary }} />
        </div>
      </div>

      {/* O NOME DA CATEGORIA, como no WhatsApp: as abas dizem para onde ir, o
          título diz onde se está. Some durante a busca, que atravessa todas. */}
      {!termo && (
        <div style={{ padding: "6px 12px 2px", fontSize: 12.5, fontWeight: 600, color: C.textSecondary }}>
          {(abas.find((a) => a.chave === aba) || abas[0]).rotulo}
        </div>
      )}

      {/* `minHeight: 0` é o que faz a rolagem funcionar dentro de um flex:
          sem ele o item se recusa a encolher abaixo do próprio conteúdo, e a
          barra de rolagem nunca aparece — a grade empurra o painel. */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "2px 6px 8px",
                    display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 1 }}>
        {mostrados.length === 0 && (
          <div style={{ width: "100%", textAlign: "center", color: C.textSecondary,
                        fontSize: 13, padding: "24px 8px" }}>
            {termo ? "Nenhum emoji com esse nome." : "Os emojis que você usar aparecem aqui."}
          </div>
        )}
        {mostrados.map((e, i) => (
          // O `title` mostrava o próprio emoji — o desenho que a pessoa já
          // está vendo. Agora mostra o nome, que é o que responde "o que é
          // este?" para quem passa o mouse.
          <button key={e + i} onClick={() => escolher(e)} title={NOME_DO_EMOJI.get(e) || e}
                  style={{ border: "none", background: "transparent", cursor: "pointer",
                           fontSize: 22, lineHeight: 1, padding: 5, borderRadius: 6 }}>{e}</button>
        ))}
      </div>
      {rodape}
    </div>
  );
}
