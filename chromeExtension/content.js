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
        hoverElement: null,
        floatingUI: null
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
    
    // Listen for messages from popup for targeting and undo
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
        } else if (message.action === 'undoRemovedElements') {
            const undoneCount = undoRemovedElements();
            sendResponse({ success: true, undoneCount });
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
                        // Store original display style before hiding
                        element.dataset.originalDisplay = element.style.display || '';
                        element.dataset.removedTimestamp = Date.now().toString();
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
        
        // Create floating UI controls
        createFloatingControls();
        
        // Add hover handlers for elements
        document.body.addEventListener('mousemove', handleMouseMove);
        document.body.addEventListener('click', handleElementClick);
        
        // Add styles for highlighting and floating UI
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
            .dams-floating-ui {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: white;
                border: 1px solid #ccc;
                border-radius: 8px;
                padding: 12px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
                z-index: 2147483647;
                display: flex;
                flex-direction: column;
                gap: 10px;
                width: 250px;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            }
            .dams-floating-ui-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }
            .dams-floating-ui-title {
                font-weight: bold;
                font-size: 14px;
                color: #333;
            }
            .dams-floating-ui-close {
                cursor: pointer;
                color: #777;
                font-size: 16px;
            }
            .dams-floating-ui-element {
                background-color: #f5f5f5;
                padding: 8px;
                border-radius: 4px;
                font-size: 12px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                color: #333;
            }
            .dams-floating-ui-controls {
                display: flex;
                gap: 8px;
            }
            .dams-floating-ui-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-weight: bold;
                font-size: 12px;
                text-align: center;
                flex: 1;
                color: white;
            }
            .dams-floating-ui-btn:hover {
                opacity: 0.9;
            }
            .dams-btn-narrow {
                background-color: #2196F3;
            }
            .dams-btn-widen {
                background-color: #2196F3;
            }
            .dams-btn-submit {
                background-color: #4CAF50;
            }
            .dams-btn-cancel {
                background-color: #F44336;
            }
            .dams-scope-controls {
                display: flex;
                gap: 8px;
            }
        `;
        document.head.appendChild(styleElement);
        
        console.log('DAMS targeting mode started');
    }
    
    function createFloatingControls() {
        // Create floating UI element
        const floatingUI = document.createElement('div');
        floatingUI.className = 'dams-floating-ui';
        floatingUI.id = 'dams-floating-ui';
        
        // Create header with title and close button
        const header = document.createElement('div');
        header.className = 'dams-floating-ui-header';
        
        const title = document.createElement('div');
        title.className = 'dams-floating-ui-title';
        title.textContent = 'Ad Targeting Mode';
        
        const closeBtn = document.createElement('div');
        closeBtn.className = 'dams-floating-ui-close';
        closeBtn.textContent = '✕';
        closeBtn.addEventListener('click', stopTargetingMode);
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        
        // Create element display
        const elementDisplay = document.createElement('div');
        elementDisplay.className = 'dams-floating-ui-element';
        elementDisplay.id = 'dams-current-element';
        elementDisplay.textContent = 'Click on an ad to select it';
        
        // Create scope controls
        const scopeControls = document.createElement('div');
        scopeControls.className = 'dams-scope-controls';
        
        const narrowBtn = document.createElement('button');
        narrowBtn.className = 'dams-floating-ui-btn dams-btn-narrow';
        narrowBtn.textContent = 'Narrow';
        narrowBtn.addEventListener('click', decreaseScopeOfTarget);
        
        const widenBtn = document.createElement('button');
        widenBtn.className = 'dams-floating-ui-btn dams-btn-widen';
        widenBtn.textContent = 'Widen';
        widenBtn.addEventListener('click', increaseScopeOfTarget);
        
        scopeControls.appendChild(narrowBtn);
        scopeControls.appendChild(widenBtn);
        
        // Create action buttons
        const actionControls = document.createElement('div');
        actionControls.className = 'dams-floating-ui-controls';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'dams-floating-ui-btn dams-btn-cancel';
        cancelBtn.textContent = 'Cancel';
        cancelBtn.addEventListener('click', stopTargetingMode);
        
        const submitBtn = document.createElement('button');
        submitBtn.className = 'dams-floating-ui-btn dams-btn-submit';
        submitBtn.textContent = 'Submit';
        submitBtn.addEventListener('click', submitTargetedElement);
        
        actionControls.appendChild(cancelBtn);
        actionControls.appendChild(submitBtn);
        
        // Add all elements to the floating UI
        floatingUI.appendChild(header);
        floatingUI.appendChild(elementDisplay);
        floatingUI.appendChild(scopeControls);
        floatingUI.appendChild(actionControls);
        
        // Make the floating UI draggable
        makeElementDraggable(floatingUI);
        
        // Add to the page
        document.body.appendChild(floatingUI);
        
        // Store reference to the floating UI
        targeting.floatingUI = floatingUI;
    }
    
    function makeElementDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        
        const header = element.querySelector('.dams-floating-ui-header');
        if (header) {
            header.onmousedown = dragMouseDown;
        } else {
            element.onmousedown = dragMouseDown;
        }
        
        function dragMouseDown(e) {
            e.preventDefault();
            // Get the mouse cursor position at startup
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            // Call a function whenever the cursor moves
            document.onmousemove = elementDrag;
        }
        
        function elementDrag(e) {
            e.preventDefault();
            // Calculate the new cursor position
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            // Set the element's new position
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
            element.style.bottom = "auto";
            element.style.right = "auto";
        }
        
        function closeDragElement() {
            // Stop moving when mouse button is released
            document.onmouseup = null;
            document.onmousemove = null;
        }
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
        
        // Remove floating UI
        if (targeting.floatingUI) {
            document.body.removeChild(targeting.floatingUI);
            targeting.floatingUI = null;
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
        
        // Get clicked element, but avoid clicking the floating UI itself
        let element = document.elementFromPoint(event.clientX, event.clientY);
        if (!element || 
            element.classList.contains('dams-highlight') || 
            element.closest('.dams-floating-ui')) return;
        
        // Set as current target
        targeting.currentElement = element;
        
        // Build the path to this element
        buildElementPath(element);
        
        // Update highlight
        updateHighlight();
        
        // Update element display in floating UI
        updateFloatingUIElementDisplay();
        
        // Send info to popup
        sendElementInfoToPopup();
        
        return false;
    }
    
    function updateFloatingUIElementDisplay() {
        if (!targeting.currentElement || !targeting.floatingUI) return;
        
        const elementDisplayDiv = targeting.floatingUI.querySelector('#dams-current-element');
        if (!elementDisplayDiv) return;
        
        const { tagName, id, className } = targeting.currentElement;
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
        
        elementDisplayDiv.textContent = displayText;
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
        
        // Update element display in floating UI
        updateFloatingUIElementDisplay();
        
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
            
            // Update element display in floating UI
            updateFloatingUIElementDisplay();
            
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
    
    // Function to undo removed elements
    function undoRemovedElements() {
        // Find all elements that have been removed
        const removedElements = document.querySelectorAll('[data-removed-timestamp]');
        
        // Sort by timestamp, most recent first
        const elementsArray = Array.from(removedElements);
        elementsArray.sort((a, b) => {
            return parseInt(b.dataset.removedTimestamp) - parseInt(a.dataset.removedTimestamp);
        });
        
        // Take the most recent 5 elements (or all if less than 5)
        const elementsToUndo = elementsArray.slice(0, 5);
        
        // Restore elements
        let undoneCount = 0;
        for (const element of elementsToUndo) {
            // Restore original display style
            element.style.display = element.dataset.originalDisplay;
            
            // Remove dataset properties
            delete element.dataset.removedTimestamp;
            delete element.dataset.originalDisplay;
            
            undoneCount++;
        }
        
        // Report stats to background script if any were undone
        if (undoneCount > 0) {
            try {
                stats.removed -= undoneCount;
                chrome.runtime.sendMessage({
                    type: 'STATS_UPDATE',
                    undone: undoneCount
                });
            } catch (error) {
                console.error('Error updating undo stats:', error);
            }
        }
        
        return undoneCount;
    }
})();