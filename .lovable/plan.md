
# Love Potion — Plataforma de Bloggers (Design UI)

Entrega **somente design** (sem Supabase, sem backend, sem integrações reais). Tudo com dados mockados em arquivos TS para você plugar depois no Google AI Studio.

---

## 1. Linguagem visual

**Paleta (tokens em `src/styles.css`, em oklch):**
- `--brand-rose` #f17aa9 (primary)
- `--brand-magenta` #db1861 (accent forte / CTAs)
- `--brand-coral` #f06883 (secundário)
- `--brand-blush` #fac9d1 (superfícies suaves)
- Neutros: off-white cremoso de fundo + navy/plum profundo para texto editorial

**Tipografia (mistura editorial):**
- Display pesado vertical: **Archivo Black** (headlines gigantes, rotacionadas)
- Body / UI: **Hind** (sans limpa)
- Datilografada / labels: **JetBrains Mono** (micro-caps, numeração 01/04, tags verticais)
- Manuscrita / acento: **Caveat** ou **Homemade Apple** (anotações tipo "the UV", setinhas, marcações em rosa)

**Princípios visuais:**
- Headlines GIGANTES sobrepondo imagens (estilo Lelutka anexado)
- Textos verticais nas laterais (mono uppercase, tracking aberto)
- Numeração editorial (Nº I · LOVE POTION · MMXXVI)
- Glassmorfismo: cards, menus, drawers e modais com `backdrop-blur`, borda translúcida, leve gradiente rosa
- Anotações manuscritas em magenta sobre elementos importantes
- Bastante respiro, grid quebrado, assimetria editorial

---

## 2. Estrutura de rotas (bilíngue /en e /es, inglês padrão)

```
/                          → redirect para /en
/en, /es                   → Landing
/en/about, /es/about
/en/releases, /es/releases (últimos lançamentos)
/en/shop-info, /es/...     (informação de compra)
/en/newsletter, /es/...    (inscrição newsletter + foto+texto preview)
/en/apply, /es/apply       (formulário público para virar blogger)
/en/login, /es/login       (com seletor de idioma + role)

/app                       → área autenticada (mock, sem auth real)
  /app/blogger             → painel blogger
  /app/admin               → painel admin
  /app/super-admin         → painel super admin
```

Seletor de idioma visível no header e na tela de login. Conteúdo duplicado em arquivos `src/i18n/en.ts` e `src/i18n/es.ts`.

---

## 3. Telas a desenhar

### Públicas (landing bilíngue)
1. **Home** — hero editorial: "LOVE POTION" em Archivo Black gigante atrás de uma foto de avatar SL, anotação manuscrita "style that casts a spell", texto vertical lateral, número de edição, scroll indicator. Botões Flickr / SL Marketplace / Facebook. CTA "Blogger Login" + "Apply".
2. **About** — manifesto da marca em layout magazine, mistura de colunas, citação grande.
3. **Releases** — grid quebrado de últimos lançamentos com cards glass, hover com anotação manuscrita.
4. **Shop info** — como comprar, localização SL, regras.
5. **Newsletter** — formulário de inscrição (avatar SL name) + preview de como a notícia chega (cartão com foto + texto).
6. **Apply** — formulário longo glass com perguntas (mock).
7. **Login** — split screen, foto editorial + form glass, toggle EN/ES, escolha visual de role (blogger / admin / super admin).

### Plataforma — Blogger
- Dashboard pessoal (status, próximo deadline de post, regras ativas)
- Catálogo de produtos disponíveis (cards glass, botão "Deliver to SL")
- Inbox (mensagens pessoais + avisos gerais)
- Envio de links das mídias sociais (form com previews Flickr/FB)
- Perfil

### Plataforma — Admin
- Overview (KPIs: ativas, inativas, posts no mês, produtos arquivados em breve)
- Lista de bloggers com filtros (status, frequência, última atividade), ações em massa
- Detalhe da blogger (histórico, posts, mensagens)
- Catálogo de produtos com regra "arquivar após 3 meses" visível (timeline)
- Construtor de formulário drag-and-drop (visual: lista de campos à esquerda, canvas no meio, propriedades à direita) — só UI, sem persistência
- Inbox / Compose: mensagem pessoal vs broadcast (toggle elegante)
- Newsletter composer (texto + upload de foto + preview do card que vai pro SL)
- Aprovações pendentes (cards das aplicações)

### Plataforma — Super Admin
- Configurações da plataforma (regras globais, frequência padrão, tempo de arquivamento)
- Gestão de admins
- Branding / textos da landing
- Logs e atividade

---

## 4. Componentes-chave (shadcn customizados)

- `GlassCard` — backdrop-blur + borda translúcida + leve gradiente rosa
- `EditorialHeadline` — display rotacionado / vertical
- `VerticalLabel` — mono uppercase com tracking
- `HandwrittenNote` — texto Caveat em magenta com seta SVG opcional
- `EditionMark` — "Nº II · LOVE POTION · MMXXVI"
- `LangSwitch` — EN / ES com transição suave
- `RoleBadge`, `StatusPill`, `RuleChip`
- Sidebar glass para painéis autenticados
- `FormBuilderCanvas` (mock estático com drag visual)

---

## 5. Detalhes técnicos

- TanStack Start (já no template), file-based routing em `src/routes/`
- Tokens de cor em `src/styles.css` (`@theme inline` + `:root` em oklch)
- Fontes via Google Fonts no `__root.tsx` head
- Layouts pathless: `_public.tsx` (landing) e `_app.tsx` (plataforma com sidebar), com `<Outlet />`
- i18n simples: dicionários TS + hook `useT()` baseado no segmento `/en|/es` da URL — sem libs externas
- Sem auth real: a tela de login só navega para `/app/{role}` conforme o card escolhido (mock)
- Sem chamadas externas: dados em `src/mocks/*.ts` (bloggers, produtos, mensagens, releases)
- Acessibilidade: contraste verificado para texto sobre glass; foco visível; H1 único por rota; metadata por rota (title, description, og)
- Nenhuma conexão Supabase / Cloud / Stripe / etc. nesta fase

---

## 6. Fora de escopo (combinado)

- Integração real com Second Life (LSL / HTTP-in)
- Auth real e níveis de permissão server-side
- Persistência (banco, storage)
- Envio real de e-mails / newsletters
- Lógica de arquivamento automático (será só visual mostrando a regra)

Tudo isso ficará pronto para ser plugado depois no Google AI Studio, sem precisar refatorar o design.
