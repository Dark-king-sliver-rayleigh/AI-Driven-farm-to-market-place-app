import { useState, useEffect, useCallback } from 'react';
import { priceInsightAPI } from '../services/api';

/**
 * Hook to fetch list of available commodities
 */
export function useCommodities() {
  const [commodities, setCommodities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCommodities = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await priceInsightAPI.getCommodities();
      setCommodities(response.commodities || []);
    } catch (err) {
      setError(err.message);
      setCommodities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommodities();
  }, [fetchCommodities]);

  return { commodities, loading, error, refetch: fetchCommodities };
}

/**
 * Hook to fetch mandis for a given commodity
 */
export function useMandis(commodity) {
  const [mandis, setMandis] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchMandis = useCallback(async () => {
    if (!commodity) {
      setMandis([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await priceInsightAPI.getMandis(commodity);
      setMandis(response.mandis || []);
    } catch (err) {
      setError(err.message);
      setMandis([]);
    } finally {
      setLoading(false);
    }
  }, [commodity]);

  useEffect(() => {
    fetchMandis();
  }, [fetchMandis]);

  return { mandis, loading, error, refetch: fetchMandis };
}

/**
 * Hook to fetch price insight for a commodity+mandi pair
 */
export function usePriceInsight(commodity, mandi) {
  const [insight, setInsight] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsight = useCallback(async () => {
    if (!commodity || !mandi) {
      setInsight(null);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await priceInsightAPI.getInsight(commodity, mandi);
      setInsight(response);
    } catch (err) {
      setError(err.message);
      setInsight(null);
    } finally {
      setLoading(false);
    }
  }, [commodity, mandi]);

  useEffect(() => {
    fetchInsight();
  }, [fetchInsight]);

  return { insight, loading, error, refetch: fetchInsight };
}

/**
 * Hook to fetch all market insight categories with commodity counts
 */
export function useMarketCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await priceInsightAPI.getCategories();
      setCategories(response.categories || []);
    } catch (err) {
      setError(err.message);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  return { categories, loading, error, refetch: fetchCategories };
}

/**
 * Hook to fetch commodities and insights for a specific category
 */
export function useCategoryInsights(categoryId) {
  const [data, setData] = useState({ category: null, commodities: [], totalCommodities: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchCategoryInsights = useCallback(async () => {
    if (!categoryId) {
      setData({ category: null, commodities: [], totalCommodities: 0 });
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await priceInsightAPI.getCategoryInsights(categoryId);
      setData({
        category: response.category,
        commodities: response.commodities || [],
        totalCommodities: response.totalCommodities || 0
      });
    } catch (err) {
      setError(err.message);
      setData({ category: null, commodities: [], totalCommodities: 0 });
    } finally {
      setLoading(false);
    }
  }, [categoryId]);

  useEffect(() => {
    fetchCategoryInsights();
  }, [fetchCategoryInsights]);

  return { ...data, loading, error, refetch: fetchCategoryInsights };
}

/**
 * Hook to fetch multiple insights for display in market overview
 * @deprecated - Use useMarketCategories instead for category-based view
 */
export function useMarketOverview() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get available commodities first
      const commoditiesResponse = await priceInsightAPI.getCommodities();
      const commodities = (commoditiesResponse.commodities || []).slice(0, 12); // Top 12 commodities

      // For each commodity, get first mandi and its insight
      const insightPromises = commodities.map(async (commodity) => {
        try {
          const mandisResponse = await priceInsightAPI.getMandis(commodity);
          const mandis = mandisResponse.mandis || [];
          
          if (mandis.length === 0) {
            return { commodity, mandi: null, insight: null };
          }

          const mandi = mandis[0]; // Use first mandi
          const insightResponse = await priceInsightAPI.getInsight(commodity, mandi);
          
          return {
            commodity,
            mandi,
            ...insightResponse
          };
        } catch {
          return { commodity, mandi: null, insight: null };
        }
      });

      const results = await Promise.all(insightPromises);
      setInsights(results.filter(r => r.suggestedPrice !== null));
    } catch (err) {
      setError(err.message);
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return { insights, loading, error, refetch: fetchOverview };
}
