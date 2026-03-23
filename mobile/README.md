# VARzea Stats — Mobile (Expo)

App em **React Native** com **Expo** (SDK 51) e **TypeScript**, navegação com **React Navigation** (stack).

## Pré-requisitos

- **Node.js** 18 ou superior
- **npm**
- **Expo Go** (dispositivo) ou emulador/simulador

## Configuração

1. Dependências:

```bash
npm install
```

2. **URL da API** — em `app.json`, `expo.extra`:

```json
"extra": {
  "apiUrl": "http://localhost:8080"
}
```

- **Android Emulator:** costuma ser `http://10.0.2.2:8080`
- **iOS Simulator:** `http://localhost:8080`
- **Aparelho físico:** IP da sua máquina na rede (ex.: `http://192.168.1.10:8080`)

## Login

Use o mesmo usuário do backend. Padrão em desenvolvimento (veja `backend/README.md`):

- **E-mail:** `admin@varzea.com`
- **Senha:** `admin123`

A tela **Entrar** chama `POST /auth/login`. O token fica em memória no cliente (`api.ts`).

## Executar

```bash
npx expo start
```

Garanta **backend** + **Postgres** ativos (`backend/README.md`).

## Estrutura (`src/`)

| Pasta | Uso |
|--------|-----|
| `screens/` | Telas |
| `components/` | UI compartilhada |
| `services/` | HTTP e auth |
| `navigation/` | Stack |

`App.tsx` registra `NavigationContainer` e `RootNavigator`.

## Alias `@/`

Configurado em `babel.config.js` (`babel-plugin-module-resolver`) e `tsconfig.json`.

## Banco de dados

PostgreSQL apenas via Docker na pasta **`backend`** (porta host padrão **5433** no modo Docker). Detalhes em `backend/README.md`.
