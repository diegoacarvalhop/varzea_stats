# Operacao e Escalabilidade

## CI/CD
- Pipeline obrigatorio no GitHub Actions em `.github/workflows/backend-ci.yml`.
- Gates minimos: `compileJava` e `test`.
- Politica recomendada: merge em `main` somente com pipeline verde.

## Deploy e rollback
- Deploy deve ser feito em ambiente de homologacao antes de producao.
- Rollback de aplicacao: reimplantar imagem/tag anterior.
- Rollback de banco: usar migracoes de correcao (forward-only), evitando rollback destrutivo.

## Backup e retencao
- Banco: backup diario completo + WAL/incremental (quando disponivel).
- Retencao sugerida: 30 dias operacionais + 12 meses mensais.
- Arquivos de comprovantes: snapshot diario e retencao alinhada a regras fiscais.

## Observabilidade
- Correlation id via `X-Correlation-Id`.
- Endpoints de metricas habilitados (`/actuator/metrics`, `/actuator/prometheus`).
- Criar alertas para:
  - taxa de erro 5xx por endpoint;
  - latencia p95;
  - falhas de autenticacao;
  - falhas em aprovacao/rejeicao de comprovantes.

## Seguranca operacional
- Nao usar secrets em `application.properties` em producao.
- Forcar segredos por variavel de ambiente/secret manager.
- Revisar periodicamente permissoes de perfis `ADMIN`, `ADMIN_GERAL` e `FINANCEIRO`.
