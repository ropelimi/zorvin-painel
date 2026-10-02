// ============================================================
//  A MENSAGEM AGENDADA — as contas de hora, num lugar só
//
//  Pedido do Rodrigo em 02/10: agendar mensagem, texto e anexo. A mensagem
//  sai na hora marcada mesmo que o cliente escreva antes, e qualquer pessoa da
//  equipe pode cancelar enquanto ela não saiu.
//
//  A HORA É A DO NAVEGADOR de quem agenda: o campo `datetime-local` escreve
//  "2026-10-03T09:00" sem fuso, e `new Date()` lê isso como hora local. Quem
//  marca "amanhã às 9h" no escritório quer as 9h do relógio da parede — e é
//  essa a hora que vai para o banco, já convertida em instante.
// ============================================================

/** Antecedência mínima. Agendar para daqui a 30 segundos é mandar agora com
 *  um passo a mais — e a ponte lê a fila de 3 em 3 segundos, então a hora
 *  marcada viraria uma promessa que ela talvez não cumpra ao segundo. */
export const ANTECEDENCIA_MINIMA_MS = 60 * 1000;

/** Teto: um ano. Data de 2027 digitada como 2072 por engano ficaria na fila
 *  para sempre, sem ninguém ver. */
export const ANTECEDENCIA_MAXIMA_MS = 366 * 24 * 60 * 60 * 1000;

const dois = (n) => String(n).padStart(2, "0");

/** O valor que o `<input type="datetime-local">` entende, na hora local. */
export function valorDoCampo(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}T${dois(d.getHours())}:${dois(d.getMinutes())}`;
}

/** O instante (ISO, em UTC) de um valor do campo, ou `null` se não for data. */
export function lerCampo(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

/** Por que esta hora NÃO serve — ou `null`, se serve. A frase diz o que
 *  fazer, porque é ela que aparece na tela. */
export function porQueNaoServe(iso, agora = Date.now()) {
  if (!iso) return "Escolha o dia e a hora.";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Essa data não existe.";
  if (t <= agora) return "Essa hora já passou — escolha outra.";
  if (t - agora < ANTECEDENCIA_MINIMA_MS) return "Escolha pelo menos um minuto à frente.";
  if (t - agora > ANTECEDENCIA_MAXIMA_MS) return "Agende para no máximo um ano à frente.";
  return null;
}

/** Os atalhos de todo dia. "Amanhã" quer dizer o dia seguinte do calendário,
 *  e não "daqui a 24 horas": quem agenda às 23h para "amanhã às 9h" quer as 9h
 *  de daqui a dez horas. */
export function opcoesRapidas(agora = new Date()) {
  const daquiAUmaHora = new Date(agora.getTime() + 60 * 60 * 1000);
  daquiAUmaHora.setSeconds(0, 0);
  const amanha = (h) => {
    const d = new Date(agora);
    d.setDate(d.getDate() + 1);
    d.setHours(h, 0, 0, 0);
    return d;
  };
  return [
    { id: "1h", rotulo: "Daqui a 1 hora", quando: daquiAUmaHora },
    { id: "amanha9", rotulo: "Amanhã às 9h", quando: amanha(9) },
    { id: "amanha14", rotulo: "Amanhã às 14h", quando: amanha(14) },
  ];
}

const DIAS = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "hoje às 15:30", "amanhã às 09:00", "sex., 10/10 às 09:00". O dia da
 *  semana vai junto da data porque é por ele que se confere ("era para
 *  segunda") — a data sozinha pede uma conta de cabeça. */
export function rotuloDaHora(iso, agora = new Date()) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  const hora = `${dois(d.getHours())}:${dois(d.getMinutes())}`;
  const dia = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dif = Math.round((dia(d) - dia(agora)) / 86400000);
  if (dif === 0) return `hoje às ${hora}`;
  if (dif === 1) return `amanhã às ${hora}`;
  const data = `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`
    + (d.getFullYear() !== agora.getFullYear() ? `/${d.getFullYear()}` : "");
  return `${DIAS[d.getDay()]}, ${data} às ${hora}`;
}

/** A coluna não existe nesta base (script 013 não rodou)? */
export function semAColunaDaAgenda(erro) {
  if (!erro) return false;
  const codigo = String(erro.code || "");
  const msg = String(erro.message || "");
  return (codigo === "42703" || codigo === "PGRST204") && /agendada_para/.test(msg);
}
