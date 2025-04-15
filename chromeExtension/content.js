(async function() {
    // Configuration
    let config = {
      isEnabled: true,
      confidenceThreshold: 0.9
    };
    
    // Statistics
    let stats = {
      detected: 0,
      removed: 0
    };

    let modelStatus = {
        isInitialized: false
    };
    
    // Get configuration from storage
    chrome.storage.local.get(['isEnabled', 'confidenceThreshold'], (data) => {
      if (data.isEnabled !== undefined) config.isEnabled = data.isEnabled;
      if (data.confidenceThreshold !== undefined) config.confidenceThreshold = data.confidenceThreshold;
      
      // Start detection if enabled
      if (config.isEnabled) {
        initDetection();
      }
    });
    
    // Listen for config changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.isEnabled) {
        config.isEnabled = changes.isEnabled.newValue;
        if (config.isEnabled) {
          initDetection();
        }
      }
      
      if (changes.confidenceThreshold) {
        config.confidenceThreshold = changes.confidenceThreshold.newValue;
      }
    });
    
    async function initDetection() {
        console.log('Initializing ad detection...');
        
        // Make sure the model is loaded
        if (!modelStatus.isInitialized) {
            try {
                const response = await sendMessagePromise({
                    type: 'INITIALIZE',
                    time: Date.now()
                });
                
                console.log("Model initialization response:", response);
                modelStatus.isInitialized = true;
            } catch (error) {
                console.error("Error initializing model:", error);
                // Retry after a delay
                setTimeout(initDetection, 5000);
                return;
            }
        }
        
        // Scan current page
        await scanPage();
        
        // Set up observer for dynamic content
        setupObserver();
    }
    
    // Helper function to convert chrome.runtime.sendMessage to Promise
    function sendMessagePromise(message) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            chrome.runtime.sendMessage(message, (response) => {
                //const duration = (Date.now() - startTime) / 1000;
                //console.log(`Message ${message.type} took ${duration.toFixed(2)}s to get response`, response);
                // Check for error
                if (chrome.runtime.lastError) {
                    console.error('Runtime error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else if (!response) {
                    reject(new Error('Empty response received'));
                } else {
                    resolve(response);
                }
            });
        });
    }
    
    async function scanPage() {
        if (!config.isEnabled) return;
      
        // Wait for model to be ready
        if (!modelStatus.isInitialized) {
            // Wait for model to finish loading
            await new Promise(resolve => {
                const checkInterval = setInterval(() => {
                    if (modelStatus.isInitialized) {
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100);
            });
        }      
      
        console.log('Scanning page for potential ads...');
      
        // Get all potential ad elements
        const elements = document.querySelectorAll('div, aside, section, article, iframe, ins');
      
        for (const element of elements) {
            // Skip elements that have already been processed
            if (element?.dataset?.adProcessed) continue;
            element.dataset.adProcessed = 'true';
            
            // Skip tiny elements
            if (element.offsetWidth < 50 || element.offsetHeight < 50) continue;
            
            // Extract text content
            const text = nodeToString(element);
            
            // Skip elements with no text
            if (!text || text.length < 10) continue;
            
            try {
                // Check if it's an ad
                const result = await sendMessagePromise({
                    type: 'GET_PREDICTION',
                    text: text,
                    time: Date.now()
                });
                
                if (result && result.isAd) {
                    stats.detected++;
                    
                    // Add visual indicator for debugging (can be removed in production)
                    element.dataset.adConfidence = result.confidence.toFixed(2);
                    
                    // Remove if confidence is above threshold
                    if (result.confidence >= config.confidenceThreshold) {
                        console.log(`Removing ad element with confidence ${result.confidence.toFixed(2)}`);
                        element.style.display = 'none';
                        stats.removed++;
                    }
                }
            } catch (error) {
                console.error(`Error processing element text "${text.substring(0, 50)}..."`, error);
            }
        }
      
        //Report stats to background script
        if (stats.detected > 0) {
            try {
				chrome.runtime.sendMessage({
					type: 'STATS_UPDATE',
					detected: stats.detected,
					removed: stats.removed
				});
				
				// Reset stats
				stats.detected = 0;
				stats.removed = 0;
            } catch (error) {
                console.error('Error updating stats:', error);
            }
        }
    }

	function nodeToString(node) {
		var tmpNode = document.createElement( "div" );
		tmpNode.appendChild( node.cloneNode(true) );
		var str = tmpNode.innerHTML;
		tmpNode = node = null;
		return str;
	}

    function setupObserver() {
        // Create observer to detect new content
        const observer = new MutationObserver((mutations) => {
            let shouldScan = false;
            
            for (const mutation of mutations) {
                if (mutation.addedNodes.length > 0) {
                    shouldScan = true;
                    break;
                }
            }
            
            if (shouldScan) {
                // Debounce scanning to avoid excessive processing
                clearTimeout(window.adScanTimeout);
                window.adScanTimeout = setTimeout(() => {
                    scanPage();
                }, 500);
            }
        });
        
        // Start observing
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        console.log('Ad detection observer setup complete');
    }
})();