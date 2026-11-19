# DOCUMENTO DE CONTINUIDADE — SISTEMA IEV AVANÇA
## Contexto completo para iniciar a programação em outro chat

**Versão:** 1.0 — 17/11/2026  
**Origem:** decisões tomadas ao longo da conversa de planejamento do Sistema de Agendamentos de Desbloqueio.  
**Objetivo deste arquivo:** servir como fonte única de contexto ao abrir um chat novo, sem necessidade de repetir as decisões.  
**Estado do projeto:** planejamento funcional, modelo lógico e direção visual definidos; **a implementação pode começar** no novo chat.  
**Idioma do projeto e das orientações:** português do Brasil (pt-BR).

> **INSTRUÇÃO PRIORITÁRIA AO ASSISTENTE DO NOVO CHAT**
>
> Você está assumindo a implementação do **Sistema IEV Avança — Agendamentos de Desbloqueio**. Leia **todo este arquivo** antes de sugerir arquitetura ou gerar qualquer código. As seções “Decisões confirmadas” são requisitos, não alternativas. **Não reabra escolhas já feitas** nem substitua o Supabase por Firebase. Preserve os quatro perfis, seis status, 12 regras, retenção de sete dias, backup manual exclusivo do Administrador geral, auditoria de sete dias, notificações por destinatário e identidade Dark Premium. Quando houver uma divergência entre exemplos antigos e decisões posteriores, **vale a decisão posterior**, conforme sintetizado aqui. A seção “Detalhes ainda não fechados” lista lacunas reais: escolha padrões seguros e explícitos ou pergunte somente quando bloquear a implementação. Programe por etapas, apresente os arquivos completos e instruções de execução, nunca finja ter executado o que não executou. Segurança e autorização devem existir **no PostgreSQL/Supabase**, não apenas nos botões da interface.

---

# A. VISÃO DO PRODUTO E ESCOPO

**Nome:** Sistema IEV Avança — Sistema de Agendamentos de Desbloqueio.  
**Referência visual:** https://connect.ievavanca.com.br/ — referência de organização visual e identidade corporativa; não copiar código nem presumir elementos exatos do site.  
**Público:** administradores da operação, administradores de empresas parceiras, parceiros individuais e equipe de Desbloqueio.  
**Finalidade:** permitir agendamentos de clientes para desbloqueio, controlar o atendimento, acompanhar tratativas/status, notificações internas, gestão de empresas/usuários, dashboard e backups administrativos.

**Escala planejada:** 51–100 empresas, até **500 agendamentos/dia**, estimativa de **21–50 usuários simultaneamente conectados**. Não é garantia de desempenho; realizar teste de carga.  
**Lançamento:** aplicação web responsiva, uso no desktop e celular.  
**Tecnologia escolhida:** **React** no frontend; **Supabase Free** no início, usando **Supabase Auth, PostgreSQL, RLS, Realtime** e agendamentos de tarefas com **Supabase Cron/pg_cron**, caso disponível e adequado ao plano. **Firebase foi substituído no planejamento; não usá-lo.**  
**Hospedagem frontend/domínio:** ainda não especificados. React com Vite/TypeScript e biblioteca visual são sugestões técnicas, não escolhas aprovadas pelo usuário.  
**Exportação operacional:** **NÃO** haverá exportação de agendamentos para Excel ou PDF; **backup administrativo manual é uma exceção específica** e protegida, não um botão genérico de exportação.

---

# B. AS 12 REGRAS FUNCIONAIS APROVADAS

## Regra 01 — Horários, lotação e aviso
- Horários de atendimento escolhidos livremente, respeitando **intervalos de 15 minutos** (`00`, `15`, `30`, `45`), sem grade fixa pré-cadastrada.
- Agendamento para data/hora **passada é proibido**; só momentos futuros em `America/Sao_Paulo`.
- **Avisar a partir do sexto agendamento** no mesmo dia e horário: ao tentar registrar o 6º, informar que já há cinco e pedir confirmação; igualmente avisar nas tentativas posteriores.
- **Nunca bloquear por lotação**: mesmo com seis ou mais o usuário pode confirmar.
- Na consolidação do planejamento, a contagem passou a ser tratada como **global entre empresas**, não apenas por empresa. Usar essa interpretação como base, mas notar na seção de pendências que a escolha “global” não foi respondida separadamente na pergunta original.
- Só contam como ocupação de horário os status **AGENDADO, EM ATENDIMENTO e REAGENDADO**. Não contar DESBLOQUEADO, CLIENTE NÃO ATENDEU ou CANCELADO. Ao reagendar, mover a ocupação do horário anterior para o novo.
- Há possibilidade de dois parceiros tentarem confirmar simultaneamente. A contagem deve ser **revalidada antes da gravação** com controle transacional/concorrência para não confirmar silenciosamente uma contagem defasada. A confirmação de alta demanda deve continuar **informativa**, sem teto rígido de vagas. Uma operação atômica deve ser capaz de indicar “confirmação adicional necessária” se a contagem mudou enquanto a pessoa estava no formulário, e depois aceitar a confirmação.

## Regra 02 — Quatro perfis de acesso
Exatamente **quatro** papéis:
1. **Administrador geral** — visão e administração globais.
2. **Administrador da empresa** — gerencia a própria empresa e os agendamentos dela.
3. **Parceiro** — visualiza todos os agendamentos de sua empresa, mas edita/cancela/reagenda **somente os próprios**.
4. **Desbloqueio** — vê todas as empresas e agendamentos, registra atendimentos/tratativas/resultados e também **pode reagendar e cancelar** (essa permissão foi ampliada expressamente após a primeira matriz).

## Regra 03 — Formulário de agendamento
Campos previstos:
- `nome completo do cliente`: obrigatório;
- `CPF`: obrigatório, com validação e normalização;
- `telefone/WhatsApp`: obrigatório, com máscara;
- `número da proposta`: obrigatório;
- `data` e `horário`: obrigatórios e futuros; horários de 15 em 15 minutos;
- `empresa`: preenchida/validada a partir do contexto do usuário; Administrador geral poderá selecionar a empresa, com permissão global;
- `responsável`: definido automaticamente conforme o usuário que cria;
- `observações`: **opcionais**.

**Uma proposta por agendamento** (isso não significa que o número da proposta seja globalmente único).  
Se o mesmo **CPF já tiver um agendamento na mesma data**, mostrar **alerta e permitir continuar**. Não bloquear duplicidade. Não expor dados de outra empresa em um alerta de duplicidade.  
O parceiro pode **reagendar até o atendimento ser concluído**, inclusive após CLIENTE NÃO ATENDEU, se o prazo de sete dias ainda não passou; não pode reabrir DESBLOQUEADO nem CANCELADO.

## Regra 04 — Os seis status oficiais
**Exatamente estes seis nomes**, sem inventar um sétimo:
1. **AGENDADO** — cadastrado, aguardando atendimento.
2. **EM ATENDIMENTO** — equipe iniciou a tratativa.
3. **DESBLOQUEADO** — desbloqueio realizado com sucesso (encerrado).
4. **CLIENTE NÃO ATENDEU** — o cliente não respondeu ao contato.
5. **REAGENDADO** — data e/ou horário alterado, preservando histórico.
6. **CANCELADO** — agendamento cancelado, sem apagar o histórico imediatamente.

**Cancelar sempre exige observação/justificativa de no mínimo cinco LETRAS**, inclusive quando a ação for do perfil Desbloqueio ou Administrador geral. Contar letras Unicode; números, espaços e pontuação não contam. Ao cancelar, conservar registro por sete dias (salvo eliminação administrativa autorizada).

**Resultado operacional** (EM ATENDIMENTO, DESBLOQUEADO, CLIENTE NÃO ATENDEU) pode ser atualizado por **Administrador geral**, **Administrador da empresa dentro da própria empresa** e **Desbloqueio** globalmente. Parceiro não pode definir resultados.  
**Reagendamento e cancelamento** são permitidos a: Admin. geral em todos, Admin. empresa nos da própria empresa, Parceiro nos que criou, Desbloqueio em todos.

**Transições definidas:**
| Atual | Pode ir para |
|---|---|
| AGENDADO | EM ATENDIMENTO, REAGENDADO, CANCELADO |
| EM ATENDIMENTO | DESBLOQUEADO, CLIENTE NÃO ATENDEU, REAGENDADO, CANCELADO |
| CLIENTE NÃO ATENDEU | REAGENDADO, CANCELADO |
| REAGENDADO | EM ATENDIMENTO, REAGENDADO, CANCELADO |
| DESBLOQUEADO | Terminal: nenhuma transição normal |
| CANCELADO | Terminal: nenhuma transição normal |

Ao ser reagendado, o registro **permanece com status REAGENDADO** até que o atendimento seja iniciado e passe a EM ATENDIMENTO. Nenhum novo agendamento deve ser criado no reagendamento normal. Guardar agendamento original e histórico de mudanças.

## Regra 05 — Central de Agendamentos
- Acesso dos quatro perfis, respeitando seus escopos de dados.
- Alternância na mesma Central entre **tabela e calendário**.
- **25 registros por página**, com paginação progressiva e consultas filtradas no banco.
- Busca por nome do cliente, CPF, número da proposta; filtros operacionais por período/data, empresa quando autorizada, responsável, status e horário.
- Detalhes do agendamento são mostrados em **janela modal**, sem navegar para página separada.
- Modal: dados do cliente, empresa, responsável, proposta, data/hora, status, observações, histórico cronológico com autor/data/hora, tratativas e ações conforme permissão.
- Exibir os **seis status individualmente**; destaque discreto para horários de alta demanda.
- **Sem exportação** Excel/PDF operacional.
- **Atualização em tempo real só na Central**, com assinaturas filtradas/privadas e consumo controlado. Outras telas usam consulta sob demanda; notificações não justificam abrir assinaturas globais irrestritas.

## Regra 06 — Empresas e usuários
- Empresa: identificação, nome, responsável, telefone, e-mail e `ativa/inativa`. **CNPJ não será cadastrado**.
- Cada Parceiro/Admin. empresa pertence a **exatamente uma empresa**; sem acesso multiempresa para eles. Admin. geral e Desbloqueio são perfis globais (sem vínculo obrigatório a empresa).
- **Administrador geral** cadastra e gerencia empresas e todos os perfis; só ele pode conceder perfis privilegiados.
- **Administrador da empresa** cadastra/gerencia **Parceiros da própria empresa**, sem poder elevar privilégios para Admin. geral ou Desbloqueio.
- Empresa inativa **bloqueia acessos e novos agendamentos**, mas mantém o histórico conforme a retenção.
- Usuário desativado perde operações e acesso operacional, preservando registros/auditoria enquanto a política permitir.
- **Agendamentos criados pelo Administrador da empresa ficam sob responsabilidade do próprio criador**; ele não seleciona outro parceiro como autor/responsável na criação.

## Regra 07 — Login e segurança
- Autenticação **e-mail + senha** via Supabase Auth.
- Administrador cria usuário com **senha provisória**. Primeiro acesso exige **troca obrigatória** antes das funcionalidades operacionais.
- **Sessão persistente**, mas autorização continuamente revalidada no banco (empresa ativa e usuário ativo), independentemente de token ainda válido.
- Não há cadastro público de empresas/usuários nem acesso anônimo aos registros.
- **Auditoria completa** de criação, edição, cancelamento, reagendamento, alteração de status e atos administrativos importantes.
- Não armazenar senhas em tabelas próprias, nem enviar senha provisória em texto puro para logs/histórico/backup em formato legível. Definir método seguro de entrega da senha provisória antes de publicar.
- Aplicar autorização **RLS, grants e rotinas protegidas no PostgreSQL**, não somente ocultar botões; serviço privilegiado/`service_role` jamais no frontend.

## Regra 08 — Dashboard Gerencial
- Acesso **somente** para **Administrador geral** e **Desbloqueio**; NÃO para Admin. empresa ou Parceiro.
- **Sete indicadores e somente os indicadores aprovados:** (1) Total de agendamentos + (2–7) quantidades individuais dos **seis status**. **Não adicionar obrigatoriamente** métricas de produtividade, ranking por empresa, taxa de desbloqueio ou painéis extras; esses itens foram apenas sugestões de design, rejeitados ao escolher “somente seis status + total”.
- Filtros: **período, empresa, responsável, status e horário**.
- Período calculado pela **data marcada para atendimento**, não pela data em que o registro foi criado.
- Os registros encerrados são eliminados após sete dias; portanto **preservar estatísticas históricas agregadas sem dados pessoais dos clientes**. Um agendamento conta uma vez no total e em somente um status corrente/final para seu período correspondente; não contar uma cadeia de transições como múltiplos agendamentos. Diferença entre “histórico consolidado” e “registros ainda consultáveis na Central” deve estar clara na UI.

## Regra 09 — Notificações
- **Somente dentro do sistema**, no sino; **sem e-mail, WhatsApp ou lembrete automático antes de atendimento**.
- **Novo agendamento:** avisar **somente usuários Desbloqueio**.
- **Reagendamento:** avisar **somente usuários Desbloqueio**.
- **Cancelamento:** avisar **somente o(s) Administrador(es) da empresa correspondente**.
- **Alterações de status:** avisar **somente o(s) Administrador(es) da empresa correspondente** (todas as mudanças de status operacionais).
- **Não criar notificações duplicadas**: eventos que são simultaneamente cancelamento e mudança de status geram um único aviso. Interpretação de precedência operacional: evento “novo” ou “reagendamento” usa seu destinatário específico (Desbloqueio), “cancelamento” usa Admin. empresa, outras mudanças de status usam Admin. empresa. Essa interpretação evita conflito entre as frases “reagendamento somente desbloqueio” e “todas as alterações de status para admin empresa”.
- Cada notificação identifica evento/agendamento, data/hora, empresa, tipo, destinatário, situação lida/não lida. Clique abre o registro somente se ainda existir e for autorizado; notificação de registro expirado não deve gerar erro/informação vazada.
- Ícone de sino pode existir na interface; **não inventar novos destinatários** para Administrador geral e Parceiro, que não foram incluídos na regra.

## Regra 10 — Telas e navegação
- **Menu lateral recolhível** no desktop e adaptado no mobile (drawer ou equivalente).
- **Tela inicial após login:** Dashboard para Admin. geral e Desbloqueio; Central para Admin. empresa e Parceiro.
- **Modal** para detalhes do agendamento.
- **Calendário integrado à Central**, alternância Tabela/Calendário.
- Menus adequados ao perfil. **Admin. geral:** Dashboard, Central, Novo Agendamento, Empresas, Usuários, **Backup do Sistema**, Minha Conta, sino/notificações sem quebrar destinatários aprovados. **Admin. empresa:** Central, Novo Agendamento, Usuários da empresa, Minha Conta, notificações. **Parceiro:** Central, Novo Agendamento, Minha Conta. **Desbloqueio:** Dashboard, Central, Minha Conta, notificações; histórico/tratativas dentro do modal.

## Regra 11 — Desempenho, concorrência e infraestrutura
- **Supabase Free** foi escolhido para desenvolvimento/testes, substituindo Firebase Spark.
- **Tempo real somente na Central**, paginação de **25** registros.
- Consulta otimizada com filtros e índices; evitar carregar todos os agendamentos de todas as empresas.
- Simultaneidade permitida, com **verificação consistente da contagem antes da confirmação** e armazenamento transacional.
- Avaliar uso de Broadcast/canais privados, mensagens mínimas e atualização de página/consulta filtrada, em vez de espalhar alterações com PII para todos os clientes.
- Confirmar limites e recursos **atuais** do Supabase Free antes de implementar funções dependentes de cota/planos. Durante a conversa foram citados como referência (não garantia imutável): banco ~500 MB, ~50 mil MAU, 200 conexões Realtime, 2 milhões de mensagens Realtime/mês, ~500 mil Edge Functions/mês, ausência de backups automáticos gerenciados no Free e possível pausa por inatividade.
- Testar efetivamente carga com **21, 35 e 50 usuários simultâneos** e **500 agendamentos/dia**. Operação comercial real só depois de validar capacidade, custos e recuperação.

## Regra 12 — Retenção, exclusão, auditoria e backup
- **DESBLOQUEADO:** elegível para exclusão automática **7 dias após conclusão**.
- **CANCELADO:** elegível para exclusão automática **7 dias após cancelamento**.
- **CLIENTE NÃO ATENDEU:** o Parceiro pode reagendar durante **7 dias**; se não reagendar, fica elegível para exclusão após sete dias da mudança de status.
- **AGENDADO, EM ATENDIMENTO, REAGENDADO:** não são excluídos automaticamente enquanto permanecem ativos.
- **Exclusão manual:** **exclusiva do Administrador geral, com justificativa obrigatória**. Diferenciar da exclusão automática prevista pela política de retenção.
- **Auditoria operacional:** guardar **7 dias** e então eliminar, ressalvadas obrigações legais/exceções legítimas documentadas. **Importante: sete dias não garantem por si só conformidade com a LGPD**. Não afirmar que o sistema é “100% LGPD” sem revisão apropriada.
- Excluir/agrupar corretamente histórico, tratativas e notificações relacionados ao agendamento expirado, evitando PII órfã e sem apagar contas/empresas.
- **Manter indicadores históricos agregados, sem dados pessoais dos clientes**, mesmo após exclusão dos registros operacionais.
- **Backup manual exclusivo na área do Administrador geral** (detalhes na seção F). O planejamento anterior de avaliar Blaze foi substituído pelo uso de Supabase Free e backup manual protegido; não depender do backup nativo pago.
- Em falhas de salvamento, mostrar erro adequado e permitir **nova tentativa segura**, verificando se a primeira gravação foi realizada antes de repetir; chave de idempotência.

---

# C. MATRIZ DE PERMISSÕES DEFINITIVA

**Legenda:** Global = todas as empresas; Empresa = apenas empresa vinculada; Próprios = apenas registros criados pelo usuário; Não = negado.

| Operação | Admin. geral | Admin. empresa | Parceiro | Desbloqueio |
|---|---|---|---|---|
| Ver agendamentos | Global | Empresa | Empresa | Global |
| Criar agendamentos | Global | Empresa | Empresa | Não |
| Editar dados cadastrais do agendamento | Global | Empresa | Próprios | Não |
| Reagendar | Global | Empresa | Próprios | Global |
| Cancelar (≥5 letras) | Global | Empresa | Próprios | Global |
| Marcar EM ATENDIMENTO | Global | Empresa | Não | Global |
| Marcar DESBLOQUEADO | Global | Empresa | Não | Global |
| Marcar CLIENTE NÃO ATENDEU | Global | Empresa | Não | Global |
| Registrar tratativas | Global | Empresa | Não | Global |
| Consultar histórico de agendamentos | Global | Empresa | Empresa | Global |
| Dashboard gerencial | Sim | Não | Não | Sim |
| Criar/editar empresas | Sim | Não | Não | Não |
| Criar/gerenciar parceiros | Global | Empresa | Não | Não |
| Criar admins empresa/Desbloqueio | Sim | Não | Não | Não |
| Elevar perfis privilegiados | Sim | Não | Não | Não |
| Exclusão manual agendamento | Sim, justificando | Não | Não | Não |
| Backup manual | Sim | Não | Não | Não |
| Consultar auditoria global | Sim | Não | Não | Não |

Observações:
- Desbloqueio **pode cancelar e reagendar globalmente**, conforme última confirmação do usuário; matrizes mais antigas que negam essas duas ações estão desatualizadas.
- Parceiro vê os agendamentos da empresa, mas **só modifica os criados por ele**.
- Autor original/responsável do cadastro deve ser registrado de forma imutável; quando Admin. empresa cria, ele próprio é o responsável.
- Admin. geral e Desbloqueio podem ter `empresa_id` nulo no seu perfil de usuário, por serem globais. Ao criar agendamento, Admin. geral escolhe empresa de destino de forma autorizada.

---

# D. MODELO DE DADOS LÓGICO — POSTGRESQL/SUPABASE

**Base:** 10 tabelas de aplicação já previstas, mais estruturas gerenciadas pelo Supabase Auth. Os nomes abaixo são sugestão de contrato inicial; manter consistência entre SQL, tipos e interface. Não há código preexistente que precise ser preservado.

## D1. `empresas`
- `id` UUID PK
- `nome` texto obrigatório
- `responsavel_nome` texto opcional
- `telefone` texto opcional
- `email` texto opcional
- `ativa` booleano (padrão verdadeiro, conforme fluxo administrativo)
- `criado_em`, `atualizado_em` timestamps com fuso
- `criado_por` UUID FK/autor
- **Sem CNPJ**.

## D2. `usuarios`
- `id` UUID PK e FK para `auth.users.id`
- `empresa_id` UUID FK opcional (obrigatório para Admin. empresa/Parceiro, nulo para papéis globais)
- `nome`, `email` textos
- `perfil` com quatro valores controlados (`ADMIN_GERAL`, `ADMIN_EMPRESA`, `PARCEIRO`, `DESBLOQUEIO`)
- `ativo` booleano
- `troca_senha_pendente` booleano
- `criado_em`, `atualizado_em`, `criado_por`
- Proibir autoelevação de papel e troca arbitrária de empresa. Contas criadas por rotina administrativa privilegiada. Segredos/senhas **não** ficam aqui.

## D3. `agendamentos`
- `id` UUID PK
- `empresa_id` UUID FK
- `responsavel_usuario_id` UUID FK — **quem criou / responsável original**, inclusive Admin. empresa
- `criado_por_usuario_id` UUID FK — pode coincidir com responsável e preserva autoria
- `cliente_nome`, `cliente_cpf` normalizado, `cliente_telefone`, `numero_proposta` (obrigatórios)
- `data_atendimento` DATE e `hora_atendimento` TIME (ou equivalente seguro com timezone)
- `status` enum/constraint com seis valores
- `observacoes` texto opcional
- `criado_em`, `atualizado_em` timestamps com fuso
- `encerrado_em`, `excluir_apos` timestamps opcionais
- `operacao_id` UUID único — idempotência de criação
- `versao` inteiro — controle de atualizações concorrentes
- Observação importante: o projeto lógico antigo usou o nome `parceiro_id`; **não usar esse nome exclusivamente**, pois Admin. empresa também pode ser o responsável. Preferir `responsavel_usuario_id`.
- Restrição de horário a múltiplos de 15 minutos, CPF válido e transição de status autorizada por operação protegida.

## D4. `historico_agendamentos`
- `id` UUID PK, `agendamento_id` FK, `usuario_id` FK
- `tipo_evento` criação/edição/reagendamento/status/cancelamento
- `dados_anteriores` e `dados_novos` JSONB **mínimos/selecionados** (não duplicar CPF/telefone integralmente sem necessidade)
- `justificativa` opcional, `criado_em`
- Escrita automática/protegida; leitura conforme visibilidade do agendamento; sem edição comum.

## D5. `tratativas`
- `id` UUID PK, `agendamento_id` FK, `usuario_id` FK
- `observacao` texto, `criado_em`
- Registros cronológicos, sem reescrita livre; correções como novo lançamento referenciado.

## D6. `notificacoes`
- `id` UUID PK, `destinatario_id` FK, `empresa_id` FK
- `agendamento_id` FK nullable ao eliminar agendamento
- `tipo_evento`, `titulo`, `mensagem` mínimos sem PII desnecessária
- `evento_id` UUID, `lida_em`, `criado_em`
- Regra de unicidade `(evento_id, destinatario_id)` para deduplicação.
- Destinatário só lê/marca sua própria notificação, e só acessa dados de agendamento ainda autorizados.

## D7. `auditoria`
- `id` UUID PK, `usuario_id` FK nullable, `empresa_id` nullable
- `tipo_acao`, `recurso_tipo`, `recurso_id` UUID nullable
- `justificativa` texto opcional (obrigatório na exclusão manual)
- `resultado`, `criado_em`
- Retenção **sete dias**; não preservar cópias de CPF e telefone sem necessidade; proteger contra alterações pelo cliente.

## D8. `estatisticas_diarias`
- `id` UUID PK
- `data_referencia` DATE (**data marcada para atendimento**)
- `empresa_id` UUID
- `responsavel_usuario_id` UUID (dimensão para filtro de responsável; observar minimização)
- `hora_atendimento` TIME/slot (dimensão para filtro por horário)
- `status` valor controlado
- `quantidade` INTEGER não negativo, `atualizado_em`
- Unicidade da combinação de dimensões (`empresa, data, responsável, horário, status`), com desenho de NULL consistente.
- **PONTO ESSENCIAL:** uma versão anterior dessa tabela tinha apenas `empresa_id + data + status`. Isso **não sustenta** os filtros históricos aprovados de responsável e horário após a exclusão dos agendamentos. Adicionar essas dimensões ou adotar estratégia equivalente sem reter dados pessoais dos clientes.
- Contadores agregados devem ser atualizados quando o agendamento muda de **data/horário/status/responsável**. Cada agendamento conta apenas uma vez na sua combinação atual/final, mesmo após eliminação de sua linha pessoal. Pequenos agrupamentos podem exigir medidas de privacidade.

## D9. `configuracoes`
- `id` UUID, `chave` única, `valor` JSONB validado, `atualizado_por`, `atualizado_em`
- Parâmetros iniciais: `intervalo_minutos=15`, `limiar_aviso=5` existentes (avisar novo 6º), `retencao_dias=7`, `paginacao=25`, `timezone=America/Sao_Paulo`.
- **Permissões de acesso e regras de segurança não são valores configuráveis livremente pela interface.**

## D10. `operacoes_administrativas`
- `id` UUID, `tipo_operacao`, `solicitante_id`, `recurso_id` opcional
- `justificativa` quando aplicável, `situacao` (`SOLICITADA`, `EXECUTADA`, `FALHOU` ou equivalente)
- `criado_em`, `concluido_em`, identificador de resultado
- Usar para fluxo controlado de criar usuário, alterar perfil, exclusão manual, geração de backup e logs de operações; **nunca** armazenar senha provisória em texto claro.

### D11. Relações e integridade
- Empresa 1:N Usuários; Empresa 1:N Agendamentos.
- Usuário 1:N Agendamentos criados; Agendamento 1:N Histórico e Tratativas; Usuário 1:N Notificações recebidas.
- Não permitir mudar `empresa_id`/`responsavel_usuario_id` do agendamento livremente após criação.
- Desativar empresa/usuário, **não apagar em cascata** a operação inteira.
- Exclusão de agendamento precisa lidar conscientemente com históricos/tratativas/notificações sem deixar PII órfã; agregados ficam preservados.

### D12. Índices candidatos
- `(data_atendimento, hora_atendimento, status)` para ocupação global.
- `(empresa_id, data_atendimento, hora_atendimento)` para Central por empresa.
- `(empresa_id, data_atendimento, status)` para filtros.
- `(responsavel_usuario_id, data_atendimento)` para próprios/filtros.
- `(cliente_cpf, data_atendimento)` para verificação de duplicidade (consulta protegida e sem exposição de outra empresa).
- `(empresa_id, numero_proposta)` para busca.
- `(excluir_apos)` para retenção.
- `(agendamento_id, criado_em)` em histórico/tratativas.
- `(destinatario_id, lida_em, criado_em)` em notificações.
- Índices das dimensões de `estatisticas_diarias` conforme filtros. Avaliar `EXPLAIN ANALYZE`, não criar indiscriminadamente.

---

# E. SEGURANÇA, AUTORIZAÇÃO E TRANSAÇÕES

## E1. RLS e privilégios
- `anon` **sem acesso** a empresas/usuários/agendamentos/dados de clientes.
- `authenticated` com RLS em todas as tabelas acessíveis, complementada por `GRANT` mínimos.
- Usuário da própria empresa não deve consultar dados de outra empresa, salvo Admin. geral/Desbloqueio nas capacidades globais respectivas.
- A autorização deve buscar perfil, `ativo`, `empresa_id` e situação da empresa **no banco**, não confiar em campos arbitrários do cliente ou metadados editáveis do token.
- Operações privilegiadas via RPC segura ou serviço backend/Edge Function com verificação robusta, sem expor `service_role` ao React. Separar funções elevadas, validar `search_path`/execuções e testar bypass de RLS.
- Proteção contra enumeração/exposição cross-tenant em CPF duplicado e contagem global: devolver apenas resultados mínimos autorizados.
- RLS em dados não equivale a RLS em eventos Realtime: proteger assinaturas/canais, evitar PII em payloads globais.
- Conta desativada ou empresa inativa deve perder operações **mesmo com sessão já autenticada**.

## E2. Operações atômicas
- `criar_agendamento`: validar sessão/permissão, empresa, futuro, intervalo, CPF; consultar contagem atual global e duplicidade; sinalizar avisos e confirmar explicitamente; inserir registro + histórico + notificações + estatística de maneira consistente, com `operacao_id` idempotente.
- `reagendar`: validar transição e futuro; manter id, atualizar horário, status REAGENDADO, histórico, notificações e agregados antigos/novos em uma única transação; atualizar versão.
- `cancelar`: validar papel/dono, transição e justificativa Unicode ≥5 letras; mudar status; definir retenção; histórico, notif e estatísticas consistentes.
- `atualizar_resultado`: somente papéis autorizados; transições restritas; sem alterações silenciosas de autor/empresa.
- `registrar_tratativa`: criar linha imutável por usuário autorizado.
- Corridas: controle otimista por `versao` e/ou bloqueio transacional/advisory lock para horário; sem prometer que UI com conferência prévia é suficiente para concorrência. A decisão de mostrar aviso da sexta vaga pode ser retornada pelo servidor e exigir nova confirmação se mudar o cenário.
- Testar idempotência ao salvar com timeout/resposta perdida.

## E3. Retenção
- Rotina agendada pelo PostgreSQL/Cron quando suportado pelo plano, em lotes, com log de sucesso/falha e monitoramento.
- `DESBLOQUEADO`, `CANCELADO`, `CLIENTE NÃO ATENDEU` sem reagendamento: 7 dias a partir de cada evento aplicável.
- Reagendamento remove a elegibilidade de eliminação daquele evento antigo.
- Auditoria 7 dias; tratar excepcionalidades legais por política/documentação, não ignorá-las.
- Dados de backup também têm retenção própria: definir prazo máximo operacional (7 dias foi recomendado para cópias, **não explicitamente aprovado**). Restaurar backup não deve ressuscitar dados que já precisavam estar eliminados.

---

# F. MÓDULO OBRIGATÓRIO: BACKUP MANUAL DO ADMINISTRADOR GERAL

**Requisito confirmado pelo usuário:** criar uma área **“Backup do Sistema”** no menu do **Administrador geral**, com geração de **backup manual**. Outros perfis não veem nem conseguem acessar por URL/API. É **exceção** ao veto de exportação da Central.

**Tela esperada:** cabeçalho, explicação, status do último backup, horário/resultado, ação **“Gerar backup manual”**, confirmação e, após concluído, download autorizado do arquivo. Não mostrar êxito se não houve cópia válida.

**Objetivo do backup:** recuperar, quando viável, a aplicação e o banco: dados de empresas, usuários/perfis, agendamentos ativos e ainda retidos, históricos, tratativas, notificações, estatísticas e configurações; estrutura SQL, índices, funções e RLS; considerar especificamente restauração de identidades do Supabase Auth. **Não prometer cópia/recuperação automática integral de credenciais Auth sem testar capacidade real do método**; senhas nunca aparecem legíveis.

**Implementação arquitetural exigida:**
1. Administrador autenticado solicita backup e revalida autorização no servidor.
2. Um serviço protegido (não o navegador React) executa ferramenta de dump PostgreSQL/Supabase, em ambiente confiável, com credenciais seguras; pode exigir serviço externo, mesmo usando Supabase Free.
3. Verificar integridade; **criptografar** arquivo; criar registro de execução (pode usar `operacoes_administrativas`).
4. Disponibilizar download temporário autenticado apenas para Admin. geral; armazenar cópia separada do próprio banco quando necessário.
5. Definir política de validade, descarte, chave criptográfica e acesso. Backup contendo CPF/telefone exige controle rígido.
6. **Restauração** é processo separado, sujeito a teste e confirmação reforçada; **não criar botão de restauração irrestrita** que substitua produção com um clique.
7. Documentar como restaurar, inclusive supostos limites do Supabase Free. O recurso **não existe pronto como um botão nativo do frontend Supabase**.

**Observação:** a regra de auditoria de 7 dias continua, e os arquivos de backup não podem ser mantidos indiscriminadamente. Estratégia exata para armazenamento/serviço de geração e retenção das cópias é uma das poucas decisões operacionais ainda a concretizar.

---

# G. IDENTIDADE VISUAL E TELAS

## G1. Direção confirmada
- **Dark Premium** com **densidade equilibrada**, visual corporativo elegante, inspirado na organização do Connect.
- Menu lateral recolhível desktop; drawer no celular.
- Topbar com página/título, sino quando aplicável, usuário e sair.
- Cards elevados com borda discreta, contraste alto, tipografia sans-serif legível (Inter foi sugerida; fonte exata não é obrigatória).
- Cores dos seis status **fixas por categoria**: AGENDADO azul, EM ATENDIMENTO amarelo/dourado, DESBLOQUEADO verde, CLIENTE NÃO ATENDEU vermelho, REAGENDADO roxo, CANCELADO cinza.
- Paleta **ilustrativa** da prévia escolhida (não branding oficial obrigatório): sidebar `#111827`, fundo `#202B3C`, acento `#6885F6`, texto `#F4F7FC`; cards escuros intermediários; status aprox.: azul `#2877CD`, dourado `#C58A22`, verde `#21885B`, vermelho `#CB5148`, roxo `#8664C7`, cinza `#778494`.

## G2. Tela Login
- Layout Dark Premium; no desktop, área institucional com identidade IEV Avança e cartão de login à direita ou equivalente visual limpo; no celular, foco no formulário.
- Campos e-mail/senha, Entrar, Esqueci minha senha (fluxo a configurar), orientação de senha provisória; primeira sessão exige troca de senha.
- Não disponibilizar autorregistro público.

## G3. Dashboard
- Somente Admin. geral/Desbloqueio, inicial após login nesses perfis.
- Filtros período, empresa, responsável, status e horário; por **data do atendimento**.
- Cards: total + seis status, apenas. Uso de gráfico simples exibindo **os mesmos indicadores** pode ser decisão de UX, mas **não transformar sugestões de produtividade/ranking/taxa em requisitos**.
- Dados fictícios em mockups nunca são dados reais.

## G4. Central
- Inicial para Admin. empresa/Parceiro; disponível a todos.
- Cabeçalho e botão Novo Agendamento para quem tem permissão.
- Busca/filtros, alternância Tabela/Calendário, tabela com data, hora, cliente, CPF, telefone, proposta, empresa, responsável, status e ações, com adaptações responsivas e proteção de PII.
- Paginação 25; modal de detalhes, edição/status/cancelamento/reagendamento/tratativas conforme perfil.
- Calendário integrado, datas/slots de 15 minutos; vistas dia/semana foram **sugeridas visualmente, não fixadas como regra**.
- Sem exportação de agendamentos; sem dashboard gerencial para Parceiro/Admin. empresa.

## G5. Demais telas
- Novo Agendamento: formulário da Regra 03 e avisos da Regra 01.
- Empresas: Admin. geral, cadastro/ativação/desativação sem CNPJ.
- Usuários: Admin. geral global, Admin. empresa só Parceiros da sua empresa, senha provisória e ativação/desativação.
- Backup do Sistema: Admin. geral exclusivamente.
- Minha Conta: dados próprios, segurança e sair.
- Notificações: sino interno conforme destinatários da Regra 09.

---

# H. CENÁRIOS DE ACEITAÇÃO OBRIGATÓRIOS

**Permissões e isolamento**
1. Parceiro A da Empresa X vê os agendamentos da X, mas não da Y; não pode editar um agendamento de outro Parceiro da X.
2. Admin. empresa da X gerencia registros e Parceiros da X, nunca da Y; não pode criar perfil Admin. geral/Desbloqueio.
3. Desbloqueio vê X e Y, atualiza status, **cancela e reagenda** ambas, mas não altera dados cadastrais nem gera backup.
4. Apenas Admin. geral vê o módulo de backup e consegue executar sua rotina no servidor.
5. Usuário/empresa inativa não consegue operar usando sessão previamente iniciada.
6. Acesso direto à API/URL por perfil não autorizado falha no banco, mesmo quando o botão estiver oculto.

**Agendamentos**
7. Horários como 09:00/09:15/09:30/09:45 aceitos; 09:10 rejeitado; horário passado rejeitado.
8. Quinta marcação no slot sem alerta de excesso; sexta e posteriores exigem confirmação informativa e **são permitidas**.
9. Dois usuários podem confirmar o mesmo slot simultaneamente sem perder registros, sem bloquear limite e sem apresentar contagem enganosa se ela mudou.
10. CPF duplicado na mesma data produz aviso, mas permite confirmar.
11. Se resposta ao salvar se perder e usuário tentar de novo, `operacao_id` evita duplicação.
12. Reagendar preserva ID do agendamento, registra antigo/novo horário, move ocupação do slot e emite aviso só ao Desbloqueio.

**Status**
13. As seis situações e matriz de transições funcionam exatamente como definida; DESBLOQUEADO e CANCELADO não reabrem normalmente.
14. Parceiro não pode marcar DESBLOQUEADO nem CLIENTE NÃO ATENDEU.
15. Cancelamento com “1234” ou “a b” é rejeitado; justificativa com cinco letras é aceita por qualquer perfil autorizado.
16. CLIENTE NÃO ATENDEU pode ser reagendado por Parceiro dono durante sete dias; não após eliminação.
17. Mudanças de status não contam um agendamento múltiplas vezes no total.

**Notificações e dashboard**
18. Novo/reagendamento -> apenas Desbloqueio; cancelamento/outras mudanças de status -> apenas Admin. empresa daquela empresa; sem duplicidade por evento.
19. Dashboard não é acessível a Parceiro/Admin. empresa, e filtra por data de atendimento.
20. Mesmo após exclusão dos clientes, indicadores agregados continuam sem nome, CPF ou telefone e respeitam filtros de data/empresa/responsável/horário/status.

**Retenção e backup**
21. Agendamento DESBLOQUEADO/CANCELADO some da operação ao ser eliminado após sete dias, e registros dependentes seguem a política.
22. CLIENTE NÃO ATENDEU sem reagendamento fica elegível para exclusão após sete dias; com reagendamento, reinicia fluxo ativo.
23. Auditoria operacional expira após sete dias, com ressalvas legais documentadas.
24. Admin. geral pode pedir exclusão manual somente justificando; todos os demais não podem.
25. Backup iniciado pelo Admin. geral só pode ser produzido por serviço protegido, tem arquivo íntegro/criptografado, registro de resultado e download autorizado; perfil não autorizado não recebe arquivo nem acesso à operação.
26. Recuperação de backup é testada em ambiente separado e não ressuscita indevidamente dados já eliminados.

**Desempenho**
27. Central lista em páginas de 25 e mantém dados autorizados atualizados em tempo real, sem subscrição indiscriminada global.
28. Testes representativos com 21/35/50 conexões simultâneas e até 500 novos agendamentos/dia; coletar volume de mensagens Realtime, consultas, latência, espaço e custo.

---

# I. CONFLITOS HISTÓRICOS RESOLVIDOS / O QUE NÃO FAZER

Este tópico é essencial: ao longo do planejamento surgiram várias **sugestões descartadas ou sobrescritas**.

- **NÃO usar Firebase**: a escolha posterior foi **Supabase Free**.
- **NÃO criar somente três perfis**: foram confirmados **quatro**.
- **NÃO bloquear o 6º agendamento**: sempre **alertar e permitir**.
- **NÃO usar intervalos de cinco minutos**: escolha final **15 minutos**, com horário livre.
- **NÃO impedir CPF duplicado**: apenas avisar e permitir.
- **NÃO criar status “NÃO REALIZADO”**: substituído por **CLIENTE NÃO ATENDEU**.
- **NÃO impedir Desbloqueio de reagendar/cancelar**: autorização final **PERMITE** ambos globalmente.
- **NÃO exibir Dashboard para Admin. empresa/Parceiro**: restrito a Admin. geral e Desbloqueio.
- **NÃO incluir exportação Excel/PDF na Central**: proibida; exceção apenas backup administrativo manual.
- **NÃO impor backups automáticos pagos** como requisito imediato: plano Free e **backup manual** na área de Admin. geral.
- **NÃO reter auditoria indefinidamente ou por 90 dias como padrão**: usuário escolheu **7 dias**; fazer ressalvas legais sem alterar unilateralmente o prazo.
- **NÃO apagar estatísticas com dados pessoais** junto do agendamento: preservar agregados anonimizados/sem identificação individual.
- **NÃO atribuir a outro Parceiro os agendamentos criados pelo Admin. empresa**: responsável é ele próprio.
- **NÃO obrigar observações gerais no cadastro**: são opcionais; **somente cancelamento exige mínimo cinco letras na justificativa**.
- **NÃO adicionar push/e-mail/WhatsApp/lembrete**: notificações só no sino, sem lembretes.
- **NÃO criar indicadores extras de produtividade, ranking e taxas** no dashboard sem nova aprovação; são sugestões visuais anteriores, não requisitos funcionais.
- **NÃO confundir “uma proposta por agendamento” com restrição global de número de proposta único**.
- **NÃO confundir auditoria (7 dias) com backup**: são recursos diferentes e precisam de retenção/segurança próprias.
- **NÃO declarar que o prazo de 7 dias garante conformidade legal por si só**; cumprir LGPD exige mais que retenção curta.

---

# J. DETALHES QUE AINDA NÃO FORAM EXPRESSAMENTE DECIDIDOS

**Estes pontos NÃO autorizam alterar as 12 regras.** Podem ser preenchidos por convenções técnicas seguras e informadas, ou perguntar pontualmente ao usuário se forem decisivos:

1. **Escopo da verificação de CPF duplicado:** global a todas as empresas ou restrita à empresa? A conversa fixou “mesmo CPF na mesma data, avisar e permitir”, mas não escolheu separadamente o escopo. A contagem de lotação foi consolidada como global; tratar essas decisões separadamente. Proteger privacidade de dados cross-tenant.
2. **Globalidade do alerta de lotação:** tratada como global nas especificações posteriores, sem seleção explícita de “global” na primeira pergunta. Implementar como global seguindo a especificação consolidada ou confirmar se houver dúvida, sem mudar silenciosamente.
3. **Janela de atendimento comercial:** horários livres a cada 15 minutos, sem horário de funcionamento definido (ex.: 08–18h), sem dias proibidos, feriados, prazo máximo futuro ou restrição aos finais de semana. Não inventar janela de atendimento sem perguntar.
4. **CPF duplicado em registros CANCELADOS/DESBLOQUEADOS:** o usuário não especificou quais status entram na verificação de duplicidade; escolher critério coerente e documentá-lo.
5. **Conflito de evento/status nas notificações:** aplicar a precedência indicada acima, pois “reagendamento só Desbloqueio” e “todas mudanças de status ao admin empresa” se sobrepõem semanticamente.
6. **Método seguro de entrega de senhas provisórias**, política de força de senha, fluxo de recuperação de conta e eventual SMTP próprio.
7. **Serviço externo para gerar backup real**, local seguro de armazenamento, prazo de guarda e rotação de chaves, custos possíveis, procedimento de restauração Auth; nenhuma dessas decisões foi fechada com um fornecedor específico.
8. **Ajuste de estatísticas em exclusão administrativa:** a regra aprovada é preservar totais históricos após exclusão, mas em caso de registro claramente errado pode ser necessário procedimento de correção auditada sem distorcer indicadores.
9. **Design detalhado das telas** além do estilo Dark Premium escolhido: login de duas colunas, gráficos e vistas de calendário foram sugestões, não mockups aprovados pixel a pixel.
10. **Hospedagem frontend, domínio, biblioteca UI e padrão JS/TS** não decididos; priorizar opções simples e gratuitas quando viável.
11. **Responsável pelo tratamento de dados/LGPD** e regras especiais de eliminação por solicitação do titular, incidentes e retenção legal devem ser documentados antes da produção. Não afirmar conformidade automática.
12. **Plano de desastre, backup e operações em Supabase Free:** cota, cron, rotinas de server e disponibilidade devem ser verificadas na documentação atual e testadas no projeto real.

---

# K. COMO COMEÇAR A PROGRAMAR NO NOVO CHAT

**O usuário agora quer implementar**, não continuar a série infinita de perguntas de planejamento. A menos que algo bloqueie segurança ou execução, sugerir uma ordem objetiva e **começar a entregar código funcional** com instruções passo a passo.

**Etapa 1 — Repositório e projeto:** propor estrutura React (idealmente Vite + TypeScript se usuário não tiver preferência), estilos Dark Premium e preparação de variáveis de ambiente. Guiar criação de conta/projeto Supabase Free e configuração local sem pedir chaves secretas em público.

**Etapa 2 — Banco e RLS primeiro:** elaborar migrações SQL **completas e executáveis** para as 10 tabelas, relacionamentos, constraints, índices essenciais, funções de verificação de perfil/empresa, RLS, grants e rotinas transacionais de criação/status/cancelamento/reagendamento e estatísticas. Evitar políticas recursivas ou grants excessivos. Testar por perfis.

**Etapa 3 — Auth e administração:** login, senha provisória, troca obrigatória, sessões persistentes com revalidação, empresa/usuário ativo, CRUD de empresas/Parceiros por perfis adequados.

**Etapa 4 — Fluxo operacional:** Central 25 por página com tabela/calendário, novo agendamento, alertas da sexta marcação e CPF, modal de detalhes, seis status, tratativas, histórico e notificações internas.

**Etapa 5 — Dashboard e agregação:** sete cards, filtros aprovados, resumo sem dados de cliente após exclusão, testes de recontagem sob reagendamentos.

**Etapa 6 — Retenção e backup manual:** Cron 7 dias; tela de backup Admin. geral; executor seguro externo/servidor, criptografia, integridade, download protegido; documentação e teste de restauração. **Não simular backup completo com JSON baixado pelo navegador e chamar isso de backup integral**.

**Etapa 7 — Testes e implantação:** cenários do item H, testes de capacidade/custos, teste de segurança RLS, backup/restauração e revisão LGPD.

**Formato recomendado das respostas de programação:** explicar brevemente a etapa, apresentar **arquivos inteiros e local de cada arquivo**, comandos de instalação/execução, parâmetros de configuração, migrações e verificações, sem inventar resultados de teste. Pedir ao usuário somente os dados realmente imprescindíveis. Não usar snippets do Firebase do projeto antigo.

---

## PROMPT CURTO QUE PODE SER ENVIADO JUNTO COM ESTE ARQUIVO

> Vamos implementar do zero o **Sistema IEV Avança — Agendamentos de Desbloqueio**. Estou anexando o documento **“DOCUMENTO DE CONTINUIDADE — SISTEMA IEV AVANÇA”**, que consolida todas as regras, perfis, status, banco, retenção, segurança, notificações, backup manual e identidade visual Dark Premium aprovados em outro chat. **Leia o arquivo inteiro e trate-o como especificação principal.** Não utilize Firebase; o projeto usará React + Supabase Free/PostgreSQL/Auth/RLS/Realtime/Cron. Comece pelo plano de arquivos e pela configuração segura do projeto e do banco, e avance para código completo por etapas. Não altere regras já confirmadas; identifique e sinalize somente as poucas lacunas reais listadas no documento. Oriente-me passo a passo como executar e testar tudo.

**FIM DO DOCUMENTO.**
