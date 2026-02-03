/**
 * Value Change Tracker
 * Tracks value changes and triggers visual feedback
 */

class ValueTracker {
    constructor() {
        this.values = new Map();
        this.animationQueue = [];
    }

    update(key, newValue, element) {
        const oldValue = this.values.get(key);
        this.values.set(key, newValue);

        // Only animate if change is significant (prevents flickering)
        // Threshold: > 3 unit change OR > 5% relative change
        const diff = Math.abs(newValue - oldValue);
        const relativeDiff = oldValue !== 0 ? diff / Math.abs(oldValue) : 1;
        const isSignificant = diff > 3 || relativeDiff > 0.05;

        if (oldValue !== undefined && oldValue !== newValue && element && isSignificant) {
            this.animateChange(element, oldValue, newValue);
        }
    }

    animateChange(element, oldValue, newValue) {
        // Add flash animation
        element.classList.remove('value-changed');
        void element.offsetWidth; // Force reflow
        element.classList.add('value-changed');

        // Add delta indicator if numeric
        if (typeof newValue === 'number' && typeof oldValue === 'number') {
            this.showDelta(element, newValue - oldValue);
        }

        // Remove animation class after completion
        setTimeout(() => {
            element.classList.remove('value-changed');
        }, 400);
    }

    showDelta(element, delta) {
        // Remove existing delta if present
        const existing = element.parentElement?.querySelector('.power-delta');
        if (existing) existing.remove();

        if (Math.abs(delta) < 0.5) return; // Ignore tiny changes

        const deltaEl = document.createElement('span');
        deltaEl.className = `power-delta ${delta > 0 ? 'positive' : 'negative'}`;
        deltaEl.innerHTML = `${delta > 0 ? '+' : ''}${delta.toFixed(0)}`;

        element.parentElement?.appendChild(deltaEl);

        // Make visible
        requestAnimationFrame(() => {
            deltaEl.classList.add('visible');
        });

        // Remove after delay
        setTimeout(() => {
            deltaEl.classList.remove('visible');
            setTimeout(() => deltaEl.remove(), 300);
        }, 2000);
    }

    getDelta(key) {
        return this.values.get(key);
    }
}

export const valueTracker = new ValueTracker();
