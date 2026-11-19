# Etapa 5 — CPF repetido e status personalizados (JavaScript)

## Escopo efetivamente implementado

1. CPF repetido na mesma data, empresa e horário **é permitido**; permanece a confirmação meramente informativa para CPF repetido dentro da mesma empresa e data, e o aviso de ocupação a partir do 6º atendimento no slot global. Não existe índice de unicidade de CPF. Cada envio com novo `operacao_id` cria um agendamento distinto, enquanto a repetição da mesma chave evita duplicação por timeout.
2. Administrador geral tem menu **Gerenciar Status**, com criação/edição, cor hexadecimal, ativo/inativo, origens permitidas e categoria **ATIVO**, **CONCLUIDO** ou **ENCERRADO**. Status ativos podem ocupar horário (configurável); concluídos/encerrados são terminais e programados para eliminação em 7 dias.
3. Seis status originais preservados. A Central permite filtrar/exibir personalizados e, no modal, aplicar status customizados autorizados a partir de AGENDADO, EM ATENDIMENTO ou REAGENDADO. Apenas os três perfis que já podiam registrar resultados podem aplicá-los. Um custom ATIVO pode avançar para EM ATENDIMENTO, DESBLOQUEADO ou CLIENTE NÃO ATENDEU, ou ser reagendado/cancelado por quem já tinha permissão.
4. Dashboard mantém **sete cards**: total (todos os status, inclusive customizados) + seis status originais individualizados. O filtro por status passa a incluir os customizados. Assim, em um período sem filtro, a soma dos seis cards pode ser **menor** que o total se houver registros em status personalizados.
5. Status personalizados usados por agendamentos não podem mudar nome, comportamento ou ocupação; status referenciados em estatísticas não podem ser renomeados. Desativá-los impede novas atribuições, mas mantém histórico/contagem.
6. Retenção: rotina `ieva_limpeza_retencao()` ampliada para concluir exclusão de registros customizados terminados. **A rotina não foi agendada automaticamente nesta entrega**; precisa de configuração/monitoramento do cron, testes de retenção e validação LGPD antes da produção.

## Instalação

1. Faça backup do seu banco **de desenvolvimento** antes da mudança e use o projeto Supabase de testes.
2. Já devem estar aplicadas em ordem as migrações `001`, `002`, `003` e `004` incluídas no diretório `supabase/migrations`.
3. No SQL Editor, execute **uma única vez** o arquivo `supabase/migrations/202611190005_status_personalizados.sql`. Ele inicia e conclui uma transação; caso haja falha, não continue com a interface antes de resolver o erro.
4. Atualize a pasta do frontend com o ZIP desta entrega. Na raiz `iev-avanca-js`, execute `npm install`, configure `.env` conforme o README e execute `npm run dev`.
5. Entre como Administrador geral e acesse **Gerenciar Status**. Cadastre um status de teste `AGUARDANDO DOCUMENTO`, `ATIVO`, com origem `EM ATENDIMENTO` e, opcionalmente, com ocupação do horário.
6. Entre na Central com usuário autorizado, abra agendamento EM ATENDIMENTO e aplique `AGUARDANDO DOCUMENTO`. O agendamento deve permanecer ativo e manter histórico. Depois teste voltar a EM ATENDIMENTO.

## Verificações recomendadas no Supabase de testes

- **Isolamento:** um Parceiro ou Desbloqueio não consegue invocar a RPC `ieva_salvar_status` com token próprio. Chamadas anônimas não podem consultar `status_personalizados`.
- **CPF:** cadastre dois agendamentos de mesmo CPF, no mesmo dia e horário e confirme ambos. Os IDs devem ser diferentes; retry com o mesmo `operacao_id` não deve criar outro ID.
- **Horário:** com cinco ocupações, registrar o sexto exige confirmação e não bloqueia. Configurar status custom ativo com `ocupa_horario=true` deve fazer com que a contagem o inclua.
- **Transições:** tentar usar status inativo como destino deve falhar; não sair de um concluído/encerrado; não escolher uma origem não autorizada; verificar histórico e notificações.
- **Indicadores:** criar e alterar status de uma reserva não muda o total do Dashboard; altera somente a distribuição entre status. O total inclui registros personalizados.
- **Retenção:** alterar um registro para status custom concluído deve definir `encerrado_em` e `excluir_apos` a sete dias; validar eliminação em ambiente isolado, com dados de teste e invocação administrativa da rotina. **Não execute exclusão em produção como teste.**
- **Corridas:** revalidar criação, mudança de status, reagendamento e cancelamento concorrentes antes de publicar.

## Limites desta entrega

- Não foi possível instalar dependências nem executar build Vite neste ambiente. Uma verificação de sintaxe JSX/JS foi concluída com parser local, mas **não equivale a compilação nem execução**.
- A migração não foi executada contra Supabase real; o SQL, suas políticas e sua execução exigem validação no banco de testes.
- **Não estão incluídos nesta entrega:** calendário mensal completo, geração criptografada de backup real, agendamento/monitoramento da limpeza automática por Cron, testes de carga ou restauração de backup.
- Para preservar integridade e evitar configurações arbitrárias perigosas, as transições personalizadas partem apenas de AGENDADO/EM ATENDIMENTO/REAGENDADO, e as categorias terminais têm retenção fixa de 7 dias. Expansões da matriz de transições precisam de tratamento explícito dos estados terminais.
