document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const body = document.body;

    const applyTheme = (theme) => {
        body.classList.remove('light-mode', 'dark-mode');
        body.classList.add(`${theme}-mode`);
        themeToggle.checked = theme === 'dark';
        updateAllChartsTheme(theme);
    };

    themeToggle.addEventListener('change', () => {
        const selectedTheme = themeToggle.checked ? 'dark' : 'light';
        localStorage.setItem('theme', selectedTheme);
        applyTheme(selectedTheme);
    });

    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
});

function updateAllChartsTheme(theme) {
    if (window.chartInstances && typeof window.updateChartTheme === 'function') {
        for (const chartId of window.chartInstances.keys()) {
            window.updateChartTheme(chartId, theme);
        }
    }
} 