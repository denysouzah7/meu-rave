# Meu Rave

Plataforma web moderna para comunidades de raves com salas privadas, watch party sincronizada, chat em tempo real, figurinhas, audios, painel administrativo, permissoes por sala e uploads.

## Estrutura

- `apps/web`: frontend React, Vite, TypeScript, Tailwind CSS, shadcn-style UI, React Router e TanStack Query.
- `apps/api`: backend Node.js, Fastify, TypeScript, SQLite com better-sqlite3, Drizzle ORM, Better Auth e Socket.IO.

## Como rodar localmente

1. Instale as dependencias:

```bash
npm install
```

2. Copie o arquivo de ambiente da API:

```bash
cp apps/api/.env.example apps/api/.env
```

3. Inicie tudo:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

API: `http://localhost:4000`

O primeiro usuario cadastrado e promovido automaticamente a administrador.

## Testar no celular

1. Conecte o celular no mesmo Wi-Fi do computador.
2. Descubra o IPv4 do Wi-Fi no Windows com `ipconfig`. Exemplo: `192.168.1.3`.
3. Configure a API para aceitar o endereço do celular:

```powershell
$env:CLIENT_ORIGIN="http://localhost:5173,http://192.168.1.3:5173"
$env:PUBLIC_API_URL="http://192.168.1.3:4000"
$env:BETTER_AUTH_URL="http://192.168.1.3:4000"
npm run dev
```

4. No navegador do celular, abra `http://192.168.1.3:5173`.

Se o Windows perguntar sobre firewall, libere Node.js para redes privadas.
