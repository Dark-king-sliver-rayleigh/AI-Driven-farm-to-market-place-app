import { useState, useEffect, useCallback } from 'react';
import { routePlanAPI, kpiAPI, platformPriceAPI, demandForecastAPI } from '../services/api';

// ========== ROUTE PLANNING HOOKS ==========

export function useRoutePlans(params = {}) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await routePlanAPI.getPlans(params);
      setPlans(response.routePlans || response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const createPlan = async (planData) => {
    const response = await routePlanAPI.createPlan(planData);
    await fetchPlans();
    return response;
  };

  return { plans, loading, error, refetch: fetchPlans, createPlan };
}

export function useRoutePlan(id) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPlan = useCallback(async () => {
    if (!id) { setPlan(null); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await routePlanAPI.getPlanById(id);
      setPlan(response.routePlan || response.data || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const assignDriver = async (driverId) => {
    const response = await routePlanAPI.assignDriver(id, driverId);
    await fetchPlan();
    return response;
  };

  const updateStopStatus = async (stopId, data) => {
    const response = await routePlanAPI.updateStopStatus(id, stopId, data);
    await fetchPlan();
    return response;
  };

  return { plan, loading, error, refetch: fetchPlan, assignDriver, updateStopStatus };
}

// ========== KPI HOOKS ==========

export function useKPISummary(params = {}) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await kpiAPI.getSummary(params);
      setSummary(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { summary, loading, error, refetch: fetchSummary };
}

export function useKPITimeSeries(params = {}) {
  const [timeSeries, setTimeSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchTimeSeries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await kpiAPI.getTimeSeries(params);
      setTimeSeries(response.timeSeries || response.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchTimeSeries();
  }, [fetchTimeSeries]);

  return { timeSeries, loading, error, refetch: fetchTimeSeries };
}

// ========== PLATFORM PRICE HOOKS ==========

export function usePlatformPrices(params = {}) {
  const [prices, setPrices] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPrices = useCallback(async () => {
    if (!params.commodity) { setPrices(null); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await platformPriceAPI.getPrices(params);
      setPrices(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchPrices();
  }, [fetchPrices]);

  return { prices, loading, error, refetch: fetchPrices };
}

export function usePriceComparison(params = {}) {
  const [comparison, setComparison] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComparison = useCallback(async () => {
    if (!params.commodity || !params.mandi) { setComparison(null); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await platformPriceAPI.comparePrices(params);
      setComparison(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchComparison();
  }, [fetchComparison]);

  return { comparison, loading, error, refetch: fetchComparison };
}

// ========== DEMAND FORECAST HOOKS ==========

export function useDemandForecast(params = {}) {
  const [forecast, setForecast] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchForecast = useCallback(async () => {
    if (!params.commodity) { setForecast(null); return; }
    try {
      setLoading(true);
      setError(null);
      const response = await demandForecastAPI.getForecast(params);
      setForecast(response.forecast || response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(params)]);

  useEffect(() => {
    fetchForecast();
  }, [fetchForecast]);

  const generateForecast = async (data) => {
    const response = await demandForecastAPI.generateForecast(data);
    await fetchForecast();
    return response;
  };

  return { forecast, loading, error, refetch: fetchForecast, generateForecast };
}
