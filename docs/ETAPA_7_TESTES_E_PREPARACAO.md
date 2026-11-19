# Etapa 7 — Testes, estabilidade e preparação para implantação

**Base:** `IEV_Avanca_JS_Etapa_6_corrigida.zip`, que deriva do ZIP de Etapa 5 enviado pelo usuário com a correção de cores. Esta etapa não redefine as regras aprovadas.

## Entregas desta etapa

- `src/lib/statusCores.js`: extraiu a função pura de cores, com **o mesmo resultado** da correção da Etapa 5: texto `#RRGGBB`, borda `#RRGGBB80`, fundo `#RRGGBB26`. `src/lib/status.js` continua exportando `PADRAO` e `corInline`; importações existentes seguem funcionando.
- `src/lib/datas.js`: fornece o mês inicial do calendário em `America/Sao_Paulo`, mesmo em dispositivo com outro fuso.
- `tests/*.test.js`: testes automatizados de cores, data local, contratos mínimos de rotas e RPCs e existência das migrações anteriores.
- `.github/workflows/validacao.yml`: automação de `npm ci`, testes e build no GitHub Actions **quando o projeto for colocado em um repositório GitHub**.
- `npm run test` e `npm run check` no projeto.

## Instalação e checagem local

1. Faça cópia da pasta anterior e extraia este ZIP em outra pasta. **Não substitua seu `.env`**.
2. Rode `npm ci` com acesso à internet e Node.js 22 ou superior compatível com o projeto.
3. Execute `npm run test`. Os testes não se conectam ao Supabase.
4. Execute `npm run build` (ou `npm run check` para ambos).
5. Execute `npm run dev` e valide no seu Supabase **de desenvolvimento**.
6. Não há nova migração SQL na Etapa 7: mantenha as migrações 001–006 já aplicadas. Não execute migrações antigas novamente por engano.

## Matriz de validação no Supabase de desenvolvimento — registrar PASSOU / FALHOU

> A suíte automatizada não substitui testes de RLS, concorrência e infraestrutura. Use **dados fictícios**, empresas X e Y e contas de teste específicas. Não use CPF real.

| Teste | Resultado esperado |
| --- | --- |
| Parceiro X consulta Central | Vê X, não vê Y; não altera agendamento criado por outro Parceiro X |
| Admin empresa X | Gerencia parceiros de X; não cria perfil global nem altera Y |
| Desbloqueio | Vê X/Y, muda resultado, cancela e reagenda; não cria agendamento nem faz backup |
| Admin geral | Pode gerenciar empresas, usuários e status; backup exige autorização do serviço |
| Usuário/empresa desativado com token antigo | Consultas e RPCs são negadas pelo banco, não só pela interface |
| CPF repetido | Permite dois registros no mesmo dia e horário, mantendo alertas apenas informativos |
| Alta demanda | O sexto agendamento apresenta aviso e pode ser confirmado, sem limite de vagas |
| Concorrência | Duas confirmações no mesmo slot não perdem registros nem ignoram mudança da contagem |
| Repetição por timeout | Reenviar mesmo `operacao_id` não gera dois agendamentos |
| Horários | 09:00 e 09:15 aceitos; 09:10 e horários passados rejeitados |
| Cancelamento | Justificativa com menos de cinco letras rejeitada; com cinco aceita |
| Status personalizado | Cor aplicada ao texto/borda/fundo; transições e ocupação respeitam configuração no banco |
| Central/Calendário | Mostra mês inteiro autorizado; seleção de dia filtra tabela; paginação 25 |
| Dashboard | Somente perfis globais permitidos; total inclui personalizados, seis cards padrão permanecem |
| Notificações | Novo/reagendado somente Desbloqueio; cancelado/outros resultados somente Admin empresa |
| Expiração | DESBLOQUEADO/CANCELADO e CLIENTE NÃO ATENDEU elegíveis após sete dias, ativo não eliminado |
| Estatísticas | Permanecem agregadas sem dados pessoais após limpeza; não duplicam contagem |
| Backup | Somente Admin geral; dump validado, criptografado, download protegido |
| Restauração | Testar em **banco isolado**; conferir RLS, estrutura, dados e limites do Auth |

## Comandos de verificação no terminal

```bash
npm ci
npm run test
npm run build
npm run dev
```

## Cron e backup — condições para produção

- A migração 006 **não ativa** o cron automaticamente. Verifique `supabase/manual/ativar_cron_retencao.sql` e confirme fuso, agendamento, logs e política de eliminação antes de ativar.
- O serviço `backup-worker` exige hospedagem segura com ferramentas `pg_dump`/`pg_restore` compatíveis, HTTPS no proxy, credenciais apenas no servidor e política de armazenamento. Não o publique sem revisão de segurança.
- O backup preparado **não abrange automaticamente** credenciais e identidades completas de Supabase Auth, Storage, nem um procedimento restaurável de produção. Valide restauração com testes separados e documente a recuperação de usuários.
- O prazo de retenção de backup, entrega de senha provisória, conformidade LGPD e os resultados de testes de carga **continuam pendentes**.
- Testar cargas de 21, 35 e 50 usuários simultâneos e 500 agendamentos/dia; medir erros, latência e uso de Realtime. Este pacote **não executa** testes de carga no seu Supabase.

## O que realmente foi validado neste ambiente

- `npm test`: **7 testes passaram**.
- Arquivo ZIP e seu conteúdo foram checados.
- `npm ci --offline` **falhou por dependência ausente no cache** (`yallist`), então o build Vite e os testes integrados no Supabase **não foram executados** aqui.

## Etapa 8 (última, se a validação da Etapa 7 for aprovada)

Revisar falhas reais do teste, completar implantação do frontend/servidor de backup, validar RLS em contas de teste, recuperação de desastre/restore, revisão operacional LGPD, ativação controlada da retenção, carga e checklist de publicação. **Não tratar a Etapa 8 como simples botão de colocar no ar: só liberar produção após os critérios anteriores passarem.**
