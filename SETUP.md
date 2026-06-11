# SETUP — Assistente CFO

Guia de configuração único (≈30 minutos). O frontend é publicado no GitHub Pages
automaticamente; o backend (autenticação, base de dados, ficheiros e IA) corre no Firebase.

## 1. Criar o projeto Firebase

1. Aceda a https://console.firebase.google.com e clique em **Adicionar projeto**
   (ex.: `assistente-cfo`). Pode desativar o Google Analytics.
2. No painel do projeto, clique no ícone **Web (`</>`)** para registar uma app web
   (ex.: `assistente-cfo-web`). **Não** precisa do Firebase Hosting.
3. Copie o bloco `firebaseConfig` apresentado e cole os valores em
   [`src/firebase/config.ts`](src/firebase/config.ts), substituindo os `COLOQUE_AQUI`.
4. Em [`.firebaserc`](.firebaserc), substitua `COLOQUE-AQUI-O-ID-DO-PROJETO` pelo
   **ID do projeto** (visível em Definições do projeto).

## 2. Ativar a autenticação

1. Consola Firebase → **Authentication** → **Get started**.
2. Em **Sign-in method**, ative **Google** e **Email/password**.
3. Em **Settings → Authorized domains**, adicione `jtendeiro-finance.github.io`
   (o `localhost` já lá está, para desenvolvimento).

## 3. Criar o Firestore e o Storage

1. **Firestore Database** → **Create database** → modo **production** →
   localização `europe-west1` (ou outra europeia).
2. **Storage** → **Get started** → modo **production**, mesma região.
3. Instale a CLI do Firebase e publique as regras de segurança incluídas no repositório:

   ```bash
   npm install -g firebase-tools
   firebase login
   firebase deploy --only firestore:rules,storage
   ```

## 4. Ativar a IA (Cloud Functions + Anthropic)

> Requer o plano **Blaze** (pay-as-you-go) do Firebase. O custo das functions para
> uma utilização pequena é tipicamente cêntimos/mês; o custo de IA depende do uso
> (a app limita cada utilizador a 50 conversas e 20 extrações de faturas por dia).

1. Consola Firebase → ícone de engrenagem → **Usage and billing** → **Modify plan** → **Blaze**.
2. Obtenha uma chave da API Anthropic em https://platform.claude.com (Console → API Keys).
3. Configure o segredo e faça o deploy das functions:

   ```bash
   cd functions && npm install && cd ..
   firebase functions:secrets:set ANTHROPIC_API_KEY   # cole a chave quando pedido
   firebase deploy --only functions
   ```

   As functions são publicadas na região `europe-west1` (alinhada com
   `FUNCTIONS_REGION` em `src/firebase/config.ts`).

## 5. Publicar o frontend no GitHub Pages

1. No GitHub: **Settings → Pages → Build and deployment → Source = GitHub Actions** (uma vez).
2. Faça merge/push para o ramo `main` — o workflow
   [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) corre os testes,
   compila e publica em https://jtendeiro-finance.github.io.

## 6. Verificação rápida

1. Abra https://jtendeiro-finance.github.io → crie conta → complete o onboarding.
2. Importe `samples/extrato-exemplo.csv` em **Movimentos → Importar CSV**.
3. Importe `samples/saft-exemplo.xml` em **Movimentos → Importar SAF-T**.
4. Fotografe/carregue uma fatura em **Faturas** e confirme a extração por IA.
5. Pergunte algo em **CFO virtual** (ex.: «Como está a tesouraria?»).

## Desenvolvimento local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # testes unitários (parsers, calendário fiscal, previsão, conciliação)
npm run build      # build de produção
```

> Sem o passo 1 (config preenchida), a app abre mas mostra «configuração pendente»
> no ecrã de início de sessão.
