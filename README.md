# Join4 · PMO

App interno para gestão de horas e forecast da operação: fechamento mensal de
horas de clientes (pacotes recorrentes) e forecast editável da equipe
(pessoa × cliente × semana). Feito para rodar de graça na Vercel, com um banco
Postgres gratuito (Neon) só para autenticação e para os dados do forecast.

- **Fechamento de Horas**: sobe um export `.xlsx` da plataforma de apontamento
  e recalcula o saldo do pacote recorrente na hora, no navegador. Não salva
  nada no servidor — é o mesmo relatório que você já usava, hospedado dentro
  do app.
- **Forecast**: tabela editável de alocação por consultor, cliente e semana,
  com indicador de capacidade utilizada. Fica salvo no banco.
- **Login**: só quem tem conta (e, se você configurar, o código de acesso)
  entra. Pensado para você e seu delivery manager, mas o cadastro está pronto
  para crescer.

---

## 1. Antes de começar

Você vai precisar de:

- Conta no [GitHub](https://github.com) (você já tem)
- Conta na [Vercel](https://vercel.com) (você já tem)
- Conta gratuita na [Neon](https://neon.tech) — banco Postgres serverless.
  Pode criar direto pela integração da própria Vercel (passo 3), não precisa
  criar conta separada na Neon se preferir.

Nada disso custa nada nos volumes que essa ferramenta vai gerar (2 usuários,
algumas dezenas de linhas no forecast).

---

## 2. Subir o código para o GitHub

Dentro da pasta do projeto:

```bash
git init   # se ainda não for um repositório git
git add .
git commit -m "Join4 PMO — versão inicial"
```

Crie um repositório novo e vazio no GitHub (sem README/gitignore, pra não dar
conflito) e depois:

```bash
git remote add origin https://github.com/SEU_USUARIO/join4-pmo.git
git branch -M main
git push -u origin main
```

---

## 3. Criar o banco (Neon) e importar na Vercel

O jeito mais simples é criar o banco **de dentro da Vercel**:

1. Na Vercel, clique em **Add New… → Project** e importe o repositório
   `join4-pmo` que você acabou de subir.
2. Antes de clicar em Deploy, vá em **Storage → Create Database → Postgres
   (powered by Neon)**. Escolha a região mais perto (ex.: `sa-east-1` /
   São Paulo, se disponível) e conecte ao projeto que você está importando.
   Isso já cria a variável `DATABASE_URL` automaticamente no projeto.
3. Se preferir criar direto no [console.neon.tech](https://console.neon.tech):
   crie um projeto novo, copie a **connection string "pooled"** (a que tem
   `-pooler` no host) e cole manualmente como `DATABASE_URL` nas variáveis de
   ambiente do projeto na Vercel (passo 4).

### Aplicar o schema do banco

O arquivo [`db/schema.sql`](./db/schema.sql) cria as tabelas
(`users`, `team_members`, `clients`, `allocations`). Aplique com **uma** das
opções abaixo:

**Opção A — SQL Editor da Neon (mais simples, zero setup local)**
Abra o projeto em [console.neon.tech](https://console.neon.tech) → **SQL
Editor**, cole o conteúdo inteiro de `db/schema.sql` e clique em **Run**.

**Opção B — rodando localmente**
```bash
cp .env.example .env.local
# edite .env.local e cole a DATABASE_URL da Neon
npm install
npm run db:migrate
```

---

## 4. Configurar as variáveis de ambiente na Vercel

No projeto, vá em **Settings → Environment Variables** e confirme/adicione:

| Variável | Valor | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | connection string da Neon (já vem pronta se você criou o banco pela integração da Vercel) | Sim |
| `AUTH_SECRET` | uma string aleatória longa — gere com `npx auth secret` ou `openssl rand -base64 33` | Sim |
| `SIGNUP_CODE` | uma senha/código que você escolhe (ex.: `join4-2026`) | Opcional, mas recomendado |

`AUTH_SECRET` é o que assina os cookies de sessão — sem ela o login não
funciona em produção. `SIGNUP_CODE`, se definido, passa a ser exigido na tela
`/signup`: só quem souber o código consegue criar conta. Combine ele com seu
delivery manager por fora (WhatsApp, etc.) e nunca o deixe público. Se deixar
em branco, qualquer pessoa com o link do app consegue se cadastrar.

Depois de configurar, clique em **Deploy** (ou, se o deploy já rodou antes das
variáveis existirem, vá em **Deployments → ⋯ → Redeploy**).

---

## 5. Primeiro acesso

1. Abra a URL que a Vercel deu ao projeto (algo como
   `https://join4-pmo.vercel.app`).
2. Você vai cair em `/login`. Clique em **Cadastre-se**, crie sua conta (e a
   do seu delivery manager, depois) usando o `SIGNUP_CODE` se tiver
   configurado um.
3. Pronto — você cai na home, com os cards **Forecast** e **Fechamento de
   Horas**.
4. No Forecast, clique em **Gerenciar equipe e clientes** para cadastrar as
   pessoas (com capacidade semanal em horas) e os clientes antes de começar a
   alocar.

---

## 6. Como cada módulo funciona

### Forecast (`/forecast`)
- Cada linha "mãe" é um consultor; abaixo dela, uma linha por cliente ao qual
  ele está alocado naquela janela de semanas. Use **"+ Alocar cliente"** para
  adicionar uma nova linha.
- As células de hora salvam sozinhas ao sair do campo (não precisa apertar
  nada).
- A linha do consultor mostra o total da semana com um selo colorido (verde
  ≤100% da capacidade, laranja até 115%, vermelho acima) comparado à
  capacidade semanal cadastrada para ele.
- "✕" ao lado do nome do cliente zera as horas daquele cliente **nas semanas
  visíveis no momento** (não mexe em semanas fora da janela aberta).
- "Arquivar" em vez de excluir: preserva o histórico. Um consultor ou cliente
  arquivado some das listas mas os números antigos continuam no banco.

### Fechamento de Horas (`/fechamento`)
- Sem cadastro prévio: é só subir o `.xlsx` que sua plataforma de apontamento
  exporta (colunas `DATE`, `PROJECT`, `BILLABLE HOURS`, e opcionalmente
  `USER`/`CLIENT`).
- Cálculo e gráficos rodam inteiramente no navegador — nada é enviado a um
  servidor nem salvo. Se quiser guardar um fechamento específico, use o botão
  de exportar/print do navegador ou peça para eu evoluir isso depois com
  histórico salvo no banco.

---

## 7. Rodando localmente (para testar antes de mandar pra produção)

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e AUTH_SECRET
npm run db:migrate           # cria as tabelas
npm run dev                  # http://localhost:3000
```

---

## 8. Próximos passos (ideias já mapeadas)

A home já tem espaço reservado para novos módulos. Candidatos naturais, na
ordem que provavelmente te ajuda mais primeiro:

1. Histórico de fechamentos salvos no banco (em vez de só upload por sessão).
2. Painel de risco por cliente (status verde/amarelo/vermelho, como no seu
   PMO executivo).
3. Indicadores de margem por projeto.
4. Exportar o forecast em Excel.

É só pedir — a estrutura (auth, banco, layout) já está pronta pra encaixar
qualquer um desses.

---

## Segurança — pontos que valem sua atenção

- **`SIGNUP_CODE`**: sem essa variável configurada, `/signup` fica aberto
  para qualquer pessoa com o link do app criar conta e ver dados de clientes.
  Configure-a antes de divulgar a URL para além de você e seu delivery
  manager.
- **Todo usuário logado tem o mesmo acesso** (não existe hoje uma distinção
  de permissão entre "admin" e "membro" nas telas — a coluna `role` existe no
  banco para o futuro, mas nenhuma rota a usa ainda). Para uma equipe de 2
  pessoas isso não é um problema; se crescer, é o primeiro ponto a evoluir.
- **E-mail de cadastro**: a tela `/signup` informa quando um e-mail já está
  cadastrado (para dar um erro claro à pessoa). Isso é aceitável para uma
  ferramenta interna de poucas contas, mas não é o padrão recomendado para um
  produto público.

## Stack técnica (referência rápida)

- **Next.js 16** (App Router, TypeScript, Tailwind v4)
- **NextAuth v5** (Credentials + JWT — sem serviço externo de login)
- **Neon Postgres** via `@neondatabase/serverless` (HTTP, sem pool de conexão
  para gerenciar — ideal para funções serverless da Vercel)
- Sem ORM: SQL direto em `src/lib/db.ts` e nas rotas `src/app/api/**`, schema
  versionado em `db/schema.sql`
