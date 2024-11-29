import React from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Bell, CheckCircle, AlertTriangle, Info, XCircle, Trash2 } from 'lucide-react';
import { useDataStore } from '../store/useDataStore';
import { Notification } from '../types';

interface NotificationListProps {
  notifications: Notification[];
  onClose?: () => void;
}

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return <CheckCircle className="text-green-500" size={20} />;
    case 'warning':
      return <AlertTriangle className="text-yellow-500" size={20} />;
    case 'error':
      return <XCircle className="text-red-500" size={20} />;
    default:
      return <Info className="text-blue-500" size={20} />;
  }
};

const getNotificationColor = (type: Notification['type']) => {
  switch (type) {
    case 'success':
      return 'bg-green-50 border-green-100';
    case 'warning':
      return 'bg-yellow-50 border-yellow-100';
    case 'error':
      return 'bg-red-50 border-red-100';
    default:
      return 'bg-blue-50 border-blue-100';
  }
};

export default function NotificationList({ notifications, onClose }: NotificationListProps) {
  const { markNotificationAsRead, deleteNotification } = useDataStore();

  if (notifications.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Bell size={32} className="mx-auto mb-2 opacity-50" />
        <p>Nenhuma notificação</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {notifications.map(notification => (
        <div
          key={notification.id}
          className={`relative p-3 rounded-lg border ${getNotificationColor(notification.type)} ${
            !notification.read ? 'shadow-md' : ''
          }`}
          onClick={() => markNotificationAsRead(notification.id)}
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              {getNotificationIcon(notification.type)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-gray-900 line-clamp-1">
                  {notification.title}
                </h3>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteNotification(notification.id);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-600 line-clamp-3">
                {notification.message}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {format(new Date(notification.createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
          {!notification.read && (
            <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full" />
          )}
        </div>
      ))}
    </div>
  );
}