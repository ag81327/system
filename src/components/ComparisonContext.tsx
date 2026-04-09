import React, { createContext, useContext, useState, useEffect } from 'react';
import { Experiment } from '../types';
import { useAuth } from './AuthContext';

interface ComparisonContextType {
  selectedExperiments: Experiment[];
  addToComparison: (experiment: Experiment) => void;
  removeFromComparison: (experimentId: string) => void;
  clearComparison: () => void;
  isInComparison: (experimentId: string) => boolean;
}

const ComparisonContext = createContext<ComparisonContextType | null>(null);

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedExperiments, setSelectedExperiments] = useState<Experiment[]>([]);

  // Load from local storage on mount or user change
  useEffect(() => {
    if (!user) {
      setSelectedExperiments([]);
      return;
    }
    const saved = localStorage.getItem(`comparison_basket_${user.id}`);
    if (saved) {
      try {
        setSelectedExperiments(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse comparison basket', e);
      }
    } else {
      setSelectedExperiments([]);
    }
  }, [user?.id]);

  // Save to local storage on change
  useEffect(() => {
    if (user) {
      localStorage.setItem(`comparison_basket_${user.id}`, JSON.stringify(selectedExperiments));
    }
  }, [selectedExperiments, user?.id]);

  const addToComparison = (experiment: Experiment) => {
    setSelectedExperiments(prev => {
      if (prev.find(e => e.id === experiment.id)) return prev;
      if (prev.length >= 5) {
        // You could show a toast here, but for now just limit
        return prev;
      }
      return [...prev, experiment];
    });
  };

  const removeFromComparison = (experimentId: string) => {
    setSelectedExperiments(prev => prev.filter(e => e.id !== experimentId));
  };

  const clearComparison = () => {
    setSelectedExperiments([]);
  };

  const isInComparison = (experimentId: string) => {
    return selectedExperiments.some(e => e.id === experimentId);
  };

  return (
    <ComparisonContext.Provider value={{
      selectedExperiments,
      addToComparison,
      removeFromComparison,
      clearComparison,
      isInComparison
    }}>
      {children}
    </ComparisonContext.Provider>
  );
};

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) throw new Error('useComparison must be used within a ComparisonProvider');
  return context;
};
