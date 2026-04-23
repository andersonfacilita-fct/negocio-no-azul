# Negocio no Azul - Landing Page

Landing page de vendas do infoproduto **Negocio no Azul** (Ebook + Planilha + Guia - R$ 97).

Stack: [Astro 4](https://astro.build) + [TailwindCSS 3](https://tailwindcss.com) + [Vercel](https://vercel.com) (serverless).

## Estrutura

```
.
|-- api/
|   `-- purchase-event.js        # Meta Conversions API (server-side) - webhook Hotmart
|-- public/
|   |-- favicon.svg
|   `-- robots.txt
|-- src/
|   |-- components/               # 11 componentes reutilizaveis
|   |-- layouts/
|   |   `-- Layout.astro          # Meta Pixel + SEO + tipografia
|   `-- pages/
|       `-- index.astro           # Landing
|-- astro.config.mjs
|-- tailwind.config.mjs
|-- vercel.json
|-- .env.example
`-- package.json
```

## Rodar localmente

```bash
npm install
npm run dev          # http://localhost:4321
```

Build de producao:
```bash
npm run build
npm run preview
```

## Variaveis de ambiente

Copie `.env.example` para `.env` e preencha:

```env
META_ACCESS_TOKEN=EAAG...         # Meta Business > Events Manager > Settings > Gerar token
META_PIXEL_ID=1183885533721874    # mesmo pixel usado no browser
HOTMART_WEBHOOK_TOKEN=xxxx        # opcional - hottok do Hotmart p/ validar origem
```

## Deploy na Vercel

```bash
npm i -g vercel
vercel              # primeira vez - conectar projeto
vercel --prod       # deploy producao
```

Ou: conecte o repo git na Vercel e faca push. Lembre de configurar as ENV no dashboard.

## Integracao Hotmart -> Meta CAPI

1. No painel Hotmart, va em **Ferramentas > Webhook (Postback)**.
2. Adicione uma URL: `https://SEU_DOMINIO/api/purchase-event`
3. Selecione os eventos: **Compra aprovada** e **Compra completa**.
4. Copie o `hottok` gerado pelo Hotmart e cole em `HOTMART_WEBHOOK_TOKEN` na Vercel.
5. Teste usando o **Test Events** do Meta Events Manager:
   - chame `POST /api/purchase-event?test_event_code=TEST12345` com um payload de exemplo.

### Dedup de eventos

O endpoint envia `event_id = purchase.transaction` (id da transacao Hotmart).
Para dedup com o browser, o pixel do navegador envia o mesmo ID quando a venda ocorrer.
Como aqui o checkout e externo (Hotmart), confiamos no servidor - o risco de duplicacao
com o browser e minimo, pois `InitiateCheckout` e `Purchase` sao eventos distintos.

## Eventos de Pixel disparados

| Evento            | Quando                                 | Origem      |
|-------------------|----------------------------------------|-------------|
| `PageView`        | Load da pagina                         | Browser     |
| `ViewContent`     | 10s apos load                          | Browser     |
| `InitiateCheckout`| Clique em qualquer botao `[data-cta]`  | Browser     |
| `Purchase`        | Postback de compra aprovada Hotmart    | Server (CAPI)|

## Checkout

URL unica do Hotmart: `https://pay.hotmart.com/I105499750V?checkoutMode=2`
Todos os botoes CTA apontam para esse link com `data-cta="checkout"`.

## Paleta

- Navy: `#0a1628` (primary)
- Teal: `#14b8a6` (accent)
- Gold: `#facc15` (highlight)
- Navy claro: `#f0f4f9` (background alt)

## Autor

Anderson Cruz - [@anderson.fct](https://instagram.com/anderson.fct)
