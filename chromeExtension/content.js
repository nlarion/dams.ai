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
      if (!window.adDetector.isReady && !window.adDetector.isLoading) {
        await window.adDetector.loadModel();
      }
      
      // Scan current page
      await scanPage();
      
      // Set up observer for dynamic content
      setupObserver();
    }
    
    async function scanPage() {
      if (!config.isEnabled) return;
      
      // Wait for model to be ready
      if (!window.adDetector.isReady) {
        if (window.adDetector.isLoading) {
          // Wait for model to finish loading
          await new Promise(resolve => {
            const checkInterval = setInterval(() => {
              if (window.adDetector.isReady) {
                clearInterval(checkInterval);
                resolve();
              }
            }, 100);
          });
        } else {
          await window.adDetector.loadModel();
        }
      }
      
      console.log('Scanning page for potential ads...');
      
      // Get all potential ad elements
      const elements = document.querySelectorAll('div, aside, section, article, iframe, ins');
      
      for (const element of elements) {
        // Skip elements that have already been processed
        if (element.dataset.adProcessed) continue;
        element.dataset.adProcessed = 'true';
        
        // Skip tiny elements
        if (element.offsetWidth < 50 || element.offsetHeight < 50) continue;
        
        // Extract text content
        const text = element.textContent.trim();
        
        // Skip elements with no text
        if (!text || text.length < 10) continue;
        
        // Check if it's an ad
        const result = await window.adDetector.detectAd(text);
        
        if (result.isAd) {
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
      }
      
      // Report stats to background script
      if (stats.detected > 0) {
        chrome.runtime.sendMessage({
          type: 'STATS_UPDATE',
          detected: stats.detected,
          removed: stats.removed
        });
        
        // Reset stats
        stats.detected = 0;
        stats.removed = 0;
      }
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
  