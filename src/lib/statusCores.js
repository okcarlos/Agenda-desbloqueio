// Funções puras compartilhadas pelo projeto e pelos testes da Etapa 7.
// Preserva exatamente o comportamento de cores aprovado após a Etapa 5.
export const PADRAO = [
  { nome: 'AGENDADO', cor: '#2877CD' },
  { nome: 'EM ATENDIMENTO', cor: '#C58A22' },
  { nome: 'DESBLOQUEADO', cor: '#21885B' },
  { nome: 'CLIENTE NÃO ATENDEU', cor: '#CB5148' },
  { nome: 'REAGENDADO', cor: '#8664C7' },
  { nome: 'CANCELADO', cor: '#778494' },
]

export function corInline(nome, personalizados = []) {
  const s = [...PADRAO, ...personalizados].find(item => item.nome === nome)
  if (!s || !/^#[0-9a-fA-F]{6}$/.test(s.cor)) return {}
  return {
    color: s.cor,
    borderColor: `${s.cor}80`,
    backgroundColor: `${s.cor}26`,
  }
}
