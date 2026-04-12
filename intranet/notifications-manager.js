import { db } from './firebase-config.js';
import { 
    collection, 
    query, 
    where, 
    orderBy, 
    limit, 
    onSnapshot, 
    doc, 
    updateDoc, 
    writeBatch,
    serverTimestamp,
    getDocs
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getCurrentUser } from './auth.js';

class NotificationsManager {
    constructor() {
        this.notifications = [];
        this.unsubscribe = null;
        this.unreadCount = 0;
    }

    async init() {
        const user = await getCurrentUser();
        if (!user) return;

        this.setupListener(user.id);
        this.setupUIListeners();
    }

    setupListener(userId) {
        const notificationsRef = collection(db, 'notifications');
        const q = query(
            notificationsRef,
            where('userId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(20)
        );

        this.unsubscribe = onSnapshot(q, (snapshot) => {
            this.notifications = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            this.unreadCount = this.notifications.filter(n => !n.read).length;
            this.updateUI();
        });
    }

    setupUIListeners() {
        const toggleBtn = document.getElementById('notification-toggle');
        const dropdown = document.getElementById('notifications-dropdown');
        const markAllReadBtn = document.getElementById('mark-all-read');

        if (toggleBtn && dropdown) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                
                // Close profile dropdown if open
                document.getElementById('profile-dropdown')?.classList.add('hidden');
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        if (markAllReadBtn) {
            markAllReadBtn.addEventListener('click', () => this.markAllAsRead());
        }
    }

    async markAsRead(notificationId) {
        try {
            const docRef = doc(db, 'notifications', notificationId);
            await updateDoc(docRef, { read: true });
        } catch (error) {
            console.error("Error marking notification as read:", error);
        }
    }

    async markAllAsRead() {
        const user = await getCurrentUser();
        if (!user) return;

        try {
            const batch = writeBatch(db);
            const unreadNotifications = this.notifications.filter(n => !n.read);
            
            unreadNotifications.forEach(n => {
                const docRef = doc(db, 'notifications', n.id);
                batch.update(docRef, { read: true });
            });

            await batch.commit();
        } catch (error) {
            console.error("Error marking all as read:", error);
        }
    }

    updateUI() {
        const badge = document.getElementById('notification-badge');
        const list = document.getElementById('notifications-list');

        // Update Badge
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
                badge.classList.remove('hidden');
            } else {
                badge.classList.add('hidden');
            }
        }

        // Update List
        if (list) {
            if (this.notifications.length === 0) {
                list.innerHTML = `
                    <div class="p-8 text-center text-gray-500">
                        <i class="fas fa-bell-slash text-3xl mb-3 block opacity-20"></i>
                        <p class="text-sm">Nenhuma notificação por enquanto</p>
                    </div>
                `;
                return;
            }

            list.innerHTML = this.notifications.map(n => this.renderNotificationItem(n)).join('');
            
            // Add click listeners to items
            this.notifications.forEach(n => {
                const el = document.getElementById(`notification-${n.id}`);
                if (el) {
                    el.addEventListener('click', () => {
                        this.markAsRead(n.id);
                        if (n.link) {
                            window.location.href = n.link;
                        }
                    });
                }
            });
        }
    }

    renderNotificationItem(n) {
        const timeStr = this.formatRelativeTime(n.createdAt?.toDate());
        const isRead = n.read;
        const iconClass = n.icon || this.getDefaultIcon(n.type);
        const iconBg = this.getIconBg(n.type);

        return `
            <div id="notification-${n.id}" class="p-4 border-b border-gray-700/50 hover:bg-gray-800/50 transition-colors cursor-pointer flex gap-4 ${isRead ? 'opacity-60' : ''}">
                <div class="flex-shrink-0">
                    <div class="w-10 h-10 rounded-full ${iconBg} flex items-center justify-center">
                        <i class="${iconClass} text-white"></i>
                    </div>
                </div>
                <div class="flex-1 min-w-0">
                    <div class="flex justify-between items-start mb-1">
                        <p class="text-sm font-bold text-white truncate pr-2">${n.title}</p>
                        ${!isRead ? '<span class="w-2 h-2 bg-blue-500 rounded-full mt-1.5 ring-4 ring-blue-500/20"></span>' : ''}
                    </div>
                    <p class="text-xs text-gray-400 line-clamp-2 mb-2 leading-relaxed">${n.message}</p>
                    <span class="text-[10px] text-gray-500 font-medium uppercase tracking-wider">${timeStr}</span>
                </div>
            </div>
        `;
    }

    getDefaultIcon(type) {
        switch (type) {
            case 'chat': return 'fas fa-comments';
            case 'trello': return 'fas fa-tasks';
            case 'admin': return 'fas fa-bullhorn';
            default: return 'fas fa-bell';
        }
    }

    getIconBg(type) {
        switch (type) {
            case 'chat': return 'bg-green-500';
            case 'trello': return 'bg-blue-500';
            case 'admin': return 'bg-purple-500';
            default: return 'bg-gray-600';
        }
    }

    formatRelativeTime(date) {
        if (!date) return 'Agora';
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'Agora';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m atrás`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h atrás`;
        return `${Math.floor(diffInSeconds / 86400)}d atrás`;
    }
}

export const notificationsManager = new NotificationsManager();
