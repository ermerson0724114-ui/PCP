# Como fazer deploy: GitHub → Railway → Neon Database

## Passo 1: Criar o banco de dados no Neon

1. Acesse [neon.tech](https://neon.tech) e crie uma conta (gratuita)
2. Clique em **"Create Project"**
3. Escolha um nome (ex: `brasfrut-pcp`) e a região mais próxima (São Paulo se disponível)
4. Após criar, copie a **Connection String** que aparece na tela. Ela terá este formato:
   ```
   postgresql://neondb_owner:SENHA@ep-XXXXX.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
5. Guarde essa string — você vai usar no Railway

## Passo 2: Subir o código no GitHub

1. Crie um repositório no [github.com](https://github.com) (ex: `brasfrut-pcp`)
2. No seu computador, baixe todos os arquivos deste projeto do Replit
3. No terminal, dentro da pasta do projeto:
   ```bash
   git init
   git add .
   git commit -m "PCP Brasfrut - versão inicial"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/brasfrut-pcp.git
   git push -u origin main
   ```

## Passo 3: Configurar o Railway

1. Acesse [railway.app](https://railway.app) e faça login com sua conta GitHub
2. Clique em **"New Project"** → **"Deploy from GitHub repo"**
3. Selecione o repositório `brasfrut-pcp`
4. O Railway vai detectar automaticamente que é um projeto Node.js

### Configurar variáveis de ambiente

No painel do Railway, vá em **Settings → Variables** e adicione:

| Variável | Valor |
|----------|-------|
| `DATABASE_URL` | A connection string do Neon (do Passo 1) |
| `SESSION_SECRET` | Uma string aleatória longa (ex: `brasfrut-pcp-2024-segredo-forte-xyz123`) |
| `NODE_ENV` | `production` |
| `PORT` | `5000` |

### Configurar comandos de build e start

No Railway, vá em **Settings → Deploy** e configure:

| Campo | Valor |
|-------|-------|
| **Build Command** | `npm install && npm run db:push && npm run build` |
| **Start Command** | `npm start` |

> **Importante:** O `npm run db:push` no Build Command vai criar automaticamente todas as tabelas no banco Neon na primeira vez.

### Gerar domínio público

1. No Railway, vá em **Settings → Networking**
2. Clique em **"Generate Domain"** para obter uma URL pública (ex: `brasfrut-pcp-production.up.railway.app`)
3. Ou configure um domínio customizado se tiver um

## Passo 4: Primeiro acesso

1. Acesse a URL do Railway no navegador
2. A tela de login vai aparecer
3. Use as credenciais padrão:
   - **Usuário:** `admin`
   - **Senha:** `admin123`
4. Após o primeiro login, recomendo trocar a senha (pode ser feito diretamente no banco pelo painel do Neon)

## Resumo da estrutura

```
GitHub (código fonte)
   ↓ deploy automático
Railway (servidor Node.js)
   ↓ conecta via DATABASE_URL
Neon (banco PostgreSQL)
```

## Comandos úteis para desenvolvimento local

Se quiser rodar localmente antes de subir:

```bash
# Instalar dependências
npm install

# Configurar variável de ambiente (crie um arquivo .env ou exporte)
export DATABASE_URL="postgresql://neondb_owner:SENHA@ep-XXXXX.neon.tech/neondb?sslmode=require"
export SESSION_SECRET="qualquer-string-secreta"

# Criar tabelas no banco
npm run db:push

# Rodar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Rodar em modo produção
npm start
```

## Notas importantes

- O driver `pg` (node-postgres) é compatível com Neon Database — não precisa de driver especial
- O Neon exige SSL, e a connection string já inclui `?sslmode=require`
- O Railway faz deploy automático a cada push no GitHub
- O usuário admin é criado automaticamente na primeira vez que o servidor inicia
- Todos os dados (PCP, comentários, cobertura, parâmetros) são salvos no PostgreSQL do Neon
