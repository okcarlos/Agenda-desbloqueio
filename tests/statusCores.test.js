import test from 'node:test'
import assert from 'node:assert/strict'
import { PADRAO, corInline } from '../src/lib/statusCores.js'

test('seis status originais continuam com as cores aprovadas', () => {
  assert.deepEqual(PADRAO.map(s => s.nome), [
    'AGENDADO', 'EM ATENDIMENTO', 'DESBLOQUEADO',
    'CLIENTE NÃO ATENDEU', 'REAGENDADO', 'CANCELADO',
  ])
  assert.equal(corInline('REAGENDADO', []).color, '#8664C7')
})

test('cores personalizadas aplicam texto, borda e fundo sem perder transparência', () => {
  assert.deepEqual(corInline('EM ANÁLISE', [{nome:'EM ANÁLISE',cor:'#aBc123'}]), {
    color: '#aBc123', borderColor:'#aBc12380', backgroundColor:'#aBc12326',
  })
})

test('cor inválida, status não cadastrado e entrada ausente não geram estilos inseguros', () => {
  assert.deepEqual(corInline('X', [{nome:'X',cor:'red; background:red'}]), {})
  assert.deepEqual(corInline('X', []), {})
  assert.deepEqual(corInline('X'), {})
})
