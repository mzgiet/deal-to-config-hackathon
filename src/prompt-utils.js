/*
 * Small helpers shared by the two Claude passes (/configure and /quote).
 */

const fs = require('node:fs');
const path = require('node:path');

const SKILLS_DIR = path.join(__dirname, '..', 'skills');

// Front matter is metadata for Context Builder, not prompt.
function loadSkill(file) {
  return fs.readFileSync(path.join(SKILLS_DIR, file), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

/* One line per product: what Claude needs to match names and reason about prices. */
function catalogForPrompt(products) {
  if (!products.length) return '(empty)';
  return products.map((p) => {
    const tiers = (p.volumeTiers ?? [])
      .map((t) => `${t.value}% from ${t.fromQuantity}${t.toQuantity ? ` to ${t.toQuantity}` : ''}`)
      .join(', ');
    const components = (p.components ?? [])
      .map((c) => `${c.name}${c.required ? '' : ' (optional)'} $${c.listPrice}`)
      .join(', ');
    return [
      `- "${p.name}"`,
      `productId ${p.productId}`,
      p.type,
      `$${p.listPrice} ${p.billing}`,
      `sold to ${p.audience}`,
      tiers && `volume tiers: ${tiers}`,
      components && `components: ${components}`,
    ].filter(Boolean).join(' | ');
  }).join('\n');
}

module.exports = { loadSkill, catalogForPrompt };
