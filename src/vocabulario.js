import { useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// ============================================================
//  COMO ESTA INSTALAÇÃO CHAMA QUEM É DONO DE UM TELEFONE
//
//  O painel dizia "advogado" em NOVE frases. Para o escritório está certo;
//  para uma clínica, uma imobiliária ou uma equipe de vendas, o programa fala
//  de uma profissão que não é a deles.
//
//  ONDE ELAS FICAM, medido: Configurações → Importar histórico e Configurações
//  → Contatos. NÃO na primeira tela — ela diz "ATENDENDO COMO" e lista nomes
//  de telefone. A prova foi escrita supondo o contrário e reprovou três vezes,
//  falando de um rótulo que não existe lá.
//
//  UMA DELAS QUASE FICOU PARA TRÁS: "No celular do advogado: …". Um extrator
//  de texto visível baseado em `>…<` não a pega, porque ela tem um `<b>` no
//  meio — e é a frase da tela de instruções, onde se presta mais atenção.
//
//  E O QUE NÃO SE TROCA: `origem === "advogado"` aparece vinte vezes no
//  `Painel.jsx` e é VALOR GRAVADO NO BANCO — é o que separa mensagem da equipe
//  de mensagem do cliente.
//
//  ------------------------------------------------------------
//  "PROCESSO" NÃO ENTRA AQUI, e isso foi medido
//
//  Toda frase visível com "processo" está atrás de uma porta do Vantoro — o
//  seletor de processo da nota, o vínculo, os avisos —, e a etapa anterior as
//  escondeu. O Vantoro é o sistema do próprio escritório, onde a palavra é
//  sempre "processo". Um botão para trocar uma palavra que só aparece quando o
//  Vantoro está ligado seria um botão que ninguém pode usar.
//
//  ------------------------------------------------------------
//  SEM A TABELA, TUDO COMO ANTES
//
//  `PADRAO` é o que o escritório vê hoje. A leitura que falhar — tabela que
//  ainda não existe, banco fora do ar — cai nele, e a tela continua a mesma.
//  Esta é a única leitura do painel que PODE desenhar ausência sem avisar, e
//  por um motivo que não vale para nenhuma outra: a ausência aqui é uma
//  palavra igual à de sempre, e não um dado que sumiu. Uma faixa dizendo "não
//  consegui ler as palavras" seria alarme que não pede ação — e é assim que a
//  equipe aprende a ignorar a faixa que importa.
//
//  ------------------------------------------------------------
//  O GÊNERO É GUARDADO, E NÃO DEDUZIDO
//
//  As frases concordam: "o advogado" / "a médica", "um advogado" / "uma
//  médica", "dono" / "dona", "selecionado" / "selecionada". Deduzir da
//  terminação erraria em "gerente", "assistente", "representante" — e erro de
//  concordância é o que faz um comprador achar que o programa é amador.
//
//  E ISSO NÃO É TEÓRICO: sabotei este arquivo para deduzir por terminação e a
//  prova PASSOU, porque as duas palavras que ela usava ("corretor", "médica")
//  por acaso obedecem à regra. Foi preciso acrescentar "gerente" para que a
//  coluna `genero` deixasse de poder ser jogada fora em silêncio.
//
//  ------------------------------------------------------------
//  PERGUNTA-SE UMA VEZ POR ABERTURA, como em `temVantoro.js`: a promessa fica
//  guardada no módulo, e quem chegar depois espera a MESMA.
// ============================================================

const PADRAO = { singular: "advogado", plural: "advogados", genero: "m" };

/** As palavras já com as concordâncias que as frases da tela precisam. */
export function comoFalar(p) {
  const f = p.genero === "f";
  return {
    ...p,
    o: f ? "a" : "o",
    um: f ? "uma" : "um",
    dono: f ? "dona" : "dono",
    selecionado: f ? "selecionada" : "selecionado",
    // O MAIÚSCULO É DERIVADO, e não uma coluna a mais: guardar "ADVOGADO"
    // separado deixaria alguém trocar o singular e esquecer dele, com a
    // barra lateral dizendo uma palavra e a frase abaixo dizendo outra.
    SINGULAR: p.singular.toLocaleUpperCase("pt-BR"),
  };
}

let promessa = null;

export function perguntarAsPalavras() {
  if (promessa) return promessa;
  promessa = supabase
    .from("zorvin_palavras")
    .select("singular, plural, genero")
    .maybeSingle()
    .then(({ data, error }) => {
      if (error || !data) return PADRAO;
      // CAMPO VAZIO NÃO APAGA A PALAVRA. A tela de administração impede o
      // vazio, mas um `update` feito à mão no Supabase não — e uma frase
      // "Escolha o …" é pior do que uma que diz a profissão errada.
      return {
        singular: String(data.singular || "").trim() || PADRAO.singular,
        plural: String(data.plural || "").trim() || PADRAO.plural,
        genero: data.genero === "f" ? "f" : "m",
      };
    })
    .catch(() => PADRAO);
  return promessa;
}

/** Começa no padrão, e não em `null`: a palavra tem de estar escrita desde o
 *  primeiro quadro. Esperando a resposta, a barra lateral abriria com o rótulo
 *  em branco — e um rótulo que aparece depois é pior do que um que trocou. */
export function useVocabulario() {
  const [p, setP] = useState(PADRAO);
  useEffect(() => {
    let vivo = true;
    perguntarAsPalavras().then((r) => { if (vivo) setP(r); });
    return () => { vivo = false; };
  }, []);
  return comoFalar(p);
}

// A bancada precisa esquecer entre cenários — ver a nota igual em `temVantoro.js`.
export function esquecerAsPalavras() { promessa = null; }
