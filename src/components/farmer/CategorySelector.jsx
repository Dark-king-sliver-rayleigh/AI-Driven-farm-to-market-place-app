import { memo } from 'react';

/**
 * Category Selector Component
 * Step 1 of Add Product flow - selectable thumbnail categories
 * 
 * Props:
 * - selectedCategory: string | null
 * - onSelect: (category) => void
 */

const CATEGORIES = [
  { id: 'vegetables', name: 'Vegetables', icon: '🥬', color: 'from-green-400 to-green-600' },
  { id: 'fruits', name: 'Fruits', icon: '🍎', color: 'from-red-400 to-orange-500' },
  { id: 'cereals', name: 'Cereals', icon: '🌾', color: 'from-yellow-400 to-amber-500' },
  { id: 'pulses', name: 'Pulses', icon: '🫘', color: 'from-amber-500 to-orange-600' },
  { id: 'others', name: 'Others', icon: '📦', color: 'from-gray-400 to-gray-600' }
];

// Commodity suggestions per category
export const CATEGORY_COMMODITIES = {
  vegetables: ['Tomato', 'Onion', 'Potato', 'Cabbage', 'Carrot', 'Cauliflower', 'Brinjal', 'Capsicum', 'Green Chilli', 'Beans'],
  fruits: ['Apple', 'Banana', 'Mango', 'Orange', 'Grapes', 'Papaya', 'Pomegranate', 'Guava', 'Watermelon', 'Pineapple'],
  cereals: ['Rice', 'Wheat', 'Maize', 'Bajra', 'Jowar', 'Ragi', 'Barley'],
  pulses: ['Tur Dal', 'Moong Dal', 'Urad Dal', 'Chana Dal', 'Masoor Dal', 'Gram'],
  others: ['Ginger', 'Garlic', 'Turmeric', 'Coconut', 'Groundnut', 'Soybean', 'Sugarcane']
};

function CategorySelectorComponent({ selectedCategory, onSelect }) {
  return (
    <div>
      <h2 className="text-xl font-bold text-gray-800 mb-4">
        Choose Product Category
      </h2>
      <p className="text-gray-600 mb-6">
        Select the type of product you want to add
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            onClick={() => onSelect(category.id)}
            className={`
              relative flex flex-col items-center justify-center p-6 rounded-2xl
              transition-all duration-200 transform
              ${selectedCategory === category.id 
                ? `bg-gradient-to-br ${category.color} text-white scale-105 shadow-lg ring-4 ring-offset-2 ring-green-500` 
                : 'bg-white border-2 border-gray-200 hover:border-gray-300 hover:shadow-md hover:scale-102'
              }
            `}
          >
            <span className="text-5xl mb-3">{category.icon}</span>
            <span className={`text-base font-semibold ${
              selectedCategory === category.id ? 'text-white' : 'text-gray-700'
            }`}>
              {category.name}
            </span>
            
            {/* Selected indicator */}
            {selectedCategory === category.id && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center">
                <span className="text-green-600">✓</span>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export const CategorySelector = memo(CategorySelectorComponent);
