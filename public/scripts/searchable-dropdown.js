/**
 * Searchable Dropdown Component
 * Provides fuzzy search with category grouping for CPU/GPU selection
 */

export class SearchableDropdown {
    constructor(selectElement, items, config = {}) {
        this.select = selectElement;
        this.items = items;
        this.config = {
            groupBy: config.groupBy || 'generation',
            searchKeys: config.searchKeys || ['name', 'generation'],
            placeholder: config.placeholder || 'Search...',
            onSelect: config.onSelect || (() => { }),
        };

        this.isOpen = false;
        this.filteredItems = items;
        this.selectedIndex = -1;

        this.init();
    }

    init() {
        // Hide original select
        this.select.style.display = 'none';

        // Create custom dropdown
        this.wrapper = document.createElement('div');
        this.wrapper.className = 'searchable-dropdown';

        this.trigger = document.createElement('div');
        this.trigger.className = 'dropdown-trigger';
        this.trigger.innerHTML = `
            <span class="dropdown-value">${this.getSelectedText()}</span>
            <i class="ph-bold ph-caret-down dropdown-icon"></i>
        `;

        this.dropdown = document.createElement('div');
        this.dropdown.className = 'dropdown-panel';
        this.dropdown.innerHTML = `
            <div class="dropdown-search">
                <i class="ph-bold ph-magnifying-glass search-icon"></i>
                <input type="text" class="search-input" placeholder="${this.config.placeholder}" />
            </div>
            <div class="dropdown-results"></div>
        `;

        this.wrapper.appendChild(this.trigger);
        this.wrapper.appendChild(this.dropdown);
        this.select.parentNode.insertBefore(this.wrapper, this.select);

        this.searchInput = this.dropdown.querySelector('.search-input');
        this.resultsContainer = this.dropdown.querySelector('.dropdown-results');

        this.bindEvents();
        this.renderResults();
    }

    bindEvents() {
        this.trigger.addEventListener('click', () => this.toggle());

        this.searchInput.addEventListener('input', (e) => {
            this.filter(e.target.value);
        });

        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                this.navigateResults(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                this.navigateResults(-1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                this.selectHighlighted();
            } else if (e.key === 'Escape') {
                this.close();
            }
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            if (!this.wrapper.contains(e.target)) {
                this.close();
            }
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.wrapper.classList.add('open');
        this.searchInput.focus();
        this.searchInput.select();
    }

    close() {
        this.isOpen = false;
        this.wrapper.classList.remove('open');
        this.searchInput.value = '';
        this.filter('');
    }

    filter(query) {
        if (!query.trim()) {
            this.filteredItems = this.items;
        } else {
            const lowerQuery = query.toLowerCase();
            this.filteredItems = this.items.filter(item => {
                return this.config.searchKeys.some(key => {
                    const value = item[key];
                    if (!value) return false;
                    return value.toString().toLowerCase().includes(lowerQuery);
                });
            });
        }

        this.selectedIndex = -1;
        this.renderResults();
    }

    renderResults() {
        if (this.filteredItems.length === 0) {
            this.resultsContainer.innerHTML = '<div class="no-results">No matches found</div>';
            return;
        }

        // Group by generation
        const grouped = {};
        this.filteredItems.forEach(item => {
            const group = item[this.config.groupBy] || 'Other';
            if (!grouped[group]) grouped[group] = [];
            grouped[group].push(item);
        });

        let html = '';
        Object.entries(grouped).forEach(([generation, items]) => {
            html += `<div class="result-group">`;
            html += `<div class="group-header">${generation}</div>`;
            items.forEach((item, idx) => {
                const globalIdx = this.filteredItems.indexOf(item);
                const isSelected = item.id === this.select.value;
                html += `
                    <div class="result-item ${isSelected ? 'selected' : ''}" data-index="${globalIdx}">
                        <div class="result-name">${item.name}</div>
                        ${item.tdp || item.boardPower ? `<div class="result-meta">${item.tdp || item.boardPower}W</div>` : ''}
                    </div>
                `;
            });
            html += `</div>`;
        });

        this.resultsContainer.innerHTML = html;

        // Bind click events
        this.resultsContainer.querySelectorAll('.result-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index);
                this.selectItem(this.filteredItems[idx]);
            });
        });
    }

    navigateResults(direction) {
        this.selectedIndex += direction;
        if (this.selectedIndex < 0) this.selectedIndex = this.filteredItems.length - 1;
        if (this.selectedIndex >= this.filteredItems.length) this.selectedIndex = 0;

        this.highlightResult(this.selectedIndex);
    }

    highlightResult(index) {
        this.resultsContainer.querySelectorAll('.result-item').forEach((el, idx) => {
            el.classList.toggle('highlighted', parseInt(el.dataset.index) === index);
        });

        // Scroll into view
        const highlighted = this.resultsContainer.querySelector('.result-item.highlighted');
        if (highlighted) {
            highlighted.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    selectHighlighted() {
        if (this.selectedIndex >= 0 && this.selectedIndex < this.filteredItems.length) {
            this.selectItem(this.filteredItems[this.selectedIndex]);
        }
    }

    selectItem(item) {
        this.select.value = item.id;
        this.trigger.querySelector('.dropdown-value').textContent = item.name;
        this.config.onSelect(item);
        this.close();

        // Trigger change event
        this.select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    getSelectedText() {
        const selected = this.items.find(i => i.id === this.select.value);
        return selected ? selected.name : 'Select...';
    }
}
