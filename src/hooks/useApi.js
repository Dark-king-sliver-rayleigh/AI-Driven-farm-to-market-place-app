import { useState, useCallback } from 'react';

/**
 * Custom hook for handling API calls with loading, error, and data states
 * @param {Function} apiFunction - The API function to call
 * @returns {Object} { data, loading, error, execute, reset }
 */
export function useApi(apiFunction) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const execute = useCallback(async (...args) => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction(...args);
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, execute, reset };
}

/**
 * Hook for fetching data on mount
 * @param {Function} apiFunction - The API function to call
 * @param {Array} deps - Dependencies array for refetching
 */
export function useFetch(apiFunction, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiFunction();
      setData(result);
      return result;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [apiFunction]);

  // Initial fetch
  useState(() => {
    refetch();
  });

  return { data, loading, error, refetch };
}
