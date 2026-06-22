# Love Potion na Hostinger

Use a opcao **Node.js** da Hostinger.

## Configuracao

- Build command: `npm run build`
- Start command: `npm start`
- Node version: `24.x` recomendado. Minimo: `22.12.0`

Importante: nao use Node `20.x` na Hostinger. O build atual precisa de Node `22.12.0` ou mais novo para gerar as paginas e carregar as bibliotecas do app.

## Variaveis

Configure estas variaveis no painel Node.js da Hostinger:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use os mesmos valores do arquivo `.env.local` local. A chave `anon`/`publishable` e publica; nunca use a `service_role` no site.

Para este projeto, a URL publica do Supabase comeca com:

`https://dvhrisqlybqsrzsfoyfx.supabase.co`

Nao use os valores de exemplo do `.env.example`, como `https://your-project-ref.supabase.co`.

Depois do deploy, abra `/env.js` no dominio. Ele precisa mostrar a URL real do Supabase, nao `your-project-ref`.

## Atualizacoes futuras

Conteudo que voce troca pelo painel, como hero, imagens, textos publicos, releases, links, bloggers e newsletters, fica no Supabase e nao precisa de redeploy.

Mudancas de codigo, design, paginas novas ou comportamento precisam de deploy:

1. Fazer a mudanca localmente.
2. Rodar `npm run check:i18n`.
3. Rodar `npm run build`.
4. Enviar para o GitHub.
5. Deixar a Hostinger atualizar pelo GitHub.

## Rotas importantes para testar depois do deploy

- `/en`
- `/es`
- `/en/links`
- `/es/links`
- `/en/login`
- `/app`
