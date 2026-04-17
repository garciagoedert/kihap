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

        // Esses elementos do dropdown não existem mais se a view for mobile com botton nav.
        // A lógica permanece aqui para Fallback caso a intranet desktop o use.
        if (toggleBtn && dropdown) {
            toggleBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dropdown.classList.toggle('hidden');
                document.getElementById('profile-dropdown')?.classList.add('hidden');
            });

            document.addEventListener('click', (e) => {
                if (!dropdown.contains(e.target) && !toggleBtn.contains(e.target)) {
                    dropdown.classList.add('hidden');
                }
            });
        }

        // Caso exista o botão de limpar tudo na nova interface
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
        // Tenta achar o badge do header ou do bottom-nav
        let badge = document.getElementById('notification-badge');
        if (!badge) badge = document.getElementById('nav-notif-badge');
        const list = document.getElementById('notifications-list');

        // Update Badge
        if (badge) {
            if (this.unreadCount > 0) {
                // Remove the strict numeric text if it's a structural dot in bottom nav
                if (badge.id === 'nav-notif-badge') {
                    badge.classList.remove('hidden');
                    badge.classList.add('flex');
                } else {
                    badge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
                    badge.classList.remove('hidden');
                }
            } else {
                badge.classList.add('hidden');
                badge.classList.remove('flex');
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
        
        let avatarOverlay = '';
        if (n.type === 'chat') {
            avatarOverlay = '<div class="absolute -bottom-1 -right-1 bg-green-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#111]"><i class="fas fa-comments text-[9px] text-white"></i></div>';
        } else if (n.type === 'admin') {
            avatarOverlay = '<div class="absolute -bottom-1 -right-1 bg-purple-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#111]"><i class="fas fa-bullhorn text-[9px] text-white"></i></div>';
        } else {
            avatarOverlay = '<div class="absolute -bottom-1 -right-1 bg-blue-500 rounded-full w-5 h-5 flex items-center justify-center border-2 border-[#111]"><i class="fas fa-info text-[9px] text-white"></i></div>';
        }

        let avatarImg = `<img src="${n.icon || '/imgs/kobe.png'}" class="w-11 h-11 rounded-full object-cover">`;

        return `
            <div id="notification-${n.id}" class="py-4 border-b border-[#222] hover:bg-white/5 transition-colors cursor-pointer flex items-start gap-4 px-2 ${isRead ? 'opacity-60 grayscale-[30%]' : ''}">
                <div class="flex-shrink-0 relative block mt-0.5">
                    ${avatarImg}
                    ${avatarOverlay}
                </div>
                <div class="flex-1 min-w-0 pr-2">
                    <div class="flex items-center flex-wrap gap-x-2 mb-0.5">
                        <span class="text-[15px] font-bold text-gray-100">${n.title}</span>
                        <span class="text-[15px] text-gray-500">${timeStr}</span>
                        ${!isRead ? '<div class="w-2 h-2 bg-blue-500 rounded-full mt-0.5 shadow-[0_0_8px_rgba(59,130,246,0.8)] shrink-0"></div>' : ''}
                    </div>
                    <p class="text-[15px] text-gray-300 leading-snug">${n.message}</p>
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
