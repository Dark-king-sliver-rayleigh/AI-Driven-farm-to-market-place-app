/**
 * Commodity Category Mapping
 * 
 * Maps commodities to 6 categories for market insights display.
 * Categories: Vegetables, Fruits, Cereals, Pulses, Spices, Others
 * 
 * NOTE: This mapping is based on common commodity names from Agmarknet data.
 * Commodities not explicitly mapped will fall into "Others".
 */

const CATEGORY_DEFINITIONS = {
  vegetables: {
    id: 'vegetables',
    name: 'Vegetables',
    icon: '🥬',
    color: 'from-green-500 to-green-600',
    keywords: [
      'tomato', 'onion', 'potato', 'cabbage', 'cauliflower', 'carrot',
      'brinjal', 'eggplant', 'capsicum', 'chilli', 'cucumber', 'pumpkin',
      'gourd', 'beans', 'peas', 'spinach', 'methi', 'palak', 'radish',
      'beetroot', 'turnip', 'lady finger', 'okra', 'bhindi', 'tinda',
      'parwal', 'pointed gourd', 'ridge gourd', 'snake gourd', 'ash gourd',
      'bitter gourd', 'bottle gourd', 'drumstick', 'coriander', 'mint',
      'curry leaves', 'lettuce', 'mushroom', 'sweet corn', 'baby corn',
      'french beans', 'cluster beans', 'broad beans', 'cowpea', 'green peas',
      'knol khol', 'kohlrabi', 'brussels sprout', 'celery', 'leek',
      'spring onion', 'green chilli', 'raddish', 'kakdi', 'turai'
    ]
  },
  fruits: {
    id: 'fruits',
    name: 'Fruits',
    icon: '🍎',
    color: 'from-red-500 to-orange-500',
    keywords: [
      'apple', 'banana', 'mango', 'orange', 'grape', 'papaya',
      'pomegranate', 'guava', 'watermelon', 'pineapple', 'lemon', 'lime',
      'coconut', 'jackfruit', 'litchi', 'lychee', 'cherry', 'peach',
      'plum', 'pear', 'sapota', 'chikoo', 'custard apple', 'sitaphal',
      'fig', 'anjeer', 'dates', 'kiwi', 'strawberry', 'blueberry',
      'raspberry', 'mulberry', 'jamun', 'amla', 'gooseberry', 'tamarind',
      'sweet lime', 'mosambi', 'muskmelon', 'cantaloupe', 'honeydew',
      'dragon fruit', 'passion fruit', 'avocado', 'ber', 'jujube',
      'wood apple', 'bael', 'star fruit', 'carambola', 'rambutan',
      'persimmon', 'loquat', 'nashpati', 'citrus'
    ]
  },
  cereals: {
    id: 'cereals',
    name: 'Cereals',
    icon: '🌾',
    color: 'from-yellow-500 to-amber-500',
    keywords: [
      'rice', 'wheat', 'maize', 'corn', 'bajra', 'jowar', 'sorghum',
      'ragi', 'finger millet', 'barley', 'oats', 'paddy', 'millet',
      'pearl millet', 'foxtail millet', 'barnyard millet', 'kodo millet',
      'little millet', 'proso millet', 'broken rice', 'basmati',
      'sona masuri', 'ponni', 'raw rice', 'boiled rice', 'parboiled rice'
    ]
  },
  pulses: {
    id: 'pulses',
    name: 'Pulses',
    icon: '🫘',
    color: 'from-amber-600 to-orange-600',
    keywords: [
      'tur', 'arhar', 'toor', 'moong', 'mung', 'urad', 'black gram',
      'chana', 'chickpea', 'gram', 'masoor', 'lentil', 'rajma', 'kidney bean',
      'lobhia', 'cowpea', 'kulthi', 'horse gram', 'moth', 'moth bean',
      'dal', 'dhal', 'bengal gram', 'green gram', 'red gram', 'black lentil',
      'split', 'whole'
    ]
  },
  spices: {
    id: 'spices',
    name: 'Spices',
    icon: '🧅',
    color: 'from-orange-600 to-red-600',
    keywords: [
      'ginger', 'garlic', 'turmeric', 'chilli', 'pepper', 'cardamom',
      'clove', 'cinnamon', 'cumin', 'jeera', 'coriander', 'dhania',
      'fenugreek', 'methi', 'mustard', 'nutmeg', 'mace', 'bay leaf',
      'tejpatta', 'star anise', 'fennel', 'saunf', 'ajwain', 'carom',
      'asafoetida', 'hing', 'poppy seed', 'khas khas', 'sesame', 'til',
      'dry chilli', 'red chilli', 'kashmiri chilli', 'black pepper',
      'white pepper', 'long pepper', 'tamarind', 'kokum', 'curry leaf',
      'saffron', 'kesar', 'vanilla'
    ]
  },
  others: {
    id: 'others',
    name: 'Others',
    icon: '📦',
    color: 'from-gray-500 to-gray-600',
    keywords: []  // Catch-all for unmatched commodities
  }
};

/**
 * Get category for a commodity name
 * @param {string} commodityName - Name of the commodity
 * @returns {string} Category ID (vegetables, fruits, cereals, pulses, spices, others)
 */
function getCategoryForCommodity(commodityName) {
  if (!commodityName) return 'others';
  
  const lowerName = commodityName.toLowerCase();
  
  for (const [categoryId, category] of Object.entries(CATEGORY_DEFINITIONS)) {
    if (categoryId === 'others') continue; // Skip others, it's the fallback
    
    for (const keyword of category.keywords) {
      if (lowerName.includes(keyword)) {
        return categoryId;
      }
    }
  }
  
  return 'others';
}

/**
 * Get all category definitions
 * @returns {Object} Category definitions object
 */
function getAllCategories() {
  return Object.entries(CATEGORY_DEFINITIONS).map(([id, cat]) => ({
    id,
    name: cat.name,
    icon: cat.icon,
    color: cat.color
  }));
}

/**
 * Get category definition by ID
 * @param {string} categoryId - Category ID
 * @returns {Object|null} Category definition or null
 */
function getCategoryById(categoryId) {
  const cat = CATEGORY_DEFINITIONS[categoryId];
  if (!cat) return null;
  return {
    id: categoryId,
    name: cat.name,
    icon: cat.icon,
    color: cat.color
  };
}

/**
 * Categorize a list of commodities
 * @param {string[]} commodities - Array of commodity names
 * @returns {Object} Object with category IDs as keys and arrays of commodities as values
 */
function categorizeCommodities(commodities) {
  const categorized = {
    vegetables: [],
    fruits: [],
    cereals: [],
    pulses: [],
    spices: [],
    others: []
  };

  for (const commodity of commodities) {
    const category = getCategoryForCommodity(commodity);
    categorized[category].push(commodity);
  }

  return categorized;
}

module.exports = {
  CATEGORY_DEFINITIONS,
  getCategoryForCommodity,
  getAllCategories,
  getCategoryById,
  categorizeCommodities
};
