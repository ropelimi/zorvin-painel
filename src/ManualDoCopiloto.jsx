import React, { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabase.js";
import { naoGravouNada, comOCodigo } from "./gravar.js";
import { useEstadoDoCopiloto } from "./copiloto.js";
import { Loader2 } from "lucide-react";
import { NOME_DO_ASSISTENTE } from "./assistente.js";
import { RostoDoAssistente } from "./RostoDoAssistente.jsx";
import { LicoesDoCopiloto, NotasDoCopiloto, useNomesDaEquipe } from "./AprendizadoDoCopiloto.jsx";

// ============================================================
//  O MANUAL DO COPILOTO — a aba "Quazar" de Departamentos e acessos. Desde
//  05/11 o copiloto tem nome e rosto (`assistente.js`, `RostoDoAssistente.jsx`):
//  a TELA diz Quazar, e o código, as rotas e as tabelas continuam "copiloto".
//
//  O copiloto lê, a cada clique em "Sugerir resposta", as últimas mensagens
//  da conversa aberta, as mensagens rápidas da equipe e ESTE texto. É aqui
//  que o escritório diz como trabalha: quem é, como escreve, o que nunca
//  promete. Nasce com um modelo genérico (o script 024 da ponte), escrito sem
//  conversa de cliente nenhuma.
//
//  Uma tela, e não SQL: texto que exige chamar o fornecedor para ser trocado
//  é texto fixo (a régua das palavras da casa).
//
//  ------------------------------------------------------------
//  SEM A TABELA, A ABA NÃO APARECE — quem decide isso é `Departamentos.jsx`,
//  pela régua de três estados. Aqui dentro, a leitura que FALHA é dita, com
//  o código, e não vira caixa vazia: uma caixa vazia salva por cima apagaria
//  o manual que existe e não chegou.
//
//  SALVAR RELÊ DO BANCO: o que a tela mostra depois é o que ficou guardado,
//  e não o que foi digitado. E a recusa calada da RLS (zero linhas, sem
//  erro) é dita como recusa — a armadilha de 24/09.
//
//  E, DESDE 05/11, O QUE ELE APRENDEU: as lições da equipe e as notas de cada
//  departamento e telefone (`AprendizadoDoCopiloto.jsx`, script 050).
// ============================================================

const TETO = 8000;

function quandoFoi(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric",
                                     hour: "2-digit", minute: "2-digit" });
}

export function ManualDoCopiloto({ cx, C, departamentos = [], telefones = [] }) {
  const estado = useEstadoDoCopiloto();
  const nomes = useNomesDaEquipe();
  // null = lendo; { instrucoes, atualizado_em } = lido; { erro } = falhou.
  const [lido, setLido] = useState(null);
  const [texto, setTexto] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [recado, setRecado] = useState(null);   // { tipo: "ok" | "erro", frase }

  const ler = useCallback(async () => {
    const { data, error } = await supabase.from("zorvin_copiloto")
      .select("instrucoes, atualizado_em").maybeSingle();
    if (error) {
      setLido({ erro: comOCodigo(`Não consegui ler o manual do ${NOME_DO_ASSISTENTE}.`, error, "manual do copiloto") });
      return false;
    }
    // SEM A LINHA, o "Salvar" não teria o que atualizar. O script 024 a cria
    // sempre; sem ela, a instalação está pela metade, e isso é dito.
    if (!data) {
      setLido({ erro: `O manual do ${NOME_DO_ASSISTENTE} ainda não está pronto no banco (falta a linha que o script 024 cria). Confira em “Atualizações do banco”.` });
      return false;
    }
    setLido({ instrucoes: data.instrucoes || "", atualizado_em: data.atualizado_em || null });
    setTexto(data.instrucoes || "");
    return true;
  }, []);

  useEffect(() => { ler(); }, [ler]);

  const mudou = Boolean(lido && !lido.erro && texto !== lido.instrucoes);
  const grande = texto.length > TETO;

  async function salvar() {
    if (!mudou || grande || salvando) return;
    setSalvando(true); setRecado(null);
    const r = await supabase.from("zorvin_copiloto").update({ instrucoes: texto })
      .eq("id", true).select("id");
    if (r.error) {
      setSalvando(false);
      setRecado({ tipo: "erro", frase: comOCodigo("Não consegui salvar o manual.", r.error, "manual do copiloto") });
      return;
    }
    if (naoGravouNada(r)) {
      setSalvando(false);
      setRecado({ tipo: "erro", frase: "Não salvou: o banco não deixou. Só quem administra o Zorvin pode mudar o manual." });
      return;
    }
    const releu = await ler();
    setSalvando(false);
    setRecado(releu
      ? { tipo: "ok", frase: "Salvo. A próxima sugestão já lê o manual novo." }
      : { tipo: "erro", frase: "Salvou, mas não consegui reler o manual para conferir. Feche e abra esta aba." });
  }

  // O QUE A PONTE DIZ DO COPILOTO — ligado, desligado, ou não deu para saber.
  // A chave é da ponte, e ninguém a vê daqui; o que se diz é se ela existe.
  const situacao = !estado ? { cor: C.textSecondary, frase: `Perguntando à ponte se o ${NOME_DO_ASSISTENTE} está ligado…` }
    : estado.ligado === true ? { cor: C.green, frase: `Ligado${estado.modelo ? ` (${estado.modelo})` : ""}: o botão “Sugerir resposta” aparece na caixa de escrever.` }
    : estado.ligado === false ? { cor: C.erroTexto, frase: "Ainda não está ligado: falta a variável ANTHROPIC_API_KEY na Render (serviço da ponte). Enquanto ela não existir, o botão não aparece para a equipe." }
    : { cor: C.ambarTexto, frase: `Não consegui perguntar à ponte se o ${NOME_DO_ASSISTENTE} está ligado. O botão aparece assim mesmo, e o clique diz o que estiver errado.` };

  return (
    <div data-manual-do-copiloto>
      <div style={cx.secao}>
        <div style={cx.titulo} data-titulo-do-assistente><RostoDoAssistente tamanho={26} /> O {NOME_DO_ASSISTENTE}, o assistente do Zorvin</div>
        <div data-copiloto-ligado={estado ? String(estado.ligado) : "perguntando"}
             style={{ ...cx.dica, color: situacao.cor, fontWeight: 600 }}>
          {situacao.frase}
        </div>
        <div style={{ ...cx.dica, marginBottom: 0 }}>
          Ao clicar em <b>Sugerir resposta</b>, o {NOME_DO_ASSISTENTE} lê as últimas 40 mensagens da
          conversa aberta (os áudios, pela transcrição), as mensagens rápidas da equipe, o
          manual abaixo, as lições que a equipe ensinou e o que ele aprendeu lendo as conversas
          daquele telefone e daquele departamento — e escreve uma resposta na caixa. <b>Nada sai
          sozinho</b>: quem atende lê, pede uma mudança se precisar e só então envia. As notas
          internas não vão para o {NOME_DO_ASSISTENTE}.
        </div>
      </div>

      <div style={cx.secao}>
        <div style={cx.titulo}>O manual do escritório</div>
        <div style={cx.dica}>
          Escreva como a equipe trabalha: quem é o escritório, como vocês escrevem, o que nunca
          prometem e o que fazer quando não souberem. Quanto mais parecido com o que vocês
          explicariam a uma atendente nova, melhores as sugestões.
        </div>
        {lido === null && (
          <div style={{ ...cx.dica, display: "flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={14} className="zv-girando" /> Lendo o manual…
          </div>
        )}
        {lido && lido.erro && (
          <div data-manual-erro style={{ fontSize: 13, color: C.erroTexto, lineHeight: 1.5 }}>
            {lido.erro}{" "}
            <button style={cx.botaoFraco} onClick={() => { setLido(null); ler(); }}>Tentar de novo</button>
          </div>
        )}
        {lido && !lido.erro && (<>
          <textarea data-manual-texto value={texto} rows={16}
                    onChange={(e) => { setTexto(e.target.value); setRecado(null); }}
                    style={{ ...cx.campo, width: "100%", boxSizing: "border-box", resize: "vertical",
                             fontFamily: "inherit", lineHeight: 1.5 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
            <button data-manual-salvar style={{ ...cx.botao, opacity: mudou && !grande ? 1 : 0.5,
                                                cursor: mudou && !grande ? "pointer" : "default" }}
                    disabled={!mudou || grande || salvando} onClick={salvar}>
              {salvando ? <Loader2 size={14} className="zv-girando" /> : null}
              {salvando ? "Salvando…" : "Salvar o manual"}
            </button>
            <span data-manual-conta style={{ fontSize: 12, color: grande ? C.erroTexto : C.textSecondary }}>
              {texto.length.toLocaleString("pt-BR")}/{TETO.toLocaleString("pt-BR")} caracteres
              {grande ? " — passou do limite" : ""}
            </span>
            {lido.atualizado_em && (
              <span data-manual-quando style={{ fontSize: 12, color: C.textSecondary }}>
                · última alteração em {quandoFoi(lido.atualizado_em)}
              </span>
            )}
          </div>
          {recado && (
            <div data-manual-recado={recado.tipo}
                 style={{ marginTop: 8, fontSize: 13, color: recado.tipo === "ok" ? C.verdeTexto : C.erroTexto }}>
              {recado.frase}
            </div>
          )}
        </>)}
      </div>

      <LicoesDoCopiloto cx={cx} C={C} nomes={nomes} />
      <NotasDoCopiloto cx={cx} C={C} departamentos={departamentos} telefones={telefones}
                       estado={estado} nomes={nomes} />
    </div>
  );
}

export default ManualDoCopiloto;
