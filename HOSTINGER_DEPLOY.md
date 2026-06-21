# Love Potion na Hostinger

Use a opcao **Node.js** da Hostinger.

## Configuracao

- Build command: `npm run build`
- Start command: `npm start`
- Node version: `20` ou mais recente

## Variaveis

Configure estas variaveis no painel Node.js da Hostinger:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Use os mesmos valores do arquivo `.env.local` local. A chave `anon` e publica; nunca use a `service_role` no site.

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
