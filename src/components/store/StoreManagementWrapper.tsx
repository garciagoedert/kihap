import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useStoreStore } from '../../store/useStoreStore';
import StoreDashboard from './StoreDashboard';

const StoreManagementWrapper: React.FC = () => {
  const { storeId } = useParams<{ storeId: string }>();
  const { getStoreById } = useStoreStore();

  if (!storeId) {
    return <Navigate to="/dashboard/store" />;
  }

  const store = getStoreById(storeId);

  if (!store) {
    return <Navigate to="/dashboard/store" />;
  }

  return <StoreDashboard store={store} />;
};

export default StoreManagementWrapper;
