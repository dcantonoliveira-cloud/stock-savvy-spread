import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

const NEEDS_CLEAN = t => t && (
  t.includes('[')           ||  // markup Bubble ainda presente
  t.includes('Ø')           ||  // artefato Bubble
  t.includes('·')           ||  // bullet manual do Bubble
  t.includes('<ul><ul>')    ||  // lista duplamente aninhada
  /(&nbsp;){3,}/.test(t)        // sequência longa de &nbsp;
);

function cleanHtmlArtifacts(s) {
  // Artefatos do Bubble em HTML já convertido
  s = s.replace(/Ø\s*(&nbsp;)*/g, '');
  s = s.replace(/·\s*(&nbsp;\s*)*/g, '');
  s = s.replace(/(&nbsp;\s*){2,}/g, ' ');
  s = s.replace(/&nbsp;/g, ' ');
  s = s.replace(/<ul>\s*<ul>/g, '<ul>');
  s = s.replace(/<\/ul>\s*<\/ul>/g, '</ul>');
  s = s.replace(/ {2,}/g, ' ');
  // Limpa <li> com só espaços
  s = s.replace(/<li>\s*<\/li>/g, '');
  s = s.replace(/<li>(\s|&nbsp;)+/g, '<li>');
  // Limpa <h3> com só espaços ou vazio
  s = s.replace(/<h3>\s*<\/h3>/g, '');
  return s.trim();
}

function bubbleToHtml(raw) {
  if (!raw) return raw;

  let s = raw;

  // Se tem HTML externo mas markup Bubble dentro, strip HTML primeiro
  if (s.trim().startsWith('<') && s.includes('[')) {
    s = s
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<p[^>]*>/gi, '')
      .replace(/<[^>]+>/g, '');
  }

  if (s.includes('[')) {
    // Cor — mantém só o texto
    s = s.replace(/\[color=[^\]]+\]([\s\S]*?)\[\/color\]/g, '$1');

    // Títulos
    s = s.replace(/\[h1\]([\s\S]*?)\[\/h1\]/g, (_, c) => '\n<h2>' + c.trim() + '</h2>\n');
    s = s.replace(/\[h2\]([\s\S]*?)\[\/h2\]/g, (_, c) => '\n<h3>' + c.trim() + '</h3>\n');
    s = s.replace(/\[h3\]([\s\S]*?)\[\/h3\]/g, (_, c) => '\n<h3>' + c.trim() + '</h3>\n');

    // Formatação inline
    s = s.replace(/\[b\]([\s\S]*?)\[\/b\]/g, '<strong>$1</strong>');
    s = s.replace(/\[i\]([\s\S]*?)\[\/i\]/g, '<em>$1</em>');
    s = s.replace(/\[u\]([\s\S]*?)\[\/u\]/g, '<u>$1</u>');
    s = s.replace(/\[s\]([\s\S]*?)\[\/s\]/g, '<s>$1</s>');

    // Itens de lista
    s = s.replace(/\[li[^\]]*\]([\s\S]*?)\[\/li\]/g, '<li>$1</li>');

    // [ml][ul] → uma só <ul>
    s = s.replace(/\[ml\]([\s\S]*?)\[\/ml\]/g, '$1');
    s = s.replace(/\[ul\]([\s\S]*?)\[\/ul\]/g, '<ul>$1</ul>');
    s = s.replace(/\[ol\]([\s\S]*?)\[\/ol\]/g, '<ol>$1</ol>');

    // Remove tags restantes
    s = s.replace(/\[[^\]]{0,60}\]/g, '');
  }

  // Limpa artefatos (seja de markup recém-convertido ou HTML existente)
  s = cleanHtmlArtifacts(s);

  // Se não tem tags de bloco, wrap em parágrafo
  if (!/<(h[1-6]|ul|ol|p|li)/.test(s)) {
    s = '<p>' + s.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>';
  }

  return s.trim();
}

async function main() {
  const { data: events } = await supabase
    .from('events')
    .select('id, menu_text')
    .not('menu_text', 'is', null);

  let updated = 0, skipped = 0;

  for (const ev of events ?? []) {
    if (!NEEDS_CLEAN(ev.menu_text)) { skipped++; continue; }

    const clean = bubbleToHtml(ev.menu_text);
    const { error } = await supabase.from('events').update({ menu_text: clean }).eq('id', ev.id);
    if (error) console.error('Erro:', ev.id, error.message);
    else updated++;
  }

  console.log(`✓ Limpos: ${updated} | Já ok: ${skipped}`);
}

main().catch(console.error);
