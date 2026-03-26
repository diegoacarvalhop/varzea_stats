# Deploy no Railway com Docker (produção)

Este projeto deve ser publicado em **2 serviços Docker** no Railway:

1. `varzea-backend` (raiz de serviço: `backend`)
2. `varzea-frontend` (raiz de serviço: `frontend`)

E um banco **PostgreSQL** gerenciado pelo Railway.

Os arquivos `backend/railway.json` e `frontend/railway.json` já estão configurados para builder `DOCKERFILE`.

## 1) Banco PostgreSQL

- Adicione um serviço **PostgreSQL** no mesmo projeto Railway.
- Mantenha o nome de referência do plugin para usar as variáveis `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`.

## 2) Backend (`backend`) - Docker

### Variáveis obrigatórias

```env
SPRING_DATASOURCE_URL=jdbc:postgresql://${{Postgres.PGHOST}}:${{Postgres.PGPORT}}/${{Postgres.PGDATABASE}}
SPRING_DATASOURCE_USERNAME=${{Postgres.PGUSER}}
SPRING_DATASOURCE_PASSWORD=${{Postgres.PGPASSWORD}}

JWT_SECRET=troque-por-um-segredo-forte-com-32+-caracteres
FRONTEND_URL=https://${{varzea-frontend.RAILWAY_PUBLIC_DOMAIN}}
```

### Ajustes para Railway gratuito (evitar OOM)

No `varzea-backend`, adicione também:

```env
# JVM enxuta para container pequeno
JAVA_OPTS=-XX:MaxRAMPercentage=60 -XX:InitialRAMPercentage=15 -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError

# Pool de conexão menor (menos memória)
SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=2
SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=0
SPRING_DATASOURCE_HIKARI_IDLE_TIMEOUT_MS=60000
SPRING_DATASOURCE_HIKARI_MAX_LIFETIME_MS=600000

# Opcional: desligar OpenAPI em produção para reduzir consumo
SPRINGDOC_API_DOCS_ENABLED=false
SPRINGDOC_SWAGGER_UI_ENABLED=false

# Se SMTP não estiver configurado, evita falha no healthcheck
MANAGEMENT_HEALTH_MAIL_ENABLED=false
```

Observação:
- Se precisar usar Swagger em produção, mantenha `SPRINGDOC_*` como `true`.
- Se ainda houver pressão de memória, reduza `-XX:MaxRAMPercentage` para `50`.

### Bootstrap de usuário inicial (ADMIN_GERAL)

Se quiser criar o primeiro usuário automaticamente em produção, defina:

```env
VARZEA_BOOTSTRAP_ADMIN_ENABLED=true
VARZEA_BOOTSTRAP_ADMIN_EMAIL=admin@seu-dominio.com
VARZEA_BOOTSTRAP_ADMIN_PASSWORD=defina-uma-senha-forte
VARZEA_BOOTSTRAP_ADMIN_NAME=Administrador Geral
```

Importante:

- O bootstrap só cria o usuário se não existir conta com esse e-mail.
- Depois que o admin inicial estiver criado, recomenda-se desativar:

```env
VARZEA_BOOTSTRAP_ADMIN_ENABLED=false
```

- Senha padrão para usuários criados por administradores (opcional sobrescrever):

```env
VARZEA_USER_DEFAULT_PASSWORD=123456
```

### Logos da pelada (volume persistente)

Para não perder imagens de logo a cada deploy:

1. No serviço `varzea-backend`, abra **Volumes**.
2. Crie um volume (exemplo: `pelada-logos`) montado em:

```text
/app/data
```

3. Adicione as variáveis:

```env
VARZEA_PELADA_LOGO_DIR=/app/data/pelada-logos
VARZEA_PAYMENT_RECEIPT_DIR=/app/data/payment-receipts
```

O backend cria e usa esses diretórios dentro do container.

### Produção recomendada

```env
# Se já criou o admin inicial, mantenha false
VARZEA_BOOTSTRAP_ADMIN_ENABLED=false
```

### SMTP (opcional)

```env
SPRING_MAIL_HOST=smtp.seuprovedor.com
SPRING_MAIL_PORT=587
SPRING_MAIL_USERNAME=seu_usuario
SPRING_MAIL_PASSWORD=sua_senha
VARZEA_MAIL_FROM=noreply@seudominio.com
SPRING_MAIL_SMTP_AUTH=true
SPRING_MAIL_SMTP_STARTTLS_ENABLE=true
```

## 3) Frontend (`frontend`) - Docker

Defina no serviço `varzea-frontend`:

```env
VITE_API_URL=https://${{varzea-backend.RAILWAY_PUBLIC_DOMAIN}}
```

Observação: o frontend agora lê `VITE_API_URL` em **runtime** (arquivo `runtime-config.js` gerado no start do container), então você pode trocar a URL da API sem rebuild local.

## 4) Ordem de publicação

1. Suba o PostgreSQL.
2. Configure o backend e faça o primeiro deploy.
3. Confirme `https://SEU_BACKEND/actuator/health`.
4. Configure o frontend e faça deploy.
5. Se os domínios públicos forem criados após o primeiro deploy, faça um redeploy rápido em ambos para resolver as referências `${{...}}`.

## 5) Checklist de teste em produção

- Abrir o frontend e fazer login.
- Criar/editar usuário em `/admin/users`.
- Criar pelada com logo e validar persistência após novo deploy.
- Enviar comprovante (PDF/imagem) no financeiro como jogador e aprovar como Admin/Financeiro.
- Confirmar `GET https://SEU_BACKEND/actuator/health` com status `UP`.
- Validar nos logs do backend que passou de `Initialized JPA EntityManagerFactory` sem `Killed`.
- Monitorar por 10-15 minutos sem reinícios em loop.

## 6) Troubleshooting rápido (OOM)

- Se aparecer `Killed` durante startup:
  - Ajuste `JAVA_OPTS` para `-XX:MaxRAMPercentage=50 -XX:InitialRAMPercentage=10 -XX:MaxMetaspaceSize=96m -XX:+UseSerialGC -XX:+ExitOnOutOfMemoryError`.
  - Confirme `SPRINGDOC_API_DOCS_ENABLED=false` e `SPRINGDOC_SWAGGER_UI_ENABLED=false`.
  - Mantenha `SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE=2` e `SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE=0`.
- Se o backend ficar estável após ajuste, faça novo redeploy para consolidar as variáveis.

