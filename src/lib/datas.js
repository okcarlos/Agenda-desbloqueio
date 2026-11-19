// Evita depender do fuso do dispositivo para definir o mês inicial do calendário.
export function mesAtualSaoPaulo(data = new Date()) {
  const campos = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric',
  }).formatToParts(data)
  const numero = tipo => Number(campos.find(p => p.type === tipo)?.value)
  return { ano: numero('year'), mes: numero('month') - 1 }
}
