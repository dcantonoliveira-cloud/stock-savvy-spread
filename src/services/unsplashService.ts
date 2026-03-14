const UNSPLASH_ACCESS_KEY = 'qEiGWxUlJ2Snayis0Pz1NnCI9HiQoYOCNN7mu7XBiHo';
const UNSPLASH_API = 'https://api.unsplash.com';

const imageCache: Record<string, string> = {};

export async function fetchItemImage(itemName: string): Promise<string | null> {
  if (!itemName) return null;

  const cacheKey = itemName.toLowerCase().trim();

  if (imageCache[cacheKey]) {
    return imageCache[cacheKey];
  }

  try {
    const query = translateToEnglish(itemName);

    const response = await fetch(
      `${UNSPLASH_API}/search/photos?query=${encodeURIComponent(query)}&per_page=1&orientation=squarish&content_filter=high`,
      {
        headers: {
          Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const imageUrl = data.results[0].urls.thumb;
      imageCache[cacheKey] = imageUrl;
      return imageUrl;
    }

    return null;
  } catch (error) {
    console.error('Unsplash fetch error:', error);
    return null;
  }
}

function translateToEnglish(term: string): string {
  const translations: Record<string, string> = {
    'frango': 'chicken', 'carne': 'beef meat', 'carne bovina': 'beef',
    'carne suína': 'pork', 'porco': 'pork', 'peixe': 'fish',
    'camarão': 'shrimp', 'linguiça': 'sausage', 'salsicha': 'sausage',
    'bacon': 'bacon', 'presunto': 'ham', 'peru': 'turkey',
    'costela': 'ribs', 'file': 'beef fillet', 'filé': 'beef fillet',
    'alcatra': 'sirloin', 'picanha': 'picanha beef', 'patinho': 'beef round',
    'músculo': 'beef shank', 'leite': 'milk', 'queijo': 'cheese',
    'manteiga': 'butter', 'creme de leite': 'heavy cream', 'iogurte': 'yogurt',
    'requeijão': 'cream cheese', 'arroz': 'rice', 'feijão': 'beans',
    'macarrão': 'pasta', 'farinha': 'flour', 'trigo': 'wheat flour',
    'milho': 'corn', 'lentilha': 'lentil', 'grão de bico': 'chickpea',
    'soja': 'soybean', 'batata': 'potato', 'tomate': 'tomato',
    'cebola': 'onion', 'alho': 'garlic', 'cenoura': 'carrot',
    'brócolis': 'broccoli', 'abobrinha': 'zucchini', 'berinjela': 'eggplant',
    'pimentão': 'bell pepper', 'alface': 'lettuce', 'couve': 'kale',
    'espinafre': 'spinach', 'pepino': 'cucumber', 'beterraba': 'beet',
    'mandioca': 'cassava', 'inhame': 'yam', 'abóbora': 'pumpkin',
    'quiabo': 'okra', 'vagem': 'green beans', 'ervilha': 'peas',
    'limão': 'lemon', 'laranja': 'orange', 'banana': 'banana',
    'maçã': 'apple', 'morango': 'strawberry', 'abacaxi': 'pineapple',
    'manga': 'mango', 'melão': 'melon', 'melancia': 'watermelon',
    'uva': 'grape', 'pêssego': 'peach', 'maracujá': 'passion fruit',
    'sal': 'salt shaker', 'pimenta': 'pepper spice', 'azeite': 'olive oil',
    'óleo': 'cooking oil', 'vinagre': 'vinegar', 'açúcar': 'sugar',
    'mel': 'honey', 'molho': 'sauce', 'mostarda': 'mustard',
    'maionese': 'mayonnaise', 'ketchup': 'ketchup', 'shoyu': 'soy sauce',
    'tabasco': 'hot sauce', 'ovo': 'eggs', 'ovos': 'eggs',
    'pão': 'bread', 'bolo': 'cake', 'chocolate': 'chocolate',
    'café': 'coffee', 'chá': 'tea', 'suco': 'juice',
    'refrigerante': 'soda drink', 'cerveja': 'beer', 'vinho': 'wine',
    'água': 'water bottle',
  };

  const lower = term.toLowerCase().trim();
  if (translations[lower]) return translations[lower] + ' food ingredient';
  for (const [pt, en] of Object.entries(translations)) {
    if (lower.includes(pt)) return en + ' food ingredient';
  }
  return term + ' food ingredient';
}
