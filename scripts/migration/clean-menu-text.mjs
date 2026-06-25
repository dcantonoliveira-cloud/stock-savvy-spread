import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://vfrtvnzptaazhzfirflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmcnR2bnpwdGFhemh6ZmlyZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzQyODYyOSwiZXhwIjoyMDg5MDA0NjI5fQ.bR1zR4gfcAOOEQhGizaXOAALN0HD7RQTsUZunYXRbrM'
);

// Converte markup do Bubble para HTML limpo
function bubbleToHtml(text) {
  if (!text) return text;
  // Se já é HTML (começa com <), não faz nada
  if (text.trim().startsWith('<')) return text;

  let html = text;

  // Títulos
  html = html.replace(/\[h1\](.*?)\[\/h1\]/gs, '<h1>$1</h1>');
  html = html.replace(/\[h2\](.*?)\[\/h2\]/gs, '<h2>$1</h2>');
  html = html.replace(/\[h3\](.*?)\[\/h3\]/gs, '<h3>$1</h3>');

  // Negrito / itálico / sublinhado / riscado
  html = html.replace(/\[b\](.*?)\[\/b\]/gs, '<strong>$1</strong>');
  html = html.replace(/\[i\](.*?)\[\/i\]/gs, '<em>$1</em>');
  html = html.replace(/\[u\](.*?)\[\/u\]/gs, '<u>$1</u>');
  html = html.replace(/\[s\](.*?)\[\/s\]/gs, '<s>$1</s>');

  // Cor — remove a tag mas mantém o texto
  html = html.replace(/\[color=[^\]]+\](.*?)\[\/color\]/gs, '$1');

  // Listas
  html = html.replace(/\[ul\](.*?)\[\/ul\]/gs, '<ul>$1</ul>');
  html = html.replace(/\[ol\](.*?)\[\/ol\]/gs, '<ol>$1</ol>');
  html = html.replace(/\[ml\](.*?)\[\/ml\]/gs, '<ul>$1</ul>');

  // Itens de lista — várias variações do Bubble
  html = html.replace(/\[li[^\]]*\](.*?)\[\/li\]/gs, '<li>$1</li>');

  // Parágrafo / quebra
  html = html.replace(/\[p\](.*?)\[\/p\]/gs, '<p>$1</p>');
  html = html.replace(/\[br\]/g, '<br>');

  // Tags desconhecidas restantes — remove
  html = html.replace(/\[[^\]]+\]/g, '');

  // Múltiplas linhas em branco → parágrafo
  html = html.replace(/\n{2,}/g, '</p><p>');
  html = html.replace(/\n/g, '<br>');

  // Wrap em parágrafo se não tem tags de bloco
  if (!html.includes('<h') && !html.includes('<ul') && !html.includes('<ol') && !html.includes('<p')) {
    html = '<p>' + html + '</p>';
  }

  return html;
}

async function main() {
  const { data: events } = await supabase
    .from('events')
    .select('id, menu_text')
    .not('menu_text', 'is', null);

  let updated = 0, skipped = 0;

  for (const ev of events ?? []) {
    if (!ev.menu_text || ev.menu_text.trim().startsWith('<')) { skipped++; continue; }

    const clean = bubbleToHtml(ev.menu_text);
    const { error } = await supabase.from('events').update({ menu_text: clean }).eq('id', ev.id);
    if (error) console.error('Erro:', ev.id, error.message);
    else updated++;
  }

  console.log(`✓ Limpos: ${updated} | Já ok: ${skipped}`);
}

main().catch(console.error);
