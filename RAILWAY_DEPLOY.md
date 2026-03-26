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
FRONTEND_URL=https://SEU_FRONTEND.up.railway.app
```

### Logos da pelada (volume persistente)

Para não perder imagens de logo a cada deploy:

1. No serviço `varzea-backend`, abra **Volumes**.
2. Crie um volume (exemplo: `pelada-logos`) montado em:

```text
/app/data
```

3. Adicione a variável:

```env
VARZEA_PELADA_LOGO_DIR=/app/data/pelada-logos
```

O backend já cria e usa esse diretório dentro do container.

### Produção recomendada

```env
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
VITE_API_URL=https://SEU_BACKEND.up.railway.app
```

Observação: o frontend agora lê `VITE_API_URL` em **runtime** (arquivo `runtime-config.js` gerado no start do container), então você pode trocar a URL da API sem rebuild local.

## 4) Ordem de publicação

1. Suba o PostgreSQL.
2. Faça deploy do backend.
3. Confirme `https://SEU_BACKEND/actuator/health`.
4. Configure `VITE_API_URL` no frontend e faça deploy.
5. Atualize `FRONTEND_URL` no backend para a URL final do frontend.
6. Redeploy rápido do backend para refletir a URL final nos links de e-mail.

## 5) Checklist de teste em produção

- Abrir o frontend e fazer login.
- Criar/editar usuário em `/admin/users`.
- Criar pelada com logo e validar persistência após novo deploy.
- Abrir `https://SEU_BACKEND/swagger-ui.html`.
- Confirmar `GET https://SEU_BACKEND/actuator/health` com status `UP`.

