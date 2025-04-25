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
    const undoRemovedButton = document.getElementById('undoRemoved');
    
    // Targeting elements
    const startTargetingButton = document.getElementById('startTargeting');
    const stopTargetingButton = document.getElementById('stopTargeting');
    const scopeControls = document.getElementById('scopeControls');
    const decreaseScopeButton = document.getElementById('decreaseScope');
    const increaseScopeButton = document.getElementById('increaseScope');
    const currentElementSpan = document.getElementById('currentElement');
    const submitSelectionButton = document.getElementById('submitSelection');
    
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
    
    // Undo removed elements
    undoRemovedButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'undoRemovedElements'
                }, (response) => {
                    if (response && response.undoneCount) {
                        console.log(`Undid ${response.undoneCount} element removals`);
                    }
                });
            }
        });
    });
    
    // Refresh stats every second
    setInterval(() => {
        chrome.storage.local.get(['totalDetected', 'totalRemoved'], (data) => {
        detectedCount.textContent = data.totalDetected || 0;
        removedCount.textContent = data.totalRemoved || 0;
        });
    }, 1000);
    
    // DIV TARGETING FUNCTIONALITY
    
    // Start targeting mode - simplified to just send a message to content script
    startTargetingButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'startTargeting'
                });
                
                // Update UI
                startTargetingButton.style.display = 'none';
                stopTargetingButton.style.display = 'block';
                
                // Listen for messages from targeting script
                chrome.runtime.onMessage.addListener(handleTargetingMessages);
                
                // Close the popup to give user full view of the page
                window.close();
            }
        });
    });
    
    // Stop targeting mode
    stopTargetingButton.addEventListener('click', () => {
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: 'stopTargeting'
                });
                
                // Reset UI
                startTargetingButton.style.display = 'block';
                stopTargetingButton.style.display = 'none';
                scopeControls.style.display = 'none';
                currentElementSpan.textContent = 'No element selected';
                
                // Remove message listener
                chrome.runtime.onMessage.removeListener(handleTargetingMessages);
            }
        });
    });
    
    // Handle messages from content script during targeting
    function handleTargetingMessages(message, sender, sendResponse) {
        if (message.type === 'targetingUpdate') {
            // Update the current element display in the popup
            if (message.elementInfo) {
                const { tagName, className, id } = message.elementInfo;
                let displayText = tagName.toLowerCase();
                
                if (id) {
                    displayText += `#${id}`;
                }
                
                if (className) {
                    const classes = className.split(' ').filter(c => c.trim());
                    if (classes.length > 0) {
                        displayText += `.${classes[0]}`;
                        
                        if (classes.length > 1) {
                            displayText += `+${classes.length - 1}`;
                        }
                    }
                }
                
                currentElementSpan.textContent = displayText;
                
                // Show controls but note they're not needed because UI is on the page
                scopeControls.style.display = 'block';
            } else {
                currentElementSpan.textContent = 'No element selected';
            }
            
            return true; // Keep the message channel open for sendResponse
        } else if (message.type === 'targetingComplete') {
            // Targeting completed (either by submission or cancellation)
            startTargetingButton.style.display = 'block';
            stopTargetingButton.style.display = 'none';
            scopeControls.style.display = 'none';
            currentElementSpan.textContent = 'No element selected';
            
            // Remove message listener
            chrome.runtime.onMessage.removeListener(handleTargetingMessages);
            
            return true;
        } else if (message.type === 'ELEMENT_SUBMITTED') {
            // Element was submitted from the page interface
            console.log('Element submitted:', message.element);
            
            // Reset UI
            startTargetingButton.style.display = 'block';
            stopTargetingButton.style.display = 'none';
            scopeControls.style.display = 'none';
            currentElementSpan.textContent = 'No element selected';
            
            // Remove message listener
            chrome.runtime.onMessage.removeListener(handleTargetingMessages);
            
            return true;
        }
    }
});