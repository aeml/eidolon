/**
 * Trading House UI module — handles auction browsing, listing, bidding,
 * buying out, and collecting/cancelling auctions.
 *
 * Extracted from UIManager to keep each UI domain independently readable.
 * The parent UIManager passes shared helpers via the `ctx` object.
 */
export class TradingUI {
    /**
     * @param {Object} ctx
     * @param {Function} ctx.getLastPlayer      – returns current player ref
     * @param {Function} ctx.getItemIconPath     – returns icon URL for an item
     * @param {Function} ctx.getRarityColor      – returns CSS color string for rarity
     * @param {Function} ctx.showItemTooltip     – (item, x, y) shows tooltip
     * @param {Function} ctx.hideTooltips        – hides all tooltips
     * @param {Function} ctx.addChatMessage      – (sender, msg) adds system chat
     */
    constructor(ctx) {
        this.ctx = ctx;

        // --- DOM refs ---
        this.tradingHouseScreen = document.getElementById('trading-house-screen');
        this.btnCloseTradingHouse = document.getElementById('btn-close-trading-house');

        this.tabTradingBid = document.getElementById('tab-trading-bid');
        this.tabTradingList = document.getElementById('tab-trading-list');
        this.tabTradingMy = document.getElementById('tab-trading-my');
        this.panelTradingBid = document.getElementById('trading-panel-bid');
        this.panelTradingList = document.getElementById('trading-panel-list');
        this.panelTradingMy = document.getElementById('trading-panel-my');

        this.tradingSearchInput = document.getElementById('trading-search-input');
        this.btnTradingSearch = document.getElementById('btn-trading-search');
        this.tradingListContainer = document.getElementById('trading-list-container');

        this.tradingSellSlot = document.getElementById('trading-sell-slot');
        this.tradingInputBid = document.getElementById('trading-input-bid');
        this.tradingInputBuyout = document.getElementById('trading-input-buyout');
        this.tradingInputDuration = document.getElementById('trading-input-duration');
        this.btnTradingCreate = document.getElementById('btn-trading-create');
        this.tradingInventoryList = document.getElementById('trading-inventory-list');

        this.tradingMyList = document.getElementById('trading-my-list');

        // --- State ---
        this.selectedTradingItem = null;

        // --- Callbacks (set by GameEngine) ---
        this.onTradingSearch = null;
        this.onTradingCreate = null;
        this.onTradingMyAuctions = null;
        this.onTradingBuyout = null;
        this.onTradingBid = null;
        this.onTradingCollect = null;
        this.onTradingCancel = null;

        // --- Event listeners ---
        if (this.btnCloseTradingHouse) {
            this.btnCloseTradingHouse.addEventListener('click', () => this.toggle());
        }
        if (this.tabTradingBid) this.tabTradingBid.addEventListener('click', () => this.switchTab('bid'));
        if (this.tabTradingList) this.tabTradingList.addEventListener('click', () => this.switchTab('list'));
        if (this.tabTradingMy) this.tabTradingMy.addEventListener('click', () => this.switchTab('my'));
        if (this.btnTradingSearch) this.btnTradingSearch.addEventListener('click', () => this.handleSearch());
        if (this.btnTradingCreate) this.btnTradingCreate.addEventListener('click', () => this.handleCreate());
    }

    // ================================================================
    // PUBLIC API
    // ================================================================

    /** Whether the trading house window is currently visible. */
    get isOpen() {
        return this.tradingHouseScreen &&
               this.tradingHouseScreen.style.display === 'flex';
    }

    /** Toggle trading house open/closed. */
    toggle() {
        if (!this.tradingHouseScreen) return;

        const isHidden = this.tradingHouseScreen.style.display === 'none' || this.tradingHouseScreen.style.display === '';
        this.tradingHouseScreen.style.display = isHidden ? 'flex' : 'none';

        if (isHidden) {
            this.switchTab('bid');
            if (this.ctx.getLastPlayer()) {
                this.handleSearch();
            }
        } else {
            this.selectedTradingItem = null;
        }
    }

    /** Close the trading house if open. */
    close() {
        if (this.tradingHouseScreen) {
            this.tradingHouseScreen.style.display = 'none';
        }
    }

    // ================================================================
    // TAB MANAGEMENT
    // ================================================================

    switchTab(tab) {
        if (this.tabTradingBid) this.tabTradingBid.classList.toggle('is-active', tab === 'bid');
        if (this.tabTradingList) this.tabTradingList.classList.toggle('is-active', tab === 'list');
        if (this.tabTradingMy) this.tabTradingMy.classList.toggle('is-active', tab === 'my');

        if (this.panelTradingBid) this.panelTradingBid.style.display = 'none';
        if (this.panelTradingList) this.panelTradingList.style.display = 'none';
        if (this.panelTradingMy) this.panelTradingMy.style.display = 'none';

        if (tab === 'bid') {
            if (this.panelTradingBid) this.panelTradingBid.style.display = 'flex';
            this.handleSearch();
        } else if (tab === 'list') {
            if (this.panelTradingList) this.panelTradingList.style.display = 'flex';
            const player = this.ctx.getLastPlayer();
            if (player) {
                this.updateInventory(player);
            }
        } else if (tab === 'my') {
            if (this.panelTradingMy) this.panelTradingMy.style.display = 'flex';
            if (this.onTradingMyAuctions) this.onTradingMyAuctions();
        }
    }

    // ================================================================
    // SEARCH / CREATE
    // ================================================================

    handleSearch() {
        const query = this.tradingSearchInput ? this.tradingSearchInput.value : '';
        if (this.onTradingSearch) {
            this.onTradingSearch(query);
        }
    }

    handleCreate() {
        if (!this.selectedTradingItem) {
            if (this.ctx.addChatMessage) this.ctx.addChatMessage("System", "Select an item to sell first.");
            return;
        }

        const bid = parseInt(this.tradingInputBid.value);
        const buyout = parseInt(this.tradingInputBuyout.value);
        const duration = parseInt(this.tradingInputDuration.value);

        if (isNaN(bid) || isNaN(buyout) || bid <= 0 || buyout <= 0) {
            if (this.ctx.addChatMessage) this.ctx.addChatMessage("System", "Invalid price.");
            return;
        }

        if (buyout < bid) {
            if (this.ctx.addChatMessage) this.ctx.addChatMessage("System", "Buyout cannot be less than starting bid.");
            return;
        }

        if (this.onTradingCreate) {
            this.onTradingCreate(this.selectedTradingItem.slot, bid, buyout, duration);
            this.selectedTradingItem = null;
            this.tradingSellSlot.innerHTML = '<span style="font-size: 30px; color: #444;">+</span>';
            this.tradingSellSlot.style.backgroundImage = 'none';
            this.switchTab('my');
        }
    }

    // ================================================================
    // INVENTORY (listing tab)
    // ================================================================

    updateInventory(player) {
        if (!this.tradingInventoryList) return;
        this.tradingInventoryList.innerHTML = '';

        player.inventory.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'inv-slot';
            el.style.width = '40px';
            el.style.height = '40px';

            if (item && item.id) {
                const iconPath = this.ctx.getItemIconPath(item);
                el.style.backgroundImage = `url('${iconPath}')`;
                el.style.backgroundSize = 'contain';
                el.style.backgroundRepeat = 'no-repeat';
                el.style.backgroundPosition = 'center';

                if (item.rarity) {
                    const color = this.ctx.getRarityColor(item.rarity);
                    el.style.borderColor = color;
                }

                el.onclick = () => this.selectItem(item, index);
                el.onmouseenter = (e) => {
                    if (this.ctx.showItemTooltip) this.ctx.showItemTooltip(item, e.clientX, e.clientY);
                };
                el.onmouseleave = () => {
                    if (this.ctx.hideTooltips) this.ctx.hideTooltips();
                };
            }
            this.tradingInventoryList.appendChild(el);
        });
    }

    selectItem(item, slotIndex) {
        this.selectedTradingItem = { ...item, slot: slotIndex };

        const iconPath = this.ctx.getItemIconPath(item);
        this.tradingSellSlot.innerHTML = '';
        this.tradingSellSlot.style.backgroundImage = `url('${iconPath}')`;
        this.tradingSellSlot.style.backgroundSize = 'contain';
        this.tradingSellSlot.style.backgroundRepeat = 'no-repeat';
        this.tradingSellSlot.style.backgroundPosition = 'center';

        if (item.rarity) {
            const color = this.ctx.getRarityColor(item.rarity);
            this.tradingSellSlot.style.border = `2px solid ${color}`;
        }
    }

    // ================================================================
    // AUCTION RENDERING
    // ================================================================

    renderAuctionList(auctions) {
        if (!this.tradingListContainer) return;
        this.tradingListContainer.innerHTML = '';

        if (!auctions || auctions.length === 0) {
            this.tradingListContainer.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">No auctions found.</div>';
            return;
        }

        auctions.forEach(auction => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr';
            row.style.padding = '5px';
            row.style.borderBottom = '1px solid #444';
            row.style.alignItems = 'center';
            row.style.fontSize = '12px';

            // Item Name (with color)
            const nameSpan = document.createElement('span');
            nameSpan.textContent = auction.item.name;
            nameSpan.style.color = this.ctx.getRarityColor(auction.item.rarity);
            nameSpan.style.cursor = 'pointer';
            nameSpan.onmouseenter = (e) => {
                if (this.ctx.showItemTooltip) this.ctx.showItemTooltip(auction.item, e.clientX, e.clientY);
            };
            nameSpan.onmouseleave = () => {
                if (this.ctx.hideTooltips) this.ctx.hideTooltips();
            };
            row.appendChild(nameSpan);

            // Seller
            const sellerSpan = document.createElement('span');
            sellerSpan.textContent = auction.sellerName;
            sellerSpan.style.color = '#aaa';
            row.appendChild(sellerSpan);

            // Price
            const priceSpan = document.createElement('span');
            priceSpan.innerHTML = `<span style="color: #ffd700;">${auction.currentBid}</span> / <span style="color: #ffd700;">${auction.buyoutPrice}</span>`;
            row.appendChild(priceSpan);

            // Action
            const actionDiv = document.createElement('div');
            actionDiv.style.display = 'flex';
            actionDiv.style.gap = '5px';

            const btnBid = document.createElement('button');
            btnBid.textContent = 'Bid';
            btnBid.className = 'btn-menu';
            btnBid.style.fontSize = '10px';
            btnBid.style.padding = '2px 5px';
            btnBid.onclick = () => {
                let minBid = auction.currentBid + Math.ceil(auction.currentBid * 0.05);
                if (minBid < auction.currentBid + 1) minBid = auction.currentBid + 1;
                if (!auction.bidderId) minBid = auction.currentBid;

                const amount = prompt(`Enter bid amount (Minimum: ${minBid})`, minBid);
                if (amount !== null) {
                    const val = parseInt(amount);
                    if (!isNaN(val)) {
                        if (this.onTradingBid) this.onTradingBid(auction.id, val);
                    }
                }
            };
            actionDiv.appendChild(btnBid);

            const btnBuy = document.createElement('button');
            btnBuy.textContent = 'Buyout';
            btnBuy.className = 'btn-menu';
            btnBuy.style.fontSize = '10px';
            btnBuy.style.padding = '2px 5px';
            btnBuy.onclick = () => {
                if (this.onTradingBuyout) this.onTradingBuyout(auction.id);
            };
            actionDiv.appendChild(btnBuy);

            row.appendChild(actionDiv);
            this.tradingListContainer.appendChild(row);
        });
    }

    renderMyAuctions(auctions) {
        if (!this.tradingMyList) return;
        this.tradingMyList.innerHTML = '';

        if (!auctions || auctions.length === 0) {
            this.tradingMyList.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">You have no active auctions.</div>';
            return;
        }

        auctions.forEach(auction => {
            const row = document.createElement('div');
            row.style.display = 'grid';
            row.style.gridTemplateColumns = '2fr 1fr 1fr 1fr';
            row.style.padding = '5px';
            row.style.borderBottom = '1px solid #444';
            row.style.alignItems = 'center';
            row.style.fontSize = '12px';

            // Item Name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = auction.item.name;
            nameSpan.style.color = this.ctx.getRarityColor(auction.item.rarity);
            row.appendChild(nameSpan);

            // Status
            const statusSpan = document.createElement('span');
            statusSpan.textContent = auction.status;
            statusSpan.style.color = auction.status === 'SOLD' ? '#0f0' : (auction.status === 'EXPIRED' ? '#f00' : '#fff');
            row.appendChild(statusSpan);

            // Price
            const priceSpan = document.createElement('span');
            priceSpan.innerHTML = `<span style="color: #ffd700;">${auction.currentBid}</span>`;
            row.appendChild(priceSpan);

            // Action
            const actionDiv = document.createElement('div');

            if (auction.status === 'SOLD') {
                const btnCollect = document.createElement('button');
                btnCollect.textContent = 'Collect Gold';
                btnCollect.className = 'btn-menu';
                btnCollect.style.fontSize = '10px';
                btnCollect.style.padding = '2px 5px';
                btnCollect.onclick = () => {
                    if (this.onTradingCollect) this.onTradingCollect(auction.id);
                };
                actionDiv.appendChild(btnCollect);
            } else if (auction.status === 'EXPIRED' || auction.status === 'CANCELLED') {
                const btnReclaim = document.createElement('button');
                btnReclaim.textContent = 'Reclaim Item';
                btnReclaim.className = 'btn-menu';
                btnReclaim.style.fontSize = '10px';
                btnReclaim.style.padding = '2px 5px';
                btnReclaim.onclick = () => {
                    if (this.onTradingCollect) this.onTradingCollect(auction.id);
                };
                actionDiv.appendChild(btnReclaim);
            } else {
                const btnCancel = document.createElement('button');
                btnCancel.textContent = 'Cancel';
                btnCancel.className = 'btn-menu';
                btnCancel.style.fontSize = '10px';
                btnCancel.style.padding = '2px 5px';
                btnCancel.style.background = '#500';
                btnCancel.onclick = () => {
                    if (this.onTradingCancel) this.onTradingCancel(auction.id);
                };
                actionDiv.appendChild(btnCancel);
            }

            row.appendChild(actionDiv);
            this.tradingMyList.appendChild(row);
        });
    }
}
