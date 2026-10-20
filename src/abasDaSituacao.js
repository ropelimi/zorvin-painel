// AS TRÊS ABAS DA LISTA (script 028 da ponte), numa escrita só.
//
// Na ordem do DataCrazy — e na do caminho de uma conversa: o cliente chega,
// alguém atende, alguém finaliza.
//
// OS NOMES SÃO DA TELA, e mudaram em 20/10, a pedido do Rodrigo: "Aguardando"
// virou "Novos" e "Em aberto" virou "Em Atendimento". OS VALORES SÃO DO BANCO
// (`conversas.situacao`) e continuam os do 028: trocar o nome é coisa da tela;
// trocar o valor seria regravar cada conversa, e mexer no gatilho que decide
// em qual aba cada uma mora.
//
// Um lugar só porque três telas dizem o nome da aba — a lista, a janela do
// "Finalizar" e a do "Reabrir". Com três cópias, a próxima troca de nome
// deixaria uma frase mandando procurar uma aba que não existe mais.
export const ABAS_DA_SITUACAO = [["aguardando", "Novos"], ["aberto", "Em Atendimento"], ["finalizado", "Finalizados"]];

export const NOME_DA_SITUACAO = Object.fromEntries(ABAS_DA_SITUACAO);
