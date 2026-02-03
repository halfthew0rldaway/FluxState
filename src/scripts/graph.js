/**
 * Graph Rendering Module
 * Canvas-based live graphs for power and temperature data
 */

/**
 * Create a graph renderer
 * @param {HTMLCanvasElement} canvas - Canvas element
 * @param {Object} options - Graph options
 * @returns {Object} Graph controller
 */
export function createGraph(canvas, options = {}) {
    const ctx = canvas.getContext('2d');

    const defaults = {
        lineColor: '#3dd68c',
        fillColor: 'rgba(61, 214, 140, 0.08)',
        gridColor: '#252529',
        textColor: '#656570',
        backgroundColor: '#18181c',
        minValue: 0,
        maxValue: 100,
        unit: '',
        label: '',
        showGrid: true,
        showLabels: true,
        padding: { top: 20, right: 10, bottom: 25, left: 45 }
    };

    const config = { ...defaults, ...options };

    /**
     * Clear and prepare canvas
     */
    function clear() {
        ctx.fillStyle = config.backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    /**
     * Draw grid lines
     */
    function drawGrid() {
        if (!config.showGrid) return;

        const { padding } = config;
        const graphWidth = canvas.width - padding.left - padding.right;
        const graphHeight = canvas.height - padding.top - padding.bottom;

        ctx.strokeStyle = config.gridColor;
        ctx.lineWidth = 1;

        // Horizontal grid lines (4 lines)
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (graphHeight * i / 4);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(canvas.width - padding.right, y);
            ctx.stroke();
        }

        // Vertical grid lines (6 lines for time)
        for (let i = 0; i <= 6; i++) {
            const x = padding.left + (graphWidth * i / 6);
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, canvas.height - padding.bottom);
            ctx.stroke();
        }
    }

    /**
     * Draw axis labels
     */
    function drawLabels() {
        if (!config.showLabels) return;

        const { padding, minValue, maxValue, unit, label } = config;
        const graphHeight = canvas.height - padding.top - padding.bottom;

        ctx.fillStyle = config.textColor;
        ctx.font = '10px ui-monospace, monospace';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        // Y-axis labels
        for (let i = 0; i <= 4; i++) {
            const value = maxValue - ((maxValue - minValue) * i / 4);
            const y = padding.top + (graphHeight * i / 4);
            ctx.fillText(value.toFixed(0) + unit, padding.left - 5, y);
        }

        // Graph label
        if (label) {
            ctx.textAlign = 'left';
            ctx.font = '11px ui-monospace, monospace';
            ctx.fillText(label, padding.left, 12);
        }
    }

    /**
     * Draw data line and fill
     * @param {Array} data - Array of values
     */
    function drawData(data) {
        if (!data || data.length < 2) return;

        const { padding, minValue, maxValue } = config;
        const graphWidth = canvas.width - padding.left - padding.right;
        const graphHeight = canvas.height - padding.top - padding.bottom;

        const step = graphWidth / (data.length - 1);

        // Create path
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top + graphHeight);

        data.forEach((point, i) => {
            const value = typeof point === 'object' ? point.value : point;
            const normalizedValue = (value - minValue) / (maxValue - minValue);
            const clampedValue = Math.max(0, Math.min(1, normalizedValue));
            const x = padding.left + (i * step);
            const y = padding.top + graphHeight - (clampedValue * graphHeight);

            if (i === 0) {
                ctx.lineTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        // Complete fill path
        ctx.lineTo(padding.left + graphWidth, padding.top + graphHeight);
        ctx.closePath();

        // Fill
        ctx.fillStyle = config.fillColor;
        ctx.fill();

        // Stroke line
        ctx.beginPath();
        data.forEach((point, i) => {
            const value = typeof point === 'object' ? point.value : point;
            const normalizedValue = (value - minValue) / (maxValue - minValue);
            const clampedValue = Math.max(0, Math.min(1, normalizedValue));
            const x = padding.left + (i * step);
            const y = padding.top + graphHeight - (clampedValue * graphHeight);

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.strokeStyle = config.lineColor;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw current value indicator
        if (data.length > 0) {
            const lastPoint = data[data.length - 1];
            const lastValue = typeof lastPoint === 'object' ? lastPoint.value : lastPoint;
            const normalizedValue = (lastValue - minValue) / (maxValue - minValue);
            const clampedValue = Math.max(0, Math.min(1, normalizedValue));
            const x = padding.left + graphWidth;
            const y = padding.top + graphHeight - (clampedValue * graphHeight);

            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fillStyle = config.lineColor;
            ctx.fill();
        }
    }

    /**
     * Render the graph with given data
     * @param {Array} data - Array of values
     */
    function render(data) {
        clear();
        drawGrid();
        drawLabels();
        drawData(data);
    }

    /**
     * Update graph options
     * @param {Object} newOptions - New options
     */
    function updateOptions(newOptions) {
        Object.assign(config, newOptions);
    }

    /**
     * Resize canvas to container
     * @param {number} width - New width
     * @param {number} height - New height
     */
    function resize(width, height) {
        canvas.width = width;
        canvas.height = height;
    }

    return {
        render,
        updateOptions,
        resize,
        clear
    };
}

/**
 * Create graphs for power and temperature
 * @param {Object} elements - Object with powerCanvas and tempCanvas references
 * @returns {Object} Graph controllers
 */
export function createSimulatorGraphs(elements) {
    const powerGraph = createGraph(elements.powerCanvas, {
        lineColor: '#f0a030',
        fillColor: 'rgba(240, 160, 48, 0.08)',
        minValue: 0,
        maxValue: 800,
        unit: 'W',
        label: 'POWER DRAW'
    });

    const tempGraph = createGraph(elements.tempCanvas, {
        lineColor: '#e84545',
        fillColor: 'rgba(232, 69, 69, 0.08)',
        minValue: 20,
        maxValue: 110,
        unit: '°C',
        label: 'CPU TEMP'
    });

    return { powerGraph, tempGraph };
}
