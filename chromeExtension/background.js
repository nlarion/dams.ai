// background.js
chrome.runtime.onInstalled.addListener(() => {
    // Set default settings
    chrome.storage.local.set({
        isEnabled: true,
        confidenceThreshold: 0.9,
        totalDetected: 0,
        totalRemoved: 0
    });
    console.log('Ad Detector extension installed');
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'STATS_UPDATE') {
        // Update statistics
        chrome.storage.local.get(['totalDetected', 'totalRemoved'], (data) => {
                chrome.storage.local.set({
                totalDetected: data.totalDetected + message.detected,
                totalRemoved: data.totalRemoved + message.removed
            });
        });
    }

    return true; // Required for async sendResponse
});