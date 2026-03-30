# BUDGY - Contexto Completo do Projeto

## Quem é a utilizadora

**Vivianne Nascimento** (vivnasc) — empreendedora moçambicana em Maputo.
- Trabalha exclusivamente na web (sem terminal local)
- Fala português moçambicano (escreve rápido, com typos — interpretar sempre com boa-fé)
- É prática e direta — quer resultados, não explicações longas
- Tem pouca paciência para configurações — as coisas devem funcionar logo

## O Problema que o BUDGY resolve

Vivianne usava o **Mobills** (app de finanças paga) mas quer sair porque:
1. **Inserção manual mata** — tem de inserir tudo à mão e não tem tempo
2. **Quer leitura automática de SMS** — os bancos mandam SMS com transações, a app deve ler e registar sozinha, pedindo apenas validação
3. **Quer importar histórico do Mobills** — não perder dados, organizar melhor
4. **Demasiadas categorias** — está desorganizada, quer consolidação automática
5. **Parar de pagar subscrição** — mas sem perder qualidade

Citação exacta: *"a minha app deve saber ler as mensagens q os bancos me mandam e registar sozinha pedir apenas q eu valide"*

## 3 Vias de Registo de Transações

| Via | Como | Para quem |
|-----|------|-----------|
| **Manual** | Botão + → formulário completo | Quem prefere registar na hora |
| **SMS** | Cola/partilha SMS → valida | Quem recebe notificações do banco |
| **Extrato** | Carrega ficheiro CSV/Excel → valida | Quem quer importar tudo de uma vez |

As 3 vias usam a mesma categorização automática e guardam na mesma BD.

## Bancos e Contas Reais da Vivianne

### CPC (Caixa de Poupança e Crédito) — Conta principal/salário
- **Formato CSV**: `Transaction Date,Value Date,Transaction Ref.,Description,Debit,Credit,Balance`
- **Datas**: `DD MON YYYY` (ex: "05 JAN 2026")
- **Valores**: ponto decimal, débitos negativos (ex: -269.45)
- **Linhas especiais**: OPENING BALANCE, CLOSING BALANCE
- **Descrição**: `Pagamento no PV (VISA)  |MERCHANT NAME COUNTRY` ou `Compra no Ponto de Venda (OIC)  |MERCHANT Maputo - KaMpfMZ`
- **Salário**: `PAGAMENTO SALARIO CR  BMSAL` (~388K-1.4M MZN)
- **Empréstimo**: `Prestacao Mensal Emprestimo` (-9,748.90 MZN/mês)
- **Transferências entre contas**: `Transf Interb (CPC-NET) Online VSARAIVA Minha Conta Moza`, `VSARAIVA MINHA CONTA SB`
- **Subscrições internacionais**: HOTMART, APPLE.COM/BILL, SHEIN, LEONARDO.AI, ELEVENLABS, INVIDEO, KITS AI, THINK DIFFUSION, CREEM.IO

### Moza Banco — Conta do dia-a-dia
- **Formato CSV**: separador `;`, cabeçalho `sep=;`, depois metadata (conta, saldo abertura/fecho, moeda), depois `Data;Data-Valor;Descrição;Nº de Ref;Débito;Crédito;Saldo`
- **Datas**: `DD/MM/YYYY`
- **Valores**: vírgula decimal (ex: -2420,00), ponto milhares (ex: 170.896,25)
- **BOM character** no início do ficheiro
- **Compras com cartão**: `Compra 402546******2463  Mv84 KFC - HOSP`
- **M-Pesa**: `TRF_Cart_Dig_Mpesa846313848` (número telefone)
- **e-Mola**: `TRF_Cart_Dig_Emola867929276`
- **Levantamentos ATM**: `Levantamento 402546******2463 Mv81 PRACA`
- **Taxas**: `Comissão TRF.Carteira Digital MPESA`, `Imposto de Selo TRF.Carteira Digital`
- **Salário**: `TEI RCB Sal Masterworks`, `MTR BIM ORD. MASTERWORKS LDA`
- **Transferências familiares**: `TRF-Breno`, `TRF-Breno Nascimento`

### Standard Bank — Transferências
- **Formato**: Excel (.xlsx)
- **Ficheiro exemplo**: `StandardBank-Movimentos de Conta.xlsx`
- **Uso principal**: transferências, não gastos diários

### Mobills — Histórico a importar
- **Formato**: Excel (.xlsx) — NÃO é CSV!
- **Ficheiro exemplo**: `Mobills_Vivianne-2024-2024.xlsx`
- **Tem**: Data, Descrição, Categoria, Subcategoria, Conta, Valor, Tipo, Estado, Tags, Notas

## Comerciantes Reais (para auto-categorização)

### Alimentação/Supermercados
Shoprite, SuperSpar, MEGA DISTRIB, ALFA SUPERMERCADO, RIYOUF SUPERMERCADO, ABACOS, Tops Komatipoort, PREMIER GROUP, BJ NAAS, Shoprite Komatipoort

### Restaurantes
KFC, RESTAURANT(E), TAKE AWAY, KING S BAR, GENTLEMANS, THE CRAZY, BOTTLE STORE AZARIAS

### Combustível
POSTO GALP KARL MARX, POSTO A. A

### Saúde
FARMACIA FELIZ (frequente), CONSULTORIO MEDICO, CONS MEDICO QUIROPRATIC, LABOR. ANA, KOMATI PHA(RMACY)

### Pessoal/Beleza
SKINLAB LASER / SKIN LAB SOC UNIP (tratamento regular ~5.700-9.000 MZN), 365 FITNESS (ginásio 7.000 MZN)

### Família
Creche Cris (~27.500-39.500 MZN), OH BABY SO (roupa bebé), TRF-Breno/Breno Nascimento (14.000 MZN regular)
Transferências para: Nazira, Adao Baptista (42.000 MZN)

### Compras
WOOLWORTHS MOZAMBIQUE, LOKAL 2, SHEIN.COM, TIGER IMPO, EXCLUSIVE, LAP TEC LDA, LUXOR SA, MEGA LOKAL, NYOXAMI

### Casa
RAINBOW NURSERIES, SMARTPOOLS, HOME LAND

### Automóvel
ITVM INSPE (inspeção veículo), LEBOMBO BU(RDEN) — viagens cross-border SA

### Subscrições (pagas via VISA CPC)
HOTMART, APPLE.COM/BILL, Leonardo.AI, ElevenLabs, InVideo, Kits.AI, Think Diffusion, CREEM.IO, Facebook/Meta, ECOTRIMCOME (via PayPal)

### Transferências regulares entre contas
- CPC → Moza Banco: `Transf Interb (CPC-NET) Online VSARAIVA Minha Conta Moza` (50K-150K MZN)
- CPC → Standard Bank: `Transf Interb (CPC-NET) Online VSARAIVA MINHA CONTA SB` (70K-150K MZN)
- Comissão por transferência: `Comissao Trf Interb. (CPC-NET)` (55 MZN cada)

## Stack Técnica

- **Framework**: Next.js 15 (App Router) + React 19
- **Linguagem**: TypeScript (strict mode com noUncheckedIndexedAccess)
- **Auth**: Supabase (email, Google, Facebook OAuth)
- **BD**: Supabase PostgreSQL (schema: money_schema)
- **UI**: Tailwind CSS, Lucide React (icons)
- **Charts**: Recharts
- **Excel**: xlsx (SheetJS)
- **PWA**: manifest.json + service-worker.js + icons
- **Analytics**: Plausible (budgy.app)

## Schema da Base de Dados

O schema está em `supabase/migrations/00003_money_schema.sql` no repo VIDA.
Precisa ser copiado e aplicado ao projeto Supabase do BUDGY.

Tabelas principais:
- `money_schema.accounts` — contas bancárias (CPC, Moza Banco, Standard Bank, M-Pesa, etc.)
- `money_schema.transactions` — todas as transações
- `money_schema.categories` — categorias (sistema + custom do utilizador)
- `money_schema.budgets` — orçamentos por categoria
- `money_schema.goals` — metas de poupança
- `money_schema.debts` — dívidas (devo / devem-me)

## Estrutura de Ficheiros do BUDGY

```
src/
├── app/
│   ├── layout.tsx          — Root layout (BUDGY branding, PWA meta)
│   ├── page.tsx            — Landing page
│   ├── login/page.tsx      — Auth (email, Google, Facebook)
│   ├── auth/callback/       — OAuth callback
│   ├── (app)/              — Protected routes (authenticated)
│   │   ├── layout.tsx      — App layout (BottomNav, FeedbackButton)
│   │   ├── painel/         — Dashboard
│   │   ├── transacoes/     — Transaction list
│   │   ├── orcamento/      — Budget management
│   │   ├── metas/          — Financial goals
│   │   ├── contas/         — Account management
│   │   ├── xitique/        — Rotating savings (Mozambican tradition)
│   │   ├── dividas/        — Debt tracking
│   │   ├── relatorios/     — Reports with charts
│   │   ├── importar/       — Import (SMS + file upload)
│   │   └── educacao/       — Financial education
│   └── api/
│       ├── transactions/   — CRUD transactions
│       ├── sms-parse/      — Parse SMS messages
│       └── import/         — Parse bank statements
├── components/
│   ├── bottom-nav.tsx      — Mobile bottom navigation
│   ├── add-transaction-modal.tsx — Manual entry form
│   ├── balance-card.tsx    — Balance display
│   ├── account-card.tsx    — Account card
│   ├── transaction-item.tsx — Transaction list item
│   ├── budget-progress.tsx — Budget progress bar
│   ├── goal-card.tsx       — Savings goal card
│   └── shared/             — Inlined from @vida/ui
│       ├── auth-form.tsx
│       ├── analytics.tsx
│       ├── feedback-button.tsx
│       └── service-worker-register.tsx
└── lib/
    ├── auth/               — Inlined from @vida/auth
    │   ├── client.ts       — Browser Supabase client
    │   ├── server.ts       — Server Supabase client
    │   ├── middleware.ts    — Auth middleware
    │   ├── hooks.ts        — useUser, useSession, useAuth
    │   └── index.ts
    ├── sms-parser.ts       — Parse SMS from 7 banks
    ├── bank-statement-parser.ts — Parse CPC, Moza, Standard Bank CSV/Excel
    ├── mobills-import.ts    — Parse Mobills export with category mapping
    ├── auto-categorize.ts  — 80+ rules, learns from user corrections
    └── utils.ts            — cn() utility
```

## O Que FUNCIONA (já implementado)

- ✅ 10 páginas completas com UI polida (mobile-first)
- ✅ SMS parser para 7 bancos moçambicanos
- ✅ Import de extratos CPC, Moza Banco, Standard Bank (CSV + Excel)
- ✅ Import Mobills (CSV + Excel) com mapeamento de categorias
- ✅ Auto-categorização com 80+ regras (comerciantes reais da Vivianne)
- ✅ Auth completo (email, Google, Facebook)
- ✅ PWA setup básico (manifest, service worker, icons)
- ✅ Standalone — zero dependências externas de monorepo
- ✅ Branding BUDGY (nome, cores, manifest)

## O Que FALTA (prioridade)

### 1. Backend Real (URGENTE)
Todos os dados nas páginas são **MOCK**. Nada está ligado ao Supabase.
- Ligar transações CRUD ao Supabase (money_schema.transactions)
- Import que guarda na BD (não só preview)
- SMS parse → guardar transações aprovadas na BD
- Contas reais do utilizador (money_schema.accounts)
- Orçamentos, metas, dívidas — tudo CRUD real

### 2. PWA Melhorado
- Offline-first com IndexedDB/localStorage
- Install prompt nativo
- Push notifications (alertas de SMS bancário)
- Cache strategies melhores no service worker

### 3. Logo/Favicon Final
- Conceito: **budgie (periquito)** verde esmeralda — mascote natural do nome BUDGY
- Cores: gradiente #34D399 → #059669
- A Vivianne tem Leonardo.AI e outras ferramentas de IA para gerar
- Favicon SVG actual é um esboço básico

### 4. Futuro
- React Native/Expo para App Store e Play Store
- Leitura automática de SMS do telefone (permissão Android)
- Integração directa com APIs bancárias (quando disponíveis em MZ)

## Configuração Necessária

### Variáveis de Ambiente (.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
NEXT_PUBLIC_PLAUSIBLE_ENABLED=false
```

### Supabase Setup
1. Criar projecto no supabase.com
2. Aplicar o schema money_schema (copiar do migration SQL)
3. Configurar Auth providers (Google, Facebook)
4. Configurar RLS policies

## Tom de Comunicação

- Fala em **português** com a Vivianne
- Sê **directo e conciso** — ela quer resultados
- Não expliques demasiado — faz e mostra
- Se algo não funciona, corrige sem perguntar
- Usa termos moçambicanos quando relevante (Meticais/MZN, xitique, chapa)
