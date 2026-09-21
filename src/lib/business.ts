/**
 * Separação Negócio vs Pessoal.
 *
 * A Vivianne gere um negócio digital (conteúdos, anúncios, ferramentas de IA)
 * mas paga tudo pelas contas pessoais. Em vez de contas falsas, marcamos as
 * transações do negócio com uma ETIQUETA ("negócio") — assim a mesma conta
 * pode ter gastos pessoais e do negócio, e conseguimos ver os dois separados.
 */

export const BUSINESS_TAG = "negócio";

/** Uma transação está marcada como negócio se tiver a etiqueta. */
export function isBusinessTagged(tags: string[] | null | undefined): boolean {
  if (!tags) return false;
  return tags.some((t) => typeof t === "string" && normalizeTag(t) === "negocio");
}

function normalizeTag(t: string): string {
  return t.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/** Adiciona/remove a etiqueta de negócio, sem duplicar nem perder as outras. */
export function withBusinessTag(tags: string[] | null | undefined, on: boolean): string[] {
  const base = (tags ?? []).filter((t) => normalizeTag(t) !== "negocio");
  return on ? [...base, BUSINESS_TAG] : base;
}

/**
 * Fornecedores/serviços claramente do NEGÓCIO da Vivianne (ferramentas de
 * conteúdo/IA, plataformas de anúncios, infraestrutura). Usado para marcar
 * automaticamente — ela pode sempre corrigir à mão.
 */
const BUSINESS_PATTERNS: RegExp[] = [
  // Anúncios / redes
  /\bfacebook\b/i, /\bfacebk\b/i, /\bmeta\s*platforms?\b/i, /\bmeta\s*ads?\b/i,
  /\bgoogle\s*ads?\b/i, /\btiktok\s*ads?\b/i, /\banúncio|anuncio|\bads?\b/i,
  // Ferramentas de IA / conteúdo
  /leonardo\.?ai/i, /eleven\s*labs|elevenlabs/i, /invideo/i, /kits\.?\s*ai/i,
  /think\s*diffusion/i, /runway/i, /midjourney/i, /openai/i, /anthropic/i,
  /replicate/i, /descript/i, /capcut/i, /canva/i, /pika\b/i, /suno\b/i,
  /heygen/i, /synthesia/i,
  // Distribuição / cursos / pagamentos de plataforma
  /hotmart/i, /creem\.?io/i, /distrokid/i, /gumroad/i, /teachable/i,
  // Infraestrutura / hosting / domínio / internet do negócio
  /starlink/i, /vercel/i, /cloudflare/i, /namecheap|godaddy|hostgator/i,
  /\bhosting\b|\bdomínio|dominio\b|\bservidor\b/i, /aws|amazon\s*web/i, /digitalocean/i,
];

/** True se a descrição parece ser um custo do negócio. */
export function isLikelyBusiness(description: string | null | undefined): boolean {
  const s = (description ?? "").toString();
  if (!s) return false;
  return BUSINESS_PATTERNS.some((re) => re.test(s));
}
