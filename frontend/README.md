# VARzea Stats — Frontend Web

Interface em **React 18**, **TypeScript** e **Vite**. Consome a API do backend (JWT no `localStorage`).

## Pré-requisitos

- **Node.js** 18 ou superior (recomendado 20 LTS)
- **npm** ou **Yarn**

## Configuração

1. Instale as dependências na pasta deste módulo:

```bash
npm install
```

2. **URL da API** — por padrão o código usa `http://localhost:8080` se não houver `.env`.

Crie `.env` na raiz do `frontend` se precisar mudar:

```env
VITE_API_URL=http://localhost:8080
```

## Login na aplicação

1. Suba o **backend** e o **PostgreSQL** (veja `../backend/README.md`).
2. Na primeira execução do backend, é criado um administrador padrão (se ainda não existir). Valores **padrão** em desenvolvimento:
   - **E-mail:** `admin@varzea.com`
   - **Senha:** `admin123`  
   Detalhes e como alterar: **`backend/README.md`** → seção *Login inicial*.

3. Acesse **http://localhost:3000**, vá em **Entrar** e use esse e-mail e senha (ou os que você configurou no `application.properties` do backend).

## Executar em desenvolvimento

```bash
npm run dev
```

ou

```bash
yarn dev
```

Servidor: **http://localhost:3000** (`vite.config.ts`).

**Importante:** não use `sudo` com `npm install` / `yarn` — isso pode deixar `node_modules` com dono `root` e o Vite falha ao criar `.vite` (erro `EACCES`).

## Docker (Nginx, produção)

O **desenvolvimento pela IDE** continua igual: `yarn dev` ou `npm run dev` → **http://localhost:3000** (sem Docker).

Para **empacotar e servir** o build estático com Nginx (porta **80** no container):

```bash
cd frontend
docker compose up --build
```

Ou manualmente (imagem/container **`varzea-frontend`**):

```bash
cd frontend
docker build -t varzea-frontend .
docker run --rm -p 8081:80 --name varzea-frontend varzea-frontend
```

Abra **http://localhost:8081**. A API, por defeito no bundle, aponta para `http://localhost:8080`; suba o backend nessa URL ou passe no build:

```bash
docker build -t varzea-frontend --build-arg VITE_API_URL=https://sua-api.exemplo.com .
```

## Build de produção (sem Docker)

```bash
npm run build
```

Saída em `dist/`. Pré-visualização:

```bash
npm run preview
```

## Estilos (SASS)

O visual usa **SCSS** com tema escuro futurista e referências de campo (listras, verdes neon, vidro fosco).

| Caminho | Função |
|---------|--------|
| `src/styles/global.scss` | Base, fundo, tipografia global |
| `src/styles/_variables.scss` | Cores, fontes, raios |
| `src/styles/_mixins.scss` | Painéis glass, inputs, botões |
| `src/styles/pageShared.module.scss` | Classes compartilhadas das páginas |
| `src/components/Layout.module.scss` | Cabeçalho e navegação |
| `src/pages/LoginPage.module.scss` | Tela de login em tela cheia |

Fontes: **Orbitron** (títulos) e **Rajdhani** (texto), carregadas no `index.html`.

## Estrutura (`src/`)

| Pasta | Uso |
|--------|-----|
| `pages/` | Telas |
| `components/` | Layout, rotas protegidas |
| `services/` | Chamadas HTTP (axios) |
| `hooks/` | `useAuth`, etc. |
| `contexts/` | Autenticação |
| `routes/` | React Router |

## Banco de dados

Só o **PostgreSQL** roda em Docker, na pasta **`backend`**. Porta no host no modo Docker padrão: **5433**; Postgres local na máquina: **5432**. Veja `backend/README.md`.
