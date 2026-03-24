# VARzea Stats — Backend

API REST em **Spring Boot 3** (Java 17), **Gradle** (`./gradlew`), **PostgreSQL 15**, **JWT**, **RBAC**, **SpringDoc (Swagger)** e **Actuator** (health / probes).

O backend roda na **IDE** ou com `./gradlew bootRun`. O PostgreSQL pode ser **Docker** (padrão) ou **instalado localmente** — veja `application.properties`.

---

## Login inicial (aplicação web / mobile)

Na **primeira subida**, se não existir usuário com o e-mail configurado, o sistema cria um **administrador** automaticamente.

| Campo | Valor padrão (desenvolvimento) |
|--------|----------------------------------|
| **E-mail** | `admin@varzea.com` |
| **Senha** | `admin123` |
| **Papel** | `ADMIN_GERAL` (administrador global; sem pelada fixa) |

Isso vem de `application.properties` (`varzea.bootstrap.admin.*`). O bootstrap **só cria** o usuário se **ninguém** com esse e-mail existir; se você apagar o banco ou mudar o e-mail nas propriedades, pode gerar outro cadastro.

**Produção:** defina `varzea.bootstrap.admin.enabled=false`, use senhas fortes e crie usuários por fluxo controlado.

Na tela **Entrar** do frontend, use o e-mail e a senha acima (ou os valores que você definiu no `application.properties`).

---

## Rodar pela IDE

### IntelliJ IDEA

1. **Abrir o projeto:** `File` → `Open` → escolha a pasta **`backend`** (recomendado) ou a raiz do monorepo e importe o módulo Gradle.
2. Aguarde o **Gradle sync** terminar.
3. `Run` → `Edit Configurations…` → `+` → **Spring Boot** (plugin) ou **Application**.
4. **Main class:** `com.varzeastats.VarzeaStatsApplication`
5. **Module / classpath:** módulo que contém o código (ex.: `varzea-stats.main`).
6. **Working directory:** pasta `backend` (se abriu o monorepo, aponte para o submódulo).
7. **Environment variables:** não deixe `SPRING_DATASOURCE_URL` nem `SPRING_DATASOURCE_PASSWORD` **vazios** — valores vazios substituem o `application.properties` e quebram a conexão.
8. Suba o Postgres (Docker ou local) **antes** de dar **Run**.

### VS Code / Cursor

1. Abra a pasta **`backend`** (ou o workspace que inclua o projeto Gradle).
2. Instale a extensão **Extension Pack for Java**.
3. Use **Run and Debug** (F5) e selecione **VarzeaStatsApplication**, ou o arquivo `.vscode/launch.json` já inclui uma configuração com `mainClass` `com.varzeastats.VarzeaStatsApplication`.
4. Se o VS Code não achar o projeto, execute **Java: Clean Java Language Server Workspace** e reabra; confira se o **Gradle** importou o módulo `varzea-stats`.

---

## Docker ou Postgres local

No **`src/main/resources/application.properties`** há **duas** linhas `spring.datasource.url`; **mantenha só uma** ativa.

| Modo | O que fazer |
|------|-------------|
| **Docker só Postgres** (padrão dev com IDE) | URL com **5433** ativa; `cd backend && docker compose -f docker-compose-local.yml up -d` |
| **Local** | Comente a URL **5433**; descomente a de **5432**; Postgres na máquina com usuário `admin`, banco `varzea`, senha `admin` (ou o que combinar com o arquivo) |

A porta **5433** no host evita conflito com um Postgres local típico na **5432**.

### Postgres local (SQL inicial)

```sql
CREATE USER admin WITH PASSWORD 'admin';
CREATE DATABASE varzea OWNER admin;
```

### Docker só PostgreSQL (backend na IDE)

```bash
cd backend
docker compose -f docker-compose-local.yml up -d
```

### Stack completa (API + Postgres em Docker)

Imagem da API (`Dockerfile`) + Postgres no mesmo Compose (arquivo **padrão** `docker-compose.yml`):

```bash
cd backend
docker compose up --build
```

API em `http://localhost:8080`. Variáveis de conexão vêm do `docker-compose.yml` (não use a URL `127.0.0.1:5433` do `application.properties` dentro do container — o host JDBC é o serviço `postgres`).

Teste:

```bash
PGPASSWORD=admin psql -h 127.0.0.1 -p 5433 -U admin -d varzea -c 'select 1'
```

Parar (só Postgres local): `docker compose -f docker-compose-local.yml down` · Zerar dados do volume: `docker compose -f docker-compose-local.yml down -v --rmi all`

### DBeaver (conexão PostgreSQL)

Use os mesmos dados do `application.properties` / `docker-compose-local.yml`. Crie uma conexão **PostgreSQL** e preencha:

| Campo | Docker (padrão do projeto) | Postgres só na máquina |
|--------|----------------------------|-------------------------|
| **Host** | `127.0.0.1` | `127.0.0.1` |
| **Port** | `5433` | `5432` (ou a porta do seu serviço) |
| **Database** | `varzea` | `varzea` |
| **Username** | `admin` | `admin` (ou o usuário que você criou) |
| **Password** | `admin` | conforme o que definiu |

**URL JDBC** (aba *Driver properties* / *URL* em alguns assistentes): `jdbc:postgresql://127.0.0.1:5433/varzea` — troque **5433** por **5432** se estiver usando Postgres local conforme a URL ativa no `application.properties`.

1. *Database* → *New Database Connection* → **PostgreSQL** → *Next*.  
2. Preencha host, porta, banco, usuário e senha.  
3. *Test Connection* — na primeira vez o DBeaver pode baixar o driver automaticamente.  
4. *Finish*.

Se a conexão falhar, confira se o container está no ar (`docker compose -f docker-compose-local.yml ps`) ou se a URL no `application.properties` usa a mesma porta que você informou no DBeaver.

---

## Terminal (sem IDE)

```bash
cd backend
docker compose -f docker-compose-local.yml up -d   # se usar Postgres só no Docker
./gradlew bootRun
```

---

## Flyway (migrations)

O schema é versionado com **Flyway**, no mesmo espírito do projeto New Music:

- Scripts em **`src/main/resources/db/migrations`**
- Convenção de nome: **`V{versão}__{descrição}.sql`** — dois sublinhados após o número (ex.: `V1__schema_inicial.sql`). Pedidos no formato `V1_algo` na prática são **`V1__algo`**.

Configuração em `application.properties`:

- `spring.flyway.locations=classpath:db/migrations`
- `spring.jpa.hibernate.ddl-auto=validate` — o Hibernate **não** altera mais o schema; mudanças passam por novas migrations (`V2__...`, etc.).

**Banco novo:** ao subir a aplicação, o Flyway aplica `V1__schema_inicial.sql` automaticamente.

**Se você já tinha tabelas criadas só pelo Hibernate (`ddl-auto=update`):** o Flyway pode falhar na `V1` com “relation already exists”. Opções em desenvolvimento: apagar o volume Docker (`docker compose down -v --rmi all`) ou executar `DROP SCHEMA public CASCADE; CREATE SCHEMA public;` no banco e subir de novo.

---

## Peladas (vários grupos) e header `X-Pelada-Id`

Partidas, jogadores, eventos, mídia, estatísticas e votos ficam **associados a uma pelada** (tabela `peladas`). As peladas são criadas pelo **administrador geral** pela API; não há registo automático na migration.

- **`GET /peladas`** — lista peladas conforme o papel (visitante vê todas; **`ADMIN_GERAL`** vê todas; demais autenticados com pelada veem só a própria). Cada item inclui **`hasLogo`** quando existe imagem cadastrada.
- **`POST /peladas`** (JSON) — cria pelada com `{ "name": "..." }`, apenas **`ADMIN_GERAL`** autenticado.
- **`POST /peladas`** (`multipart/form-data`) — mesmo papel; partes **`name`** (texto) e **`logo`** (arquivo opcional): PNG, JPEG, GIF ou WebP, até **2 MB**. Arquivos ficam em **`varzea.pelada-logo.upload-dir`** (padrão `./data/pelada-logos`; em produção use **`VARZEA_PELADA_LOGO_DIR`** apontando para um volume persistente).
- **`GET /peladas/{id}/logo`** — imagem pública (cache 1 h); **404** se não houver logo.

Nas rotas escopadas (`/matches`, `/players`, `/stats`, `/media`, `/votes`, etc.), o backend resolve a pelada assim:

- Usuário com pelada no cadastro (**`ADMIN` da pelada**, SCOUT, MEDIA, PLAYER): usa sempre **`users.pelada_id`**; o header `X-Pelada-Id` **não altera** o escopo.
- **`ADMIN_GERAL`** ou requisição **anônima** em rotas que exigem contexto: envie **`X-Pelada-Id: <id numérico>`** (o cliente guarda após “Escolher pelada”).

O JWT inclui a pelada da conta quando aplicável; o **`ADMIN_GERAL`** não tem pelada fixa e escolhe via header / armazenamento local.

**Papéis administrativos:** `ADMIN_GERAL` — todas as peladas, cria peladas, cadastra qualquer perfil. `ADMIN` — administrador **somente da própria pelada** (mesmas permissões operacionais de partida/mídia; cadastro de usuários limitado à mesma pelada; não cria peladas).

**Vários perfis na mesma conta:** um usuário pode ter **mais de um papel** (ex.: `SCOUT` + `MEDIA`). As permissões são a **união** dos papéis (o Spring Security concede todas as `ROLE_*` correspondentes). **Exceção:** `ADMIN_GERAL` **não pode** ser combinado com outros perfis na mesma conta. Dados em `user_roles` (migration `V8__user_multi_roles.sql`). O login devolve `roles` (array) e o JWT inclui a claim `roles` (lista de nomes).

---

## Fluxo de stats na partida (API)

Tudo fica **escopado à partida**: equipes e jogadores pertencem a um jogo específico.

1. **POST /matches** — cria a partida (`ADMIN_GERAL`, `ADMIN`, SCOUT, MEDIA).
2. **GET /matches/{id}** — detalhe da partida (público).
3. **GET/POST /matches/{id}/teams** — lista / cria equipe **nessa** partida (POST: `ADMIN_GERAL`, `ADMIN`, SCOUT).
4. **GET/POST /matches/{id}/players** — lista / cria jogador em uma equipe da partida; body `{ "teamId", "directoryRef", "goalkeeper?" }` (`directoryRef`: ID de `Player` na pelada, ou `-userId` de membro em `user_pelada`) (POST: `ADMIN_GERAL`, `ADMIN`, SCOUT).
5. **GET/POST /matches/{id}/events** — lista / registra lance (`type`, `playerId`, `targetId` opcionais); jogadores devem ser da partida (POST: `ADMIN_GERAL`, `ADMIN`, SCOUT, MEDIA).

Isso alimenta **GET /stats/player/{id}**. Leituras **GET** sob `/matches/...` são públicas.

Migrations: **V2__equipes_por_partida.sql** adiciona `teams.match_id` e limpa dados legados sem partida.

---

## Swagger (OpenAPI)

Com a API no ar:

| Recurso | URL |
|---------|-----|
| **Swagger UI** | http://localhost:8080/swagger-ui.html |
| **OpenAPI (JSON)** | http://localhost:8080/v3/api-docs |

Para testar rotas protegidas: faça login em **POST /auth/login**, copie o `token` e em **Authorize** no Swagger informe `Bearer <token>`.

---

## Actuator e probes (liveness / readiness)

Endpoints públicos (sem JWT), úteis para **Kubernetes** ou balanceadores:

| Endpoint | Uso |
|----------|-----|
| http://localhost:8080/actuator/health | Status geral |
| http://localhost:8080/actuator/health/liveness | Liveness probe |
| http://localhost:8080/actuator/health/readiness | Readiness probe (inclui checagem do banco quando configurado) |

Configuração em `application.properties` (`management.endpoint.health.probes.enabled`, etc.).

---

## Variáveis de ambiente (referência)

| Variável | Descrição |
|----------|-----------|
| `SPRING_DATASOURCE_URL` | JDBC completo (sobrescreve o arquivo; **não use vazio** na IDE) |
| `JWT_SECRET` | Segredo JWT (obrigatório forte em produção) |

---

## Outros usuários

Cadastro de usuários é feito por **`ADMIN_GERAL`** ou **`ADMIN`** (da pelada) autenticado (JWT):

- **`GET /users`** — lista usuários (e-mail ordenado), cada item com **`roles`** (array). O **admin da pelada** só vê usuários da própria pelada.
- **`POST /users`** — cria usuário. Envie **`roles`** (array não vazio): valores `ADMIN_GERAL`, `ADMIN`, `SCOUT`, `PLAYER`, `MEDIA`. Se a lista for **somente** `ADMIN_GERAL`, `peladaId` deve ser `null`. Caso contrário, **`peladaId` obrigatório**. Não é permitido misturar `ADMIN_GERAL` com outros papéis. **Somente `ADMIN_GERAL`** pode atribuir o papel **`ADMIN_GERAL`** a um novo usuário; o **admin da pelada** (`ADMIN`) recebe erro se tentar. O admin da pelada também não cadastra usuários em outra pelada.

Exemplo (após login, `Authorization: Bearer <token>`; com **`ADMIN_GERAL`**, use também `X-Pelada-Id` nas rotas escopadas quando aplicável):

```bash
curl -X POST http://localhost:8080/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"name":"Scout+Mídia","email":"duo@example.com","roles":["SCOUT","MEDIA"],"peladaId":1}'
```

A senha inicial do usuário criada é a padrão configurada em `varzea.user.default-password` (ex.: `123456`); no primeiro login a pessoa deve alterá-la.

Na aplicação web, use a tela **Usuários** (`/admin/users`) com perfil **administrador geral** ou **administrador da pelada**.

---

## Erros comuns

| Sintoma | O que fazer |
|---------|-------------|
| `password authentication failed` (JDBC) | Confirme URL ativa: **5433** = Docker, **5432** = local. |
| `Connection refused` | Suba o Postgres na porta correspondente. |
| Login falha no front | Confirme e-mail/senha do bootstrap ou usuário criado via API. |
| Após migration de papéis (`V7`), erros 403 ou token inválido | Faça **logout e login** de novo para obter JWT com `ADMIN_GERAL` / `ADMIN` atualizados. |

---

## Arquivos principais

| Arquivo | Função |
|---------|--------|
| `application.properties` | JDBC, JWT, Flyway, Actuator, Swagger, bootstrap admin |
| `db/migrations/*.sql` | Migrations Flyway (`V1__...`) |
| `docker-compose.yml` | API + Postgres — containers **`varzea-backend`**, **`varzea-postgresql`**; imagem **`varzea-backend`** |
| `docker-compose-local.yml` | Só Postgres **5433:5432**, container **`varzea-postgresql`** (backend na IDE). Não use em simultâneo com a stack completa (mesmo nome do container Postgres). |

---

## Build

```bash
./gradlew bootJar
```

Saída em `build/libs/`.

---

## Estrutura de pacotes

- `controller` — REST  
- `service` — regras de negócio  
- `repository` — JPA  
- `entity` — domínio  
- `dto` — transferência  
- `security` — JWT e Spring Security  
- `config` — CORS, erros, OpenAPI, bootstrap  
