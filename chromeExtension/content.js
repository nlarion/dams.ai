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
    
    // Targeting state
    let targeting = {
        active: false,
        currentElement: null,
        targetPath: [],
        highlightElement: null,
        hoverElement: null
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
    
    // Listen for messages from popup for targeting
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startTargeting') {
            startTargetingMode();
            sendResponse({ success: true });
            return true;
        } else if (message.action === 'stopTargeting') {
            stopTargetingMode();
            sendResponse({ success: true });
            return true;
        } else if (message.action === 'increaseScope') {
            increaseScopeOfTarget();
            sendResponse({ success: true });
            return true;
        } else if (message.action === 'decreaseScope') {
            decreaseScopeOfTarget();
            sendResponse({ success: true });
            return true;
        } else if (message.action === 'submitSelection') {
            submitTargetedElement();
            sendResponse({ success: true });
            return true;
        }
        return false;
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
    
    // TARGETING MODE FUNCTIONS
    
    function startTargetingMode() {
        // Set targeting mode active
        targeting.active = true;
        
        // Create highlight overlay
        createHighlightOverlay();
        
        // Add hover handlers for elements
        document.body.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('click', handleElementClick);
        
        // Add styles for highlighting
        const styleElement = document.createElement('style');
        styleElement.id = 'dams-targeting-styles';
        styleElement.textContent = `
            .dams-highlight {
                position: absolute;
                pointer-events: none;
                border: 2px solid #2196F3;
                background-color: rgba(33, 150, 243, 0.1);
                z-index: 2147483647;
                box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.1);
            }
            .dams-hover {
                outline: 2px dashed #2196F3 !important;
                outline-offset: -2px;
            }
        `;
        document.head.appendChild(styleElement);
        
        console.log('DAMS targeting mode started');
    }
    
    function stopTargetingMode() {
        // Reset targeting state
        targeting.active = false;
        targeting.currentElement = null;
        targeting.targetPath = [];
        
        // Remove highlighting
        if (targeting.highlightElement) {
            document.body.removeChild(targeting.highlightElement);
            targeting.highlightElement = null;
        }
        
        // Remove hover effect
        if (targeting.hoverElement) {
            targeting.hoverElement.classList.remove('dams-hover');
            targeting.hoverElement = null;
        }
        
        // Remove event listeners
        document.body.removeEventListener('mousemove', handleMouseMove);
        document.body.removeEventListener('click', handleElementClick);
        
        // Remove styles
        const styleElement = document.getElementById('dams-targeting-styles');
        if (styleElement) {
            document.head.removeChild(styleElement);
        }
        
        console.log('DAMS targeting mode stopped');
    }
    
    function createHighlightOverlay() {
        if (!targeting.highlightElement) {
            targeting.highlightElement = document.createElement('div');
            targeting.highlightElement.className = 'dams-highlight';
            document.body.appendChild(targeting.highlightElement);
        }
    }
    
    function handleMouseMove(event) {
        if (!targeting.active) return;
        
        // Clear previous hover element
        if (targeting.hoverElement) {
            targeting.hoverElement.classList.remove('dams-hover');
        }
        
        // Get element under cursor (avoiding our own highlight elements)
        let element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element || element.classList.contains('dams-highlight')) return;
        
        // Add hover effect
        element.classList.add('dams-hover');
        targeting.hoverElement = element;
    }
    
    function handleElementClick(event) {
        if (!targeting.active) return;
        
        // Prevent default click action
        event.preventDefault();
        event.stopPropagation();
        
        // Get clicked element
        let element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element || element.classList.contains('dams-highlight')) return;
        
        // Set as current target
        targeting.currentElement = element;
        
        // Build the path to this element
        buildElementPath(element);
        
        // Update highlight
        updateHighlight();
        
        // Send info to popup
        sendElementInfoToPopup();
        
        return false;
    }
    
    function buildElementPath(element) {
        targeting.targetPath = [];
        let current = element;
        
        while (current && current !== document.body) {
            targeting.targetPath.unshift(current);
            current = current.parentElement;
        }
    }
    
    function updateHighlight() {
        if (!targeting.currentElement || !targeting.highlightElement) return;
        
        const rect = targeting.currentElement.getBoundingClientRect();
        
        targeting.highlightElement.style.left = rect.left + window.scrollX + 'px';
        targeting.highlightElement.style.top = rect.top + window.scrollY + 'px';
        targeting.highlightElement.style.width = rect.width + 'px';
        targeting.highlightElement.style.height = rect.height + 'px';
    }
    
    function sendElementInfoToPopup() {
        if (!targeting.currentElement) return;
        
        const elementInfo = {
            tagName: targeting.currentElement.tagName,
            id: targeting.currentElement.id,
            className: targeting.currentElement.className
        };
        
        chrome.runtime.sendMessage({
            type: 'targetingUpdate',
            elementInfo: elementInfo
        });
    }
    
    function increaseScopeOfTarget() {
        if (!targeting.active || targeting.targetPath.length <= 1) return;
        
        // Move up one level in the DOM
        targeting.targetPath.shift();
        targeting.currentElement = targeting.targetPath[0];
        
        // Update highlight
        updateHighlight();
        
        // Send info to popup
        sendElementInfoToPopup();
    }
    
    function decreaseScopeOfTarget() {
        if (!targeting.active || !targeting.currentElement) return;
        
        // Check if we can go deeper
        if (targeting.currentElement.children.length === 0) return;
        
        // Find the largest child element by area
        let largestChild = null;
        let largestArea = 0;
        
        for (const child of targeting.currentElement.children) {
            const rect = child.getBoundingClientRect();
            const area = rect.width * rect.height;
            
            if (area > largestArea) {
                largestArea = area;
                largestChild = child;
            }
        }
        
        if (largestChild) {
            // Add to the front of the path
            targeting.targetPath.unshift(largestChild);
            targeting.currentElement = largestChild;
            
            // Update highlight
            updateHighlight();
            
            // Send info to popup
            sendElementInfoToPopup();
        }
    }
    
    function submitTargetedElement() {
        if (!targeting.active || !targeting.currentElement) return;
        
        console.log('Submitting element for API processing:', targeting.currentElement);
        
        // Get element content
        const elementContent = nodeToString(targeting.currentElement);
        
        // Extract text content
        const textContent = targeting.currentElement.textContent.trim();
        
        // Get element info
        const elementInfo = {
            tagName: targeting.currentElement.tagName,
            id: targeting.currentElement.id,
            className: targeting.currentElement.className,
            path: getElementXPath(targeting.currentElement),
            content: textContent,
            html: elementContent
        };
        
        // At this point you can implement the API submission
        // For now, we'll just log it
        console.log('Element selected for API submission:', elementInfo);
        
        // You would send this to your API here
        // For a placeholder, we'll store it in local storage
        chrome.storage.local.set({
            lastSubmittedElement: elementInfo
        });
        
        // Stop targeting mode
        stopTargetingMode();
    }
    
    // Helper function to get XPath of an element
    function getElementXPath(element) {
        if (!element) return '';
        
        if (element.id) {
            return `//*[@id="${element.id}"]`;
        }
        
        if (element === document.body) {
            return '/html/body';
        }
        
        if (!element.parentNode) {
            return '';
        }
        
        let siblings = element.parentNode.childNodes;
        let count = 0;
        let index = 0;
        
        for (let i = 0; i < siblings.length; i++) {
            let sibling = siblings[i];
            
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                count++;
            }
            
            if (sibling === element) {
                index = count;
            }
        }
        
        return `${getElementXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${index}]`;
    }
})();