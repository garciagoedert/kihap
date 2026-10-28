import { db } from '../intranet/firebase-config.js';
import { doc, getDoc, collection, getDocs, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-functions.js";
import { onAuthReady, getUserData } from '../members/js/auth.js';
import { cart } from './cart.js';
document.addEventListener('DOMContentLoaded', () => {
    const stripe = Stripe('pk_live_51SL5wfCOKFM07tm8iVZ7c7tB8PEIoiczwTEAUoRhe4dXusoilvXxm4vkgmbrcnMdCrXnOiIpvc0nw6FBhxYbnryl00gTmK12WA');

    const productLoading = document.getElementById('product-loading');
    const productContent = document.getElementById('product-content');
    const productNameTitle = document.getElementById('product-name-title');
    const productDescription = document.getElementById('product-description');
    const productImageDisplay = document.getElementById('product-image-display');
    const productPriceDisplay = document.getElementById('product-price-display');
    const productLoteDisplay = document.getElementById('product-lote-display');
    const productStockDisplay = document.getElementById('product-stock-display');
    const quantitySelector = document.getElementById('quantity-selector');
    const quantitySelectorContainer = document.getElementById('quantity-selector-container');
    const paymentForm = document.getElementById('payment-form');
    const formsContainer = document.getElementById('forms-container');
    const formTemplate = document.getElementById('form-template');
    const payButton = document.getElementById('pay-button');
    const formStatus = document.getElementById('form-status');
    const couponCodeInput = document.getElementById('coupon-code');
    const applyCouponBtn = document.getElementById('apply-coupon-btn');
    const couponStatus = document.getElementById('coupon-status');
    const recommendedProductsContainer = document.getElementById('recommended-products-container');
    const recommendedProductsList = document.getElementById('recommended-products-list');

    // Seat Map DOM elements
    const seatMapSection = document.getElementById('seat-map-section');
    const seatMapNotice = document.getElementById('seat-map-notice');
    const webLocationsContainer = document.getElementById('web-locations-selector-container');
    const webLocationsList = document.getElementById('web-locations-list');
    const webSelectedLocationInfo = document.getElementById('web-selected-location-info');
    const webLocationVenueText = document.getElementById('web-location-venue-text');
    const webSessionsContainer = document.getElementById('web-sessions-selector-container');
    const webSessionsList = document.getElementById('web-sessions-list');
    const webStageLabel = document.getElementById('web-stage-label');
    const webSeatGridContainer = document.getElementById('web-seat-grid-container');
    const webSelectedSeatsBar = document.getElementById('web-selected-seats-bar');
    const webSelectedSeatsChips = document.getElementById('web-selected-seats-chips');
    const webSelectedSeatsCount = document.getElementById('web-selected-seats-count');
    const webLockTimerBadge = document.getElementById('web-lock-timer-badge');
    const webLockTimerText = document.getElementById('web-lock-timer-text');

    // Purchase Mode (Inscrição Completa vs Apenas Ingressos Acompanhante)
    const webPurchaseModeContainer = document.getElementById('web-purchase-mode-container');
    const btnModeFull = document.getElementById('btn-mode-full');
    const btnModeExtra = document.getElementById('btn-mode-extra');
    const iconModeFull = document.getElementById('icon-mode-full');
    const iconModeExtra = document.getElementById('icon-mode-extra');
    const descModeFull = document.getElementById('desc-mode-full');
    const descModeExtra = document.getElementById('desc-mode-extra');
    let currentPurchaseMode = 'full'; // 'full' | 'extra_only'

    let productId = null;
    let productData = null;
    let currentUser = null;
    let appliedCoupon = null;
    let instructors = [];

    // Seat Map State
    let selectedLocation = null;
    let selectedSession = null;
    let selectedSeatsBySession = {}; // { [sessionId]: { session, location, seats: ['A-1', 'A-2'] } }
    let reservedSeatsMap = {};
    let unsubscribeSeatListener = null;

    const setPurchaseMode = (mode) => {
        currentPurchaseMode = mode;
        if (!btnModeFull || !btnModeExtra) return;
        if (mode === 'full') {
            btnModeFull.className = 'p-3.5 rounded-xl border-2 border-amber-500 bg-amber-500/10 text-left transition-all cursor-pointer';
            if (iconModeFull) iconModeFull.className = 'fas fa-check-circle text-amber-400 text-sm';
            btnModeExtra.className = 'p-3.5 rounded-xl border border-gray-700 bg-gray-800/40 text-left hover:border-gray-600 transition-all cursor-pointer';
            if (iconModeExtra) iconModeExtra.className = 'far fa-circle text-gray-500 text-sm';
        } else {
            btnModeExtra.className = 'p-3.5 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 text-left transition-all cursor-pointer';
            if (iconModeExtra) iconModeExtra.className = 'fas fa-check-circle text-emerald-400 text-sm';
            btnModeFull.className = 'p-3.5 rounded-xl border border-gray-700 bg-gray-800/40 text-left hover:border-gray-600 transition-all cursor-pointer';
            if (iconModeFull) iconModeFull.className = 'far fa-circle text-gray-500 text-sm';
        }
        renderForms(getAllSelectedSeats().length > 0 ? getAllSelectedSeats().length : 1);
        updateTotalPrice();
    };

    if (btnModeFull && btnModeExtra) {
        btnModeFull.addEventListener('click', () => setPurchaseMode('full'));
        btnModeExtra.addEventListener('click', () => setPurchaseMode('extra_only'));
    }

    const getAllSelectedSeats = () => {
        const list = [];
        Object.entries(selectedSeatsBySession).forEach(([sessId, data]) => {
            (data.seats || []).forEach(seatId => {
                list.push({
                    seatId,
                    sessionId: sessId,
                    sessionName: data.session?.name || 'Sessão',
                    sessionLabel: data.session?.label || data.session?.name || 'Sessão',
                    sessionDate: data.session?.date || null,
                    sessionTime: data.session?.time || null,
                    locationId: data.location?.id || null,
                    locationName: data.location?.name || null,
                    locationVenue: data.location?.venue || null,
                    locationAddress: data.location?.address || null,
                });
            });
        });
        return list;
    };

    const getUserIdentifier = () => {
        let id = sessionStorage.getItem('kihap_seat_user_id');
        if (!id) {
            id = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
            sessionStorage.setItem('kihap_seat_user_id', id);
        }
        return id;
    };

    const getProductId = () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('id');
    };

    const fetchProduct = async (id) => {
        if (!id) {
            productLoading.innerHTML = `
                <div class="text-center">
                    <p class="text-2xl text-red-500 mb-4">ID do produto não encontrado na URL.</p>
                    <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                </div>`;
            return;
        }
        try {
            const productRef = doc(db, 'products', id);
            const docSnap = await getDoc(productRef);

            if (docSnap.exists()) {
                productData = { id: docSnap.id, ...docSnap.data() };

                const isAvailable = productData.available !== false; // Default to true if undefined
                const hasExpired = productData.availabilityDate && new Date() > new Date(productData.availabilityDate);

                if (!isAvailable || hasExpired) {
                    productLoading.innerHTML = `
                        <div class="text-center">
                            <h1 class="text-4xl font-bold mb-4">Produto Indisponível</h1>
                            <p class="text-lg text-gray-400 mb-8">Este produto não está mais disponível para compra.</p>
                            <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                        </div>`;
                    productContent.classList.add('hidden');
                    productLoading.classList.remove('hidden');
                    return;
                }

                await displayProduct(productData);
                if (productData.recommendedProducts && productData.recommendedProducts.length > 0) {
                    await fetchAndDisplayRecommendedProducts(productData.recommendedProducts);
                }
            } else {
                productLoading.innerHTML = `
                    <div class="text-center">
                        <p class="text-2xl text-red-500 mb-4">Produto não encontrado.</p>
                        <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                    </div>`;
            }
        } catch (error) {
            console.error("Error fetching product:", error);
            productLoading.innerHTML = `
                <div class="text-center">
                    <p class="text-2xl text-red-500 mb-4">Erro ao carregar o produto.</p>
                    <a href="/store.html" class="bg-yellow-500 text-black font-bold py-3 px-6 rounded-lg hover:bg-yellow-600 transition">Voltar para a Loja</a>
                </div>`;
        }
    };

    const fetchInstructors = async () => {
        try {
            const q = query(collection(db, 'users'), where('isInstructor', '==', true));
            const querySnapshot = await getDocs(q);
            instructors = [];
            querySnapshot.forEach(doc => {
                instructors.push({ id: doc.id, ...doc.data() });
            });
            instructors.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (error) {
            console.error("Error fetching instructors:", error);
        }
    };

    const getYouTubeEmbedUrl = (url) => {
        if (!url) return null;
        let videoId = null;
        if (url.includes('youtube.com/watch?v=')) {
            videoId = url.split('v=')[1]?.split('&')[0];
        } else if (url.includes('youtu.be/')) {
            videoId = url.split('youtu.be/')[1]?.split('?')[0];
        } else if (url.includes('vimeo.com/')) {
            const vimeoId = url.split('vimeo.com/')[1]?.split('?')[0];
            return `https://player.vimeo.com/video/${vimeoId}`;
        }
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };

    const displayProduct = async (product) => {
        productNameTitle.textContent = product.name;
        document.title = `Kihap - ${product.name}`;
        
        // Breadcrumbs & Tags
        const nameBreadcrumb = document.getElementById('product-name-breadcrumb');
        const catBreadcrumb = document.getElementById('product-category-breadcrumb');
        const catTag = document.getElementById('product-category-tag');
        const skuTag = document.getElementById('product-sku-tag');
        
        if (nameBreadcrumb) nameBreadcrumb.textContent = product.name;
        if (catBreadcrumb) catBreadcrumb.textContent = product.category || 'Artes Marciais';
        if (catTag) catTag.textContent = product.category || 'Artes Marciais';
        
        if (product.sku && skuTag) {
            skuTag.textContent = `SKU: ${product.sku}`;
            skuTag.classList.remove('hidden');
        }

        // Description
        productDescription.textContent = product.description || '';

        // Media Gallery & Video Embed
        const showPhotoBtn = document.getElementById('show-photo-btn');
        const showVideoBtn = document.getElementById('show-video-btn');
        const videoContainer = document.getElementById('product-video-container');
        const videoIframe = document.getElementById('product-video-iframe');
        const mediaThumbnailsBar = document.getElementById('media-thumbnails-bar');

        if (product.imageUrl) {
            productImageDisplay.src = product.imageUrl;
            productImageDisplay.classList.remove('hidden');
        }

        const embedUrl = getYouTubeEmbedUrl(product.videoUrl);
        if (embedUrl && videoContainer && videoIframe && showVideoBtn && mediaThumbnailsBar) {
            videoIframe.src = embedUrl;
            showVideoBtn.classList.remove('hidden');
            mediaThumbnailsBar.classList.remove('hidden');

            showVideoBtn.addEventListener('click', () => {
                productImageDisplay.classList.add('hidden');
                videoContainer.classList.remove('hidden');
                showVideoBtn.classList.add('bg-red-500', 'text-white');
                showPhotoBtn.classList.remove('bg-amber-500', 'text-black');
            });

            showPhotoBtn.addEventListener('click', () => {
                videoContainer.classList.add('hidden');
                productImageDisplay.classList.remove('hidden');
                showPhotoBtn.classList.add('bg-amber-500', 'text-black');
                showVideoBtn.classList.remove('bg-red-500', 'text-white');
            });
        }

        // Promotional price vs Regular price
        const priceRegular = document.getElementById('product-price-regular');
        if (product.promoPrice && product.price && priceRegular) {
            priceRegular.textContent = (product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            priceRegular.classList.remove('hidden');
        }

        if (product.controlStock) {
            productStockDisplay.classList.remove('hidden');
            if (product.hasSizes && product.sizeStock) {
                const totalQty = Object.values(product.sizeStock).reduce((a, b) => a + b, 0);
                if (totalQty <= 0) {
                    productStockDisplay.innerHTML = `<span class="text-red-400 font-bold">Esgotado</span>`;
                } else if (totalQty <= 10) {
                    productStockDisplay.innerHTML = `<span class="text-amber-400 font-bold"><i class="fas fa-fire mr-1"></i> Poucas unidades em estoque!</span>`;
                } else {
                    productStockDisplay.textContent = `Em Estoque`;
                }
            } else if (product.stockQuantity !== undefined) {
                if (product.stockQuantity <= 10 && product.stockQuantity > 0) {
                    productStockDisplay.innerHTML = `<span class="text-amber-400 font-bold"><i class="fas fa-fire mr-1"></i> Últimas ${product.stockQuantity} unidades!</span>`;
                } else if (product.stockQuantity > 0) {
                    productStockDisplay.textContent = `${product.stockQuantity} em estoque`;
                } else {
                    productStockDisplay.innerHTML = `<span class="text-red-400 font-bold">Esgotado</span>`;
                }
            }
        } else {
            productStockDisplay.classList.remove('hidden');
            productStockDisplay.textContent = `Em Estoque`;
        }

        if (product.isSubscription) {
            payButton.innerHTML = '<i class="fas fa-lock mr-2"></i> Assinar Agora';
        }

        initSeatMap(product);
        await renderForms(getAllSelectedSeats().length > 0 ? getAllSelectedSeats().length : 1);
        productLoading.classList.add('hidden');
        productContent.classList.remove('hidden');
    };

    const initSeatMap = (product) => {
        if (!product.hasSeatMap) {
            if (seatMapSection) seatMapSection.classList.add('hidden');
            if (seatMapNotice) seatMapNotice.classList.add('hidden');
            if (webPurchaseModeContainer) webPurchaseModeContainer.classList.add('hidden');
            if (quantitySelectorContainer) quantitySelectorContainer.classList.remove('hidden');
            return;
        }

        if (seatMapSection) seatMapSection.classList.remove('hidden');
        if (seatMapNotice) seatMapNotice.classList.remove('hidden');
        if (quantitySelectorContainer) quantitySelectorContainer.classList.add('hidden');

        if (webPurchaseModeContainer) {
            if (product.hasExtraTicketPrice || product.extraTicketPrice > 0) {
                webPurchaseModeContainer.classList.remove('hidden');
                if (product.extraTicketPrice && descModeExtra) {
                    const priceFormatted = (product.extraTicketPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    descModeExtra.textContent = `${priceFormatted} cada (para familiares e amigos assistirem)`;
                }
            } else {
                webPurchaseModeContainer.classList.add('hidden');
            }
        }

        // Location handling
        if (product.hasLocations && product.locations && product.locations.length > 0) {
            if (webLocationsContainer) webLocationsContainer.classList.remove('hidden');
            selectedLocation = product.locations[0];
            renderWebLocationTabs(product);
        } else {
            if (webLocationsContainer) webLocationsContainer.classList.add('hidden');
            selectedLocation = null;
            setupSessionsForCurrentLocation(product);
        }
    };

    const renderWebLocationTabs = (product) => {
        if (!webLocationsList) return;
        webLocationsList.innerHTML = '';

        product.locations.forEach((loc) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            const isSelected = selectedLocation && selectedLocation.id === loc.id;
            btn.className = `px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                isSelected
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`;
            btn.innerHTML = `<i class="fas fa-map-marker-alt mr-1.5"></i> ${loc.name}`;
            btn.addEventListener('click', () => {
                if (selectedLocation && selectedLocation.id === loc.id) return;
                selectedLocation = loc;
                renderWebLocationTabs(product);
            });
            webLocationsList.appendChild(btn);
        });

        // Venue Info Card
        if (webSelectedLocationInfo && webLocationVenueText) {
            if (selectedLocation && (selectedLocation.venue || selectedLocation.address)) {
                webSelectedLocationInfo.classList.remove('hidden');
                const venueStr = [selectedLocation.venue, selectedLocation.address].filter(Boolean).join(' - ');
                webLocationVenueText.textContent = venueStr;
            } else {
                webSelectedLocationInfo.classList.add('hidden');
            }
        }

        setupSessionsForCurrentLocation(product);
    };

    const setupSessionsForCurrentLocation = (product) => {
        const activeConfig = (product.hasLocations && selectedLocation && selectedLocation.seatMapConfig)
            ? selectedLocation.seatMapConfig
            : (product.seatMapConfig || {});

        if (activeConfig.stageLabel && webStageLabel) {
            webStageLabel.textContent = activeConfig.stageLabel.toUpperCase();
        } else if (webStageLabel) {
            webStageLabel.textContent = 'PALCO / TATAME PRINCIPAL';
        }

        const sessions = (product.hasLocations && selectedLocation && selectedLocation.sessions && selectedLocation.sessions.length > 0)
            ? selectedLocation.sessions
            : ((product.sessions && product.sessions.length > 0)
                ? product.sessions
                : [{ id: 'default', name: 'Sessão Principal', label: 'Sessão Principal' }]);

        selectedSession = sessions[0];
        selectedSeatsBySession = {};
        updateSelectedSeatsUI();
        renderForms(1);

        if (sessions.length > 1 && webSessionsContainer && webSessionsList) {
            webSessionsContainer.classList.remove('hidden');
            renderWebSessionButtons(sessions, product);
        } else if (webSessionsContainer) {
            webSessionsContainer.classList.add('hidden');
        }

        updateSelectedSeatsUI();
        const all = getAllSelectedSeats();
        renderForms(all.length > 0 ? all.length : 1);
        listenToSeatReservations(product.id, selectedSession ? selectedSession.id : 'default');
    };

    const renderWebSessionButtons = (sessions, product) => {
        if (!webSessionsList) return;
        webSessionsList.innerHTML = '';
        sessions.forEach((sess) => {
            const isSelected = selectedSession && selectedSession.id === sess.id;
            const count = selectedSeatsBySession[sess.id]?.seats?.length || 0;
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
                isSelected
                    ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700 border border-gray-700'
            }`;
            const countBadge = count > 0 
                ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-black ${isSelected ? 'bg-black/20 text-black' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'}">${count}</span>` 
                : '';
            btn.innerHTML = `<i class="fas fa-calendar-day mr-1"></i> <span>${sess.label || sess.name || 'Sessão'}</span> ${countBadge}`;
            btn.addEventListener('click', () => {
                if (selectedSession && selectedSession.id === sess.id) return;
                selectedSession = sess;
                renderWebSessionButtons(sessions, product);
                renderWebSeatGrid();
                listenToSeatReservations(product.id, selectedSession.id);
            });
            webSessionsList.appendChild(btn);
        });
    };

    const listenToSeatReservations = (prodId, sessId) => {
        if (unsubscribeSeatListener) {
            unsubscribeSeatListener();
            unsubscribeSeatListener = null;
        }

        const docId = `${prodId}_${sessId || 'default'}`;
        const reservationRef = doc(db, 'productSeatReservations', docId);

        unsubscribeSeatListener = onSnapshot(reservationRef, (docSnap) => {
            if (docSnap.exists()) {
                reservedSeatsMap = docSnap.data().seats || {};
            } else {
                reservedSeatsMap = {};
            }
            renderWebSeatGrid();
        }, (error) => {
            console.warn('Erro ao escutar reservas de assentos:', error);
            renderWebSeatGrid();
        });
    };

    const renderWebSeatGrid = () => {
        if (!webSeatGridContainer || !productData) return;

        const activeConfig = (productData.hasLocations && selectedLocation && selectedLocation.seatMapConfig)
            ? selectedLocation.seatMapConfig
            : (productData.seatMapConfig || {});
        const rows = activeConfig.rows || 8;
        const cols = activeConfig.cols || 10;
        const now = Date.now();
        const myId = getUserIdentifier();

        const currentSessionSeats = (selectedSession && selectedSeatsBySession[selectedSession.id]?.seats) || [];

        webSeatGridContainer.innerHTML = '';

        for (let r = 0; r < rows; r++) {
            const rowLetter = String.fromCharCode(65 + r);
            const rowDiv = document.createElement('div');
            rowDiv.className = 'flex items-center gap-1.5 sm:gap-2 justify-center';

            const labelLeft = document.createElement('span');
            labelLeft.className = 'w-5 text-center text-xs font-black text-gray-500 select-none';
            labelLeft.textContent = rowLetter;
            rowDiv.appendChild(labelLeft);

            for (let c = 1; c <= cols; c++) {
                const seatId = `${rowLetter}-${c}`;
                const reservation = reservedSeatsMap[seatId];

                let status = 'available';
                if (currentSessionSeats.includes(seatId)) {
                    status = 'selected';
                } else if (reservation) {
                    if (reservation.status === 'booked') {
                        status = 'booked';
                    } else if (reservation.status === 'disabled') {
                        status = 'disabled';
                    } else if (reservation.status === 'locked') {
                        if (reservation.lockedUntil && reservation.lockedUntil > now) {
                            status = (reservation.lockedBy === myId) ? 'locked_by_me' : 'locked';
                        } else {
                            status = 'available';
                        }
                    }
                }

                const seatBtn = document.createElement('button');
                seatBtn.type = 'button';
                seatBtn.dataset.seatId = seatId;
                seatBtn.title = `Cadeira ${seatId}`;

                let btnClass = 'w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-[10px] sm:text-xs font-bold transition-all ';

                if (status === 'selected') {
                    btnClass += 'bg-amber-500 text-black border-2 border-amber-300 font-black shadow-lg shadow-amber-500/30 scale-105';
                } else if (status === 'locked_by_me') {
                    btnClass += 'bg-purple-600 text-white border border-purple-400 font-bold';
                } else if (status === 'locked') {
                    btnClass += 'bg-purple-950/60 text-purple-400 border border-purple-800/80 cursor-not-allowed opacity-60';
                    seatBtn.disabled = true;
                } else if (status === 'booked') {
                    btnClass += 'bg-red-950/60 text-red-500 border border-red-900 cursor-not-allowed opacity-50';
                    seatBtn.disabled = true;
                } else if (status === 'disabled') {
                    btnClass += 'bg-gray-900 text-gray-700 border border-dashed border-gray-800 cursor-not-allowed opacity-30';
                    seatBtn.disabled = true;
                } else {
                    btnClass += 'bg-gray-800 text-gray-300 border border-gray-700 hover:border-amber-400 hover:bg-gray-700 hover:text-white cursor-pointer';
                }

                seatBtn.className = btnClass;
                seatBtn.innerHTML = `<span>${c}</span>`;

                if (status === 'available' || status === 'selected' || status === 'locked_by_me') {
                    seatBtn.addEventListener('click', () => {
                        toggleSeat(seatId);
                    });
                }

                rowDiv.appendChild(seatBtn);
            }

            const labelRight = document.createElement('span');
            labelRight.className = 'w-5 text-center text-xs font-black text-gray-500 select-none';
            labelRight.textContent = rowLetter;
            rowDiv.appendChild(labelRight);

            webSeatGridContainer.appendChild(rowDiv);
        }
    };

    const toggleSeat = (seatId) => {
        if (!selectedSession) return;
        const sessId = selectedSession.id || 'default';

        if (!selectedSeatsBySession[sessId]) {
            selectedSeatsBySession[sessId] = {
                session: selectedSession,
                location: selectedLocation,
                seats: []
            };
        }

        const seatsArr = selectedSeatsBySession[sessId].seats;
        const idx = seatsArr.indexOf(seatId);
        if (idx > -1) {
            seatsArr.splice(idx, 1);
            if (seatsArr.length === 0) {
                delete selectedSeatsBySession[sessId];
            }
        } else {
            seatsArr.push(seatId);
            seatsArr.sort((a, b) => {
                const [rowA, colA] = a.split('-');
                const [rowB, colB] = b.split('-');
                if (rowA !== rowB) return rowA.localeCompare(rowB);
                return parseInt(colA, 10) - parseInt(colB, 10);
            });
        }

        updateSelectedSeatsUI();
        renderWebSeatGrid();
        
        // Refresh session buttons count badges
        const sessions = (productData.hasLocations && selectedLocation && selectedLocation.sessions && selectedLocation.sessions.length > 0)
            ? selectedLocation.sessions
            : (productData.sessions || []);
        if (sessions.length > 1) {
            renderWebSessionButtons(sessions, productData);
        }

        const all = getAllSelectedSeats();
        renderForms(all.length > 0 ? all.length : 1);
    };

    const updateSelectedSeatsUI = () => {
        if (!webSelectedSeatsBar || !webSelectedSeatsCount || !webSelectedSeatsChips) return;

        const all = getAllSelectedSeats();
        const count = all.length;
        webSelectedSeatsCount.textContent = count;

        if (count > 0) {
            webSelectedSeatsBar.classList.remove('hidden');
            webSelectedSeatsChips.innerHTML = '';
            all.forEach(item => {
                const chip = document.createElement('span');
                chip.className = 'px-2.5 py-1 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-black flex items-center gap-1.5';
                chip.innerHTML = `<i class="fas fa-couch text-[10px]"></i> ${item.seatId} <span class="text-[10px] text-gray-400 font-normal">(${item.sessionName})</span> <button type="button" class="text-amber-300 hover:text-white ml-0.5" data-seat-remove="${item.seatId}">&times;</button>`;
                chip.querySelector('button').addEventListener('click', (e) => {
                    e.stopPropagation();
                    const group = selectedSeatsBySession[item.sessionId];
                    if (group) {
                        const sIdx = group.seats.indexOf(item.seatId);
                        if (sIdx > -1) {
                            group.seats.splice(sIdx, 1);
                            if (group.seats.length === 0) {
                                delete selectedSeatsBySession[item.sessionId];
                            }
                        }
                    }
                    updateSelectedSeatsUI();
                    renderWebSeatGrid();
                    const sessions = (productData.hasLocations && selectedLocation && selectedLocation.sessions)
                        ? selectedLocation.sessions
                        : (productData.sessions || []);
                    if (sessions.length > 1) {
                        renderWebSessionButtons(sessions, productData);
                    }
                    const newAll = getAllSelectedSeats();
                    renderForms(newAll.length > 0 ? newAll.length : 1);
                });
                webSelectedSeatsChips.appendChild(chip);
            });
        } else {
            webSelectedSeatsBar.classList.add('hidden');
        }
    };

    const fetchAndDisplayRecommendedProducts = async (productIds) => {
        try {
            const productsRef = collection(db, 'products');
            const q = query(productsRef, where('__name__', 'in', productIds));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                recommendedProductsList.innerHTML = '';
                querySnapshot.forEach(doc => {
                    const product = { id: doc.id, ...doc.data() };
                    const productElement = document.createElement('div');
                    productElement.className = 'bg-gray-700 p-4 rounded-lg flex items-center justify-between';
                    productElement.innerHTML = `
                        <div class="flex items-center">
                            <img src="${product.imageUrl || 'imgs/placeholder.jpg'}" alt="${product.name}" class="w-16 h-16 object-cover rounded-md mr-4">
                            <div>
                                <h4 class="font-bold">${product.name}</h4>
                                <p class="text-yellow-400">${(product.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                            </div>
                        </div>
                        <select data-product-id="${product.id}" data-product-price="${product.price}" class="recommended-product-quantity w-20 px-2 py-1 rounded-lg bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-yellow-500">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                            <option value="3">3</option>
                            <option value="4">4</option>
                            <option value="5">5</option>
                        </select>
                    `;
                    recommendedProductsList.appendChild(productElement);
                });
                recommendedProductsContainer.classList.remove('hidden');

                document.querySelectorAll('.recommended-product-quantity').forEach(select => {
                    select.addEventListener('change', updateTotalPrice);
                });
            }
        } catch (error) {
            console.error("Error fetching recommended products:", error);
        }
    };

    const renderForms = async (quantity) => {
        formsContainer.innerHTML = '';
        for (let i = 1; i <= quantity; i++) {
            const formClone = formTemplate.content.cloneNode(true);
            const formInstance = formClone.querySelector('.form-instance');

            const formInstanceTitle = formInstance.querySelector('.form-instance-title');
            const all = getAllSelectedSeats();
            const seatItemForForm = (productData && productData.hasSeatMap && all[i - 1]) ? all[i - 1] : null;

            const hasExtraTicketMode = Boolean(productData && productData.hasSeatMap && (productData.hasExtraTicketPrice || productData.extraTicketPrice > 0));
            const includedTicketsCount = (productData && productData.includedTicketsCount !== undefined) ? productData.includedTicketsCount : 1;
            const isExtraTicket = hasExtraTicketMode && (currentPurchaseMode === 'extra_only' || (i > includedTicketsCount));

            if (formInstanceTitle) {
                let seatBadgeHtml = '';
                if (seatItemForForm) {
                    const sessionInfo = seatItemForForm.sessionName ? ` - ${seatItemForForm.sessionName}` : '';
                    seatBadgeHtml = ` <span class="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-xs font-black inline-flex items-center gap-1 ml-2"><i class="fas fa-couch"></i> Cadeira ${seatItemForForm.seatId}${sessionInfo}</span>`;
                }
                if (isExtraTicket) {
                    const priceFormatted = (productData.extraTicketPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const badgeLabel = (currentPurchaseMode === 'extra_only') ? `Acompanhante (${priceFormatted})` : `Acompanhante (+ ${priceFormatted})`;
                    formInstanceTitle.innerHTML = `Ingresso <span class="form-instance-number">${i}</span> <span class="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold ml-1">${badgeLabel}</span>${seatBadgeHtml}`;
                } else if (hasExtraTicketMode) {
                    formInstanceTitle.innerHTML = `Inscrição Principal <span class="form-instance-number">${i}</span> <span class="px-2 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-bold ml-1">Graduando</span>${seatBadgeHtml}`;
                } else if (productData.priceType === 'kit') {
                    formInstanceTitle.innerHTML = `Detalhes do Item <span class="form-instance-number">${i}</span>${seatBadgeHtml}`;
                } else {
                    formInstanceTitle.innerHTML = `Inscrição <span class="form-instance-number">${i}</span>${seatBadgeHtml}`;
                }
            } else {
                formInstance.querySelector('.form-instance-number').textContent = i;
            }

            if (isExtraTicket) {
                const companionNotice = document.createElement('div');
                companionNotice.className = 'p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2 mb-2';
                companionNotice.innerHTML = `<i class="fas fa-ticket-alt text-base text-emerald-400"></i><span>Ingresso para familiar/convidado assistir ao evento. Apenas a cadeira será reservada para o acompanhante.</span>`;
                formInstance.querySelector('.grid').prepend(companionNotice);
            }

            const fields = ['price-variant-selector', 'size-selector'];
            fields.forEach(field => {
                const label = formInstance.querySelector(`label[for="${field}"]`);
                const input = formInstance.querySelector(`[name="${field}"]`);
                if (label) label.setAttribute('for', `${field}-${i}`);
                if (input) input.id = `${field}-${i}`;
            });

            // Campo Idade condicional (ignorado em ingressos adicionais)
            if (productData.askAge && !isExtraTicket) {
                const ageContainer = formInstance.querySelector('.age-container');
                if (ageContainer) {
                    ageContainer.classList.remove('hidden');
                    const ageInput = ageContainer.querySelector('input[name="idade"]');
                    if (ageInput) {
                        ageInput.id = `idade-${i}`;
                        ageInput.required = true;
                    }
                }
            }

            // Campo Professor condicional (ignorado em ingressos adicionais)
            if (productData.askProfessor && !isExtraTicket) {
                const professorContainer = formInstance.querySelector('.professor-container');
                if (professorContainer) {
                    professorContainer.classList.remove('hidden');
                    const professorSelector = professorContainer.querySelector('select[name="professor-selector"]');
                    if (professorSelector) {
                        professorSelector.id = `professor-${i}`;
                        professorSelector.required = true;
                        
                        professorSelector.innerHTML = '<option value="" disabled selected>Selecione o Professor</option>';
                        
                        // Se houver uma lista manual de professores, usa ela. Caso contrário, usa a lista automática.
                        const listToUse = (productData.availableProfessors && productData.availableProfessors.length > 0) 
                            ? productData.availableProfessors 
                            : instructors.map(instr => instr.name || instr.id);

                        listToUse.forEach(profName => {
                            const option = document.createElement('option');
                            option.value = profName;
                            option.textContent = profName;
                            professorSelector.appendChild(option);
                        });
                    }
                }
            }

            const priceVariantSelectorContainer = formInstance.querySelector('.price-variant-selector-container');
            const priceVariantSelector = formInstance.querySelector('[name="price-variant-selector"]');

            if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0 && !isExtraTicket) {
                priceVariantSelectorContainer.classList.remove('hidden');
                priceVariantSelector.required = true;
                priceVariantSelector.innerHTML = '';

                productData.priceVariants.forEach((variant, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    const pixText = (variant.pixPrice && variant.pixPrice < variant.price)
                        ? ` (ou ${(variant.pixPrice / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} no Pix)`
                        : '';
                    option.textContent = `${variant.name} - ${(variant.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}${pixText}`;
                    priceVariantSelector.appendChild(option);
                });

                if (productData.variantsLabel) {
                    const variantsLabel = formInstance.querySelector('.variants-label');
                    if (variantsLabel) variantsLabel.textContent = productData.variantsLabel;
                }

                priceVariantSelector.addEventListener('change', updateTotalPrice);
            } else {
                priceVariantSelectorContainer.classList.add('hidden');
                priceVariantSelector.required = false;
            }

            const kitOptionsContainer = formInstance.querySelector('.kit-options-container');
            if (productData.priceType === 'kit' && productData.kitItems && productData.kitItems.length > 0) {
                kitOptionsContainer.classList.remove('hidden');
                kitOptionsContainer.innerHTML = '';
                
                productData.kitItems.forEach((item, index) => {
                    const itemDiv = document.createElement('div');
                    itemDiv.innerHTML = `
                        <label for="kit-item-${i}-${index}" class="block text-sm font-semibold text-gray-300 mb-1">Selecione o tamanho/opção para: <span class="text-white">${item.name}</span></label>
                        <select id="kit-item-${i}-${index}" name="kit-item-select" data-item-name="${item.name}" class="w-full px-4 py-3 opacity-90 rounded-lg bg-gray-800 border border-gray-600 text-white shadow-sm focus:outline-none focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500" required>
                            <option value="" disabled selected>Escolha uma opção...</option>
                            ${item.options.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                        </select>
                    `;
                    kitOptionsContainer.appendChild(itemDiv);
                });
            } else {
                if (kitOptionsContainer) kitOptionsContainer.classList.add('hidden');
            }

            const addonsOptionsContainer = formInstance.querySelector('.addons-options-container');
            if (productData.addons && productData.addons.length > 0) {
                addonsOptionsContainer.classList.remove('hidden');
                addonsOptionsContainer.innerHTML = '';
                
                productData.addons.forEach((addon, index) => {
                    const priceFormatted = (addon.price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                    const addonDiv = document.createElement('div');
                    addonDiv.innerHTML = `
                        <label class="flex items-start space-x-3 p-3 rounded-lg border border-gray-700 bg-gray-800/50 hover:bg-gray-800 transition-colors cursor-pointer group">
                            <div class="flex items-center h-5 mt-1">
                                <input type="checkbox" name="addon-checkbox-${i}" value="${index}" data-addon-name="${addon.name}" data-addon-price="${addon.price}" class="addon-checkbox w-5 h-5 text-yellow-500 bg-gray-900 border-gray-600 rounded focus:ring-yellow-500 focus:ring-offset-gray-800">
                            </div>
                            <div class="flex-1">
                                <span class="block text-base font-medium text-gray-200 group-hover:text-white">${addon.name}</span>
                                <span class="block text-sm text-yellow-500 font-semibold mt-0.5">+ ${priceFormatted}</span>
                            </div>
                        </label>
                    `;
                    addonsOptionsContainer.appendChild(addonDiv);
                });
                
                const checkboxes = addonsOptionsContainer.querySelectorAll('.addon-checkbox');
                checkboxes.forEach(cb => cb.addEventListener('change', updateTotalPrice));
            } else {
                if (addonsOptionsContainer) addonsOptionsContainer.classList.add('hidden');
            }

            const sizeSelectorContainer = formInstance.querySelector('.size-selector-container');
            const sizeSelector = formInstance.querySelector('[name="size-selector"]');
            if (productData.hasSizes && productData.sizes && productData.sizes.length > 0 && !isExtraTicket) {
                sizeSelectorContainer.classList.remove('hidden');
                sizeSelector.required = true;
                
                const sizesLabelText = productData.sizesLabel || 'Escolha o Tamanho';
                const sizesLabel = formInstance.querySelector('.sizes-label');
                if (sizesLabel) sizesLabel.textContent = sizesLabelText;
                
                sizeSelector.innerHTML = `<option value="" disabled selected>${sizesLabelText}</option>`;
                productData.sizes.forEach(size => {
                    const option = document.createElement('option');
                    option.value = size;
                    
                    // If this product controls stock per size, mark out-of-stock sizes
                    if (productData.controlStock && productData.hasSizes && productData.sizeStock) {
                        const qty = productData.sizeStock[size] !== undefined ? productData.sizeStock[size] : 0;
                        if (qty <= 0) {
                            option.disabled = true;
                            option.textContent = `${size} — Esgotado`;
                        } else if (qty <= 5) {
                            option.textContent = `${size} 🔥 (${qty} restante${qty === 1 ? '' : 's'})`;
                        } else {
                            option.textContent = size;
                        }
                    } else {
                        option.textContent = size;
                    }
                    sizeSelector.appendChild(option);
                });

                // Show per-size stock when user selects a size
                if (productData.controlStock && productData.sizeStock) {
                    sizeSelector.addEventListener('change', () => {
                        const selected = sizeSelector.value;
                        if (!selected) return;
                        const qty = productData.sizeStock[selected] !== undefined ? productData.sizeStock[selected] : null;
                        if (productStockDisplay && qty !== null) {
                            productStockDisplay.classList.remove('hidden');
                            if (qty <= 0) {
                                productStockDisplay.innerHTML = `<span class="text-red-500 font-bold">🚫 Tamanho ${selected} esgotado</span>`;
                            } else if (qty <= 5) {
                                productStockDisplay.innerHTML = `<span class="text-red-400 font-bold">🔥 Últimas ${qty} unidade${qty === 1 ? '' : 's'} do tamanho ${selected}!</span>`;
                            } else {
                                productStockDisplay.textContent = `${qty} unidades disponíveis no tamanho ${selected}`;
                            }
                        }
                    });
                }
            } else {
                sizeSelectorContainer.classList.add('hidden');
                sizeSelector.required = false;
            }

            formsContainer.appendChild(formClone);
        }
        
        updateTotalPrice();
    };



    const updateTotalPrice = () => {
        let totalAmount = 0;
        const formInstances = formsContainer.querySelectorAll('.form-instance');
        let activeLoteName = null;

        const hasExtraTicketMode = Boolean(productData && productData.hasSeatMap && (productData.hasExtraTicketPrice || productData.extraTicketPrice > 0));
        const includedTicketsCount = (productData && productData.includedTicketsCount !== undefined) ? productData.includedTicketsCount : 1;

        formInstances.forEach((form, idx) => {
            let instancePrice = 0;
            const isExtraTicket = hasExtraTicketMode && (currentPurchaseMode === 'extra_only' || (idx >= includedTicketsCount));

            if (isExtraTicket) {
                instancePrice = productData.extraTicketPrice || 0;
            } else if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = selector ? productData.priceVariants[selector.value] : productData.priceVariants[0];
                if (selectedVariant) {
                    instancePrice = selectedVariant.price;
                }
            } else if (productData.priceType === 'lotes' && productData.lotes && productData.lotes.length > 0) {
                const now = new Date();
                let activeLote = null;
                for (const lote of productData.lotes) {
                    const startDate = new Date(lote.startDate);
                    if (startDate <= now) {
                        activeLote = lote;
                    }
                }
                if (activeLote) {
                    instancePrice = activeLote.price;
                    activeLoteName = activeLote.name;
                } else {
                    // Fallback to the first lote if none is active yet
                    instancePrice = productData.lotes[0].price;
                    activeLoteName = productData.lotes[0].name;
                }
            } else if (productData.priceType === 'kit') {
                instancePrice = productData.kitBasePrice || productData.price || 0;
            } else {
                instancePrice = productData.price || 0;
            }

            // Somar Addons apenas para a inscrição principal
            if (!isExtraTicket) {
                const checkedAddons = form.querySelectorAll('.addon-checkbox:checked');
                checkedAddons.forEach(addon => {
                    instancePrice += parseInt(addon.dataset.addonPrice, 10);
                });
            }

            totalAmount += instancePrice;
        });

        if (activeLoteName) {
            productLoteDisplay.textContent = activeLoteName;
            productLoteDisplay.classList.remove('hidden');
        } else {
            productLoteDisplay.classList.add('hidden');
        }

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                totalAmount -= totalAmount * (appliedCoupon.value / 100);
            } else if (appliedCoupon.type === 'fixed') {
                totalAmount -= appliedCoupon.value;
            }
        }

        document.querySelectorAll('.recommended-product-quantity').forEach(select => {
            const quantity = parseInt(select.value, 10);
            if (quantity > 0) {
                const price = parseInt(select.dataset.productPrice, 10);
                totalAmount += price * quantity;
            }
        });

        let priceText = (totalAmount / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        if (productData.isSubscription) {
            const periodMap = { 'months': 'Mês', 'years': 'Ano', 'days': 'Dia' };
            const periodName = periodMap[productData.subscriptionPeriod] || 'Mês';
            const freq = productData.subscriptionFrequency || 1;
            if (freq > 1) {
                priceText += ` / ${freq} ${periodName}s`;
            } else {
                priceText += ` / ${periodName}`;
            }
        }

        if (productData.hasSeatMap && getAllSelectedSeats().length === 0 && currentPurchaseMode === 'extra_only') {
            const extraFormatted = ((productData.extraTicketPrice || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            productPriceDisplay.innerHTML = `${extraFormatted} <span class="text-xs text-gray-400 font-normal">/ ingresso</span>`;
            return;
        }

        productPriceDisplay.textContent = priceText;
    };

    const applyCoupon = async () => {
        const code = couponCodeInput.value.trim();
        if (!code) {
            couponStatus.textContent = 'Por favor, insira um código de cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
            return;
        }

        try {
            const qUpper = query(collection(db, 'coupons'), where('code', '==', code.toUpperCase()));
            const qLower = query(collection(db, 'coupons'), where('code', '==', code.toLowerCase()));
            const [snapUpper, snapLower] = await Promise.all([getDocs(qUpper), getDocs(qLower)]);
            
            const querySnapshot = !snapUpper.empty ? snapUpper : snapLower;

            if (querySnapshot.empty) {
                couponStatus.textContent = 'Cupom inválido.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotalPrice();
                return;
            }

            const couponDoc = querySnapshot.docs[0];
            const coupon = { id: couponDoc.id, ...couponDoc.data() };

            if (coupon.expiry && new Date(coupon.expiry) < new Date()) {
                couponStatus.textContent = 'Cupom expirado.';
                couponStatus.className = 'mt-2 text-sm text-red-400';
                appliedCoupon = null;
                updateTotalPrice();
                return;
            }

            appliedCoupon = coupon;
            couponStatus.textContent = 'Cupom aplicado com sucesso!';
            couponStatus.className = 'mt-2 text-sm text-green-400';
            updateTotalPrice();

        } catch (error) {
            console.error('Error applying coupon:', error);
            couponStatus.textContent = 'Erro ao aplicar o cupom.';
            couponStatus.className = 'mt-2 text-sm text-red-400';
        }
    };

    applyCouponBtn.addEventListener('click', applyCoupon);

    quantitySelector.addEventListener('change', () => {
        renderForms(parseInt(quantitySelector.value, 10));
    });

    const handleFormSubmit = async (event) => {
        event.preventDefault();
        payButton.disabled = true;
        formStatus.textContent = 'Processando seu pagamento...';

        const formInstances = formsContainer.querySelectorAll('.form-instance');
        const formDataList = [];
        let totalAmount = 0;
        const recommendedItems = [];

        // Re-read product ID at the time of submission for robustness
        const currentProductId = getProductId();
        if (!currentProductId) {
            formStatus.textContent = 'Erro: ID do produto não encontrado. Por favor, recarregue a página.';
            payButton.disabled = false;
            return;
        }

        document.querySelectorAll('.recommended-product-quantity').forEach(select => {
            const quantity = parseInt(select.value, 10);
            if (quantity > 0) {
                const productId = select.dataset.productId;
                const productPrice = parseInt(select.dataset.productPrice, 10);
                recommendedItems.push({
                    productId: productId,
                    productName: select.closest('.flex').querySelector('h4').textContent,
                    amount: productPrice * quantity,
                    quantity: quantity
                });
                totalAmount += productPrice * quantity;
            }
        });

        // Seat Map Validation & Locking
        if (productData.hasSeatMap) {
            const all = getAllSelectedSeats();
            if (all.length === 0) {
                formStatus.textContent = 'Por favor, selecione pelo menos uma cadeira no mapa de assentos acima.';
                formStatus.className = 'mt-6 text-center text-lg text-amber-400 font-bold';
                payButton.disabled = false;
                if (seatMapSection) {
                    seatMapSection.scrollIntoView({ behavior: 'smooth' });
                }
                return;
            }

            try {
                formStatus.textContent = 'Reservando suas cadeiras no mapa...';
                const userIdentifier = getUserIdentifier();

                // Bloqueia as cadeiras para cada sessão selecionada
                for (const [sessId, group] of Object.entries(selectedSeatsBySession)) {
                    if (!group.seats || group.seats.length === 0) continue;
                    const lockRes = await fetch('https://us-central1-intranet-kihap.cloudfunctions.net/lockSeats', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            productId: currentProductId,
                            sessionId: sessId,
                            seatIds: group.seats,
                            userIdentifier: userIdentifier
                        })
                    });

                    if (!lockRes.ok) {
                        const errJson = await lockRes.json();
                        throw new Error(`Sessão "${group.session?.name || ''}": ` + (errJson.error || 'Um ou mais assentos selecionados não estão mais disponíveis.'));
                    }
                }
            } catch (err) {
                console.error('Lock Seats Error:', err);
                formStatus.textContent = err.message || 'Erro ao reservar assentos.';
                formStatus.className = 'mt-6 text-center text-lg text-red-500 font-bold';
                payButton.disabled = false;
                return;
            }
        }

        const hasExtraTicketMode = Boolean(productData && productData.hasSeatMap && (productData.hasExtraTicketPrice || productData.extraTicketPrice > 0));
        const includedTicketsCount = (productData && productData.includedTicketsCount !== undefined) ? productData.includedTicketsCount : 1;

        formInstances.forEach((form, idx) => {
            const isExtraTicket = hasExtraTicketMode && (currentPurchaseMode === 'extra_only' || (idx >= includedTicketsCount));
            const formData = {
                isExtraTicket: isExtraTicket,
                isMainParticipant: !isExtraTicket,
                userAge: isExtraTicket ? null : (form.querySelector('[name="idade"]') && !form.querySelector('.age-container').classList.contains('hidden') ? form.querySelector('[name="idade"]').value : null),
                userSize: isExtraTicket ? null : (form.querySelector('[name="size-selector"]') && !form.querySelector('.size-selector-container').classList.contains('hidden') ? form.querySelector('[name="size-selector"]').value : null),
                userProfessor: isExtraTicket ? null : (form.querySelector('[name="professor-selector"]') && !form.querySelector('.professor-container').classList.contains('hidden') ? form.querySelector('[name="professor-selector"]').value : null),
            };

            if (productData.hasSeatMap) {
                const all = getAllSelectedSeats();
                const seatItem = all[idx];
                if (seatItem) {
                    formData.seatId = seatItem.seatId;
                    formData.sessionId = seatItem.sessionId;
                    formData.sessionName = seatItem.sessionName;
                    formData.sessionDate = seatItem.sessionDate;
                    formData.sessionTime = seatItem.sessionTime;
                    formData.sessionLabel = seatItem.sessionLabel;
                    formData.locationId = seatItem.locationId || null;
                    formData.locationName = seatItem.locationName || null;
                    formData.locationVenue = seatItem.locationVenue || null;
                    formData.locationAddress = seatItem.locationAddress || null;
                }
            }

            let priceData = {};
            let kitSelections = null;
            if (isExtraTicket) {
                priceData.variantName = (currentPurchaseMode === 'extra_only') ? 'Ingresso Acompanhante' : 'Ingresso Adicional (Acompanhante)';
                priceData.amount = productData.extraTicketPrice || 0;
            } else if (productData.priceType === 'variable' && productData.priceVariants && productData.priceVariants.length > 0) {
                const selector = form.querySelector('[name="price-variant-selector"]');
                const selectedVariant = productData.priceVariants[selector.value];
                if (selectedVariant) {
                    priceData.variantName = selectedVariant.name;
                    priceData.amount = selectedVariant.price;
                    if (selectedVariant.pixPrice) {
                        priceData.pixAmount = selectedVariant.pixPrice;
                    }
                } else {
                    priceData.amount = productData.price;
                    if (productData.pixPrice) {
                        priceData.pixAmount = productData.pixPrice;
                    }
                }
            } else if (productData.priceType === 'kit') {
                priceData.amount = productData.kitBasePrice || productData.price || 0;
                const kitSelects = form.querySelectorAll('select[name="kit-item-select"]');
                if (kitSelects.length > 0) {
                    kitSelections = {};
                    kitSelects.forEach(select => {
                        kitSelections[select.dataset.itemName] = select.value;
                    });
                }
            } else {
                priceData.amount = productData.price;
                if (productData.pixPrice) {
                    priceData.pixAmount = productData.pixPrice;
                }
            }

            let addonsSelected = null;
            const checkedAddons = form.querySelectorAll('.addon-checkbox:checked');
            if (checkedAddons.length > 0) {
                addonsSelected = [];
                checkedAddons.forEach(addon => {
                    addonsSelected.push({
                        name: addon.dataset.addonName,
                        price: parseInt(addon.dataset.addonPrice, 10)
                    });
                    priceData.amount += parseInt(addon.dataset.addonPrice, 10);
                });
            }

            formData.priceData = priceData;
            if (kitSelections) {
                formData.kitSelections = kitSelections;
            }
            if (addonsSelected) {
                formData.addonsSelected = addonsSelected;
            }
            totalAmount += priceData.amount;
            formDataList.push(formData);
        });

        if (appliedCoupon) {
            if (appliedCoupon.type === 'percentage') {
                totalAmount -= totalAmount * (appliedCoupon.value / 100);
            } else if (appliedCoupon.type === 'fixed') {
                totalAmount -= appliedCoupon.value;
            }
        }

        try {
            cart.addItem({
                productId: currentProductId,
                productName: (currentPurchaseMode === 'extra_only') ? `${productData.name} (Ingressos Acompanhante)` : productData.name,
                purchaseMode: currentPurchaseMode,
                isExtraTicketOnly: (currentPurchaseMode === 'extra_only'),
                imageUrl: productData.imageUrl,
                isSubscription: productData.isSubscription || false,
                subscriptionFrequency: productData.subscriptionFrequency || null,
                subscriptionPeriod: productData.subscriptionPeriod || null,
                priceType: productData.priceType,
                customUnits: productData.customUnits || [],
                formDataList: formDataList,
                totalAmount: totalAmount,
                recommendedItems: recommendedItems,
                availableProfessors: productData.availableProfessors || [],
                coupon: appliedCoupon ? appliedCoupon.code : null,
                hasSeatMap: !!productData.hasSeatMap,
                locationId: (productData.hasLocations && selectedLocation) ? selectedLocation.id : null,
                locationName: (() => {
                    const all = getAllSelectedSeats();
                    const locs = Array.from(new Set(all.map(s => s.locationName).filter(Boolean)));
                    return locs.join(' | ') || (selectedLocation ? selectedLocation.name : null);
                })(),
                locationVenue: (productData.hasLocations && selectedLocation) ? (selectedLocation.venue || '') : null,
                locationAddress: (productData.hasLocations && selectedLocation) ? (selectedLocation.address || '') : null,
                sessionId: (() => {
                    const all = getAllSelectedSeats();
                    return all[0]?.sessionId || (selectedSession ? selectedSession.id : null);
                })(),
                sessionLabel: (() => {
                    const all = getAllSelectedSeats();
                    const sessList = Array.from(new Set(all.map(s => s.sessionLabel).filter(Boolean)));
                    return sessList.join(' | ') || (selectedSession ? (selectedSession.label || selectedSession.name) : null);
                })(),
                seats: (() => {
                    const all = getAllSelectedSeats();
                    return all.map(s => s.seatId);
                })(),
                hasExtraTicketPrice: Boolean(productData.hasExtraTicketPrice),
                extraTicketPrice: productData.extraTicketPrice || 0,
                includedTicketsCount: (productData.includedTicketsCount !== undefined) ? productData.includedTicketsCount : 1,
                lockExpiresAt: productData.hasSeatMap ? (Date.now() + 15 * 60 * 1000) : null,
                addedAt: new Date().toISOString()
            });

            formStatus.textContent = 'Produto adicionado ao carrinho com sucesso!';
            formStatus.className = 'mt-6 text-center text-lg text-green-500';
            
            setTimeout(() => {
                window.location.href = 'cart.html';
            }, 1000);
            
        } catch (error) {
            console.error('Cart Error:', error);
            formStatus.textContent = `Erro ao adicionar ao carrinho: ${error.message}`;
            formStatus.className = 'mt-6 text-center text-lg text-red-500';
            payButton.disabled = false;
        }
    };

    onAuthReady(async (user) => {
        if (user) {
            const userData = await getUserData(user.uid);
            if (userData) {
                currentUser = { uid: user.uid, ...userData };
            }
        }
    });

    const checkAppDeepLink = () => {
        const params = new URLSearchParams(window.location.search);
        const shouldOpenApp = params.get('app') === '1';
        const id = params.get('id');
        if (!id) return;

        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        const nativeUrl = `native://store/${id}`;

        if (shouldOpenApp && isMobile) {
            // Tenta abrir o app nativo caso o aluno tenha o app instalado
            window.location.href = nativeUrl;
        }

        const mainEl = document.querySelector('main');
        if (mainEl && isMobile) {
            const banner = document.createElement('div');
            banner.className = 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-4';
            banner.innerHTML = `
                <a href="${nativeUrl}" class="flex items-center justify-between p-3.5 bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 rounded-2xl text-white hover:border-amber-400 transition-all shadow-md">
                    <div class="flex items-center gap-3">
                        <img src="https://kihap.com.br/imgs/favicon.png" class="w-8 h-8 object-contain">
                        <div>
                            <div class="text-xs font-black text-amber-400 uppercase tracking-wider">Tem o App Kihap instalado?</div>
                            <div class="text-xs text-gray-300">Toque aqui para abrir e comprar direto pelo aplicativo</div>
                        </div>
                    </div>
                    <span class="px-3 py-1.5 bg-amber-500 text-black text-xs font-black rounded-xl whitespace-nowrap ml-2">Abrir no App</span>
                </a>
            `;
            mainEl.prepend(banner);
        }
    };

    const init = async () => {
        productId = getProductId();
        checkAppDeepLink();
        await fetchInstructors();
        await fetchProduct(productId);
        paymentForm.addEventListener('submit', handleFormSubmit);
    };

    init();
});
