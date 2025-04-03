// popup.js
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const enableToggle = document.getElementById('enableToggle');
    const statusValue = document.getElementById('status-value');
    const confidenceSlider = document.getElementById('confidenceSlider');
    const confidenceValue = document.getElementById('confidenceValue');
    const detectedCount = document.getElementById('detected-count');
    const removedCount = document.getElementById('removed-count');
    const resetStatsButton = document.getElementById('resetStats');
    
    // Load settings
    chrome.storage.local.get(['isEnabled', 'confidenceThreshold', 'totalDetected', 'totalRemoved'], (data) => {
        // Set toggle
        enableToggle.checked = data.isEnabled;
        statusValue.textContent = data.isEnabled ? 'Enabled' : 'Disabled';
        statusValue.className = data.isEnabled ? 'enabled' : 'disabled';
        
        // Set slider
        const threshold = data.confidenceThreshold ? Math.round(data.confidenceThreshold * 100) : 90;
        confidenceSlider.value = threshold;
        confidenceValue.textContent = `${threshold}%`;
        
        // Set stats
        detectedCount.textContent = data.totalDetected || 0;
        removedCount.textContent = data.totalRemoved || 0;
    });
    
    // Toggle enable/disable
    enableToggle.addEventListener('change', () => {
        const isEnabled = enableToggle.checked;
        chrome.storage.local.set({ isEnabled });
        
        statusValue.textContent = isEnabled ? 'Enabled' : 'Disabled';
        statusValue.className = isEnabled ? 'enabled' : 'disabled';
    });
    
    // Confidence threshold slider
    confidenceSlider.addEventListener('input', () => {
        const value = confidenceSlider.value;
        confidenceValue.textContent = `${value}%`;
        
        // Update storage (convert to 0-1 range)
        chrome.storage.local.set({ confidenceThreshold: value / 100 });
    });
    
    // Reset stats
    resetStatsButton.addEventListener('click', () => {
        chrome.storage.local.set({ totalDetected: 0, totalRemoved: 0 });
        detectedCount.textContent = '0';
        removedCount.textContent = '0';
    });
    
    // Refresh stats every second
    setInterval(() => {
        chrome.storage.local.get(['totalDetected', 'totalRemoved'], (data) => {
        detectedCount.textContent = data.totalDetected || 0;
        removedCount.textContent = data.totalRemoved || 0;
        });
    }, 1000);
});