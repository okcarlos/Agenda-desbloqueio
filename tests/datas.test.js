import test from 'node:test'
import assert from 'node:assert/strict'
import { mesAtualSaoPaulo } from '../src/lib/datas.js'

test('usa fuso de São Paulo perto da virada de ano UTC', () => {
  assert.deepEqual(mesAtualSaoPaulo(new Date('2027-01-01T01:30:00Z')), {ano:2026,mes:11})
  assert.deepEqual(mesAtualSaoPaulo(new Date('2027-01-01T04:30:00Z')), {ano:2027,mes:0})
})
