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
        // Forward targeting actions to the targeting script
        if (message.action === 'startTargeting' || 
            message.action === 'stopTargeting') {
            buildOverlay();
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
    
    // Globals for targeting
    let overlay = document.createElement('div');
    let submitterDiv = document.createElement('div');
    let pastElementArray = [];
    let pastElementDictionary = [];
    let moveClickX, moveClickY;
    let arrowKeyListen;
    
    function startTargetingMode() {
        // Set targeting mode active
        targeting.active = true;
        
        // Create the overlay
        buildOverlay();
        
        console.log('DAMS targeting mode started');
    }
    
    // Create the overlay for targeting mode
    function buildOverlay() {
        document.addEventListener('click', targetAdMouseClick, true);

        const header = document.createElement('div');
        header.innerText = 'Target Ad Element';
        header.style.cssText = 'font-size: 15vh;' +
            'user-select: none;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'color: rgba(255,255,255,0.5);' +
            'line-height: normal;' +
            'width: 100%;' +
            'text-align: center;' +
            '';

        const instructionSpan = document.createElement('div');
        instructionSpan.innerText = 'Click on any ad element (Esc to cancel)';
        instructionSpan.style.cssText = 'user-select: none;' +
            'font-size: 5vh;' +
            'font-weight: normal;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'color: rgba(255,255,255,0.5);' +
            'line-height: normal;' +
            'width: 100%;' +
            'text-align: center;' +
            '';
        header.appendChild(instructionSpan);

        // Overlay setup
        overlay.id = bguid();
        overlay.appendChild(header);
        overlay.style.cssText = 'position: fixed;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'display: flex;' +
            'align-items: center;' +
            'justify-content: center;' +
            'width: 100%;' +
            'height: 100%;' +
            'top: 0;' +
            'left: 0;' +
            'right: 0;' +
            'bottom: 0;' +
            'background-color: rgba(0,0,0,0.5);' + 
            'z-index: 2147483647;' +
            'cursor: crosshair;' +
            '';
        document.body.appendChild(overlay);
    }
    
    // When user clicks on overlay to target an element
    function targetAdMouseClick(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Remove the overlay but keep targeting active
        overlay.remove();
        
        // Get the element under the click point
        targeting.currentElement = document.elementFromPoint(e.clientX, e.clientY);
        
        // Remove the click listener
        document.removeEventListener('click', targetAdMouseClick, true);
        
        // Build the DOM path to the element
        targeting.targetPath = findPath(targeting.currentElement);
        
        // Update popup with element info
        sendElementInfoToPopup(targeting.currentElement);
        
        // Show the submitter div
        submitDiv(targeting.currentElement);
        
        return false;
    }
    
    // Build the DOM path to an element
    function findPath(target) {
        const path = [];
        while (target) {
            path.push(target);
            target = target.parentElement;
        }
        return path;
    }
    
    // Submit div function from adTargetingScript.js
    function submitDiv(elmClicked) {
        // Local vars
        let moveMouseIsDown = false;
        const path = targeting.targetPath;
        
        // Build submit div
        submitterDiv.id = bguid();
        submitterDiv.style.cssText = 'position: fixed;' +
            'width: 400px;' +
            'left: 20px;' +
            'top: 20px;' +
            'background-color: rgba(33, 150, 243, 0.9);' +
            'z-index: 2147483647;' +
            'color: white;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'border-radius: 8px;' +
            'box-shadow: 0 4px 8px rgba(0,0,0,0.3);' +
            '';

        // Try to restore previous position if available
        chrome.storage.local.get(["targetingToolBox"], function(items) {
            if (items.targetingToolBox) {
                try {
                    const targetingToolBox = JSON.parse(items.targetingToolBox);
                    submitterDiv.style.top = targetingToolBox.y || "20px";
                    submitterDiv.style.left = targetingToolBox.x || "20px";
                } catch (e) {
                    console.error("Error parsing stored position:", e);
                }
            }
        });

        // Header section
        const submitterHeaderH2 = document.createElement('div');
        submitterHeaderH2.id = bguid();
        submitterHeaderH2.innerText = 'Ad Element Controls';
        submitterHeaderH2.style.cssText = 'cursor: move;' +
            'user-select: none;' +
            'font-weight: bold;' +
            'height: 40px;' +
            'display: flex;' +
            'font-size: 18px;' +
            'justify-content: center;' +
            'align-items: center;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'background-color: rgba(25, 118, 210, 1);' +
            'color: white;' +
            'border-radius: 8px 8px 0 0;' +
            '';
        submitterDiv.appendChild(submitterHeaderH2);
    
        // Close button
        const submitterHeaderSpan = document.createElement('div');
        submitterHeaderSpan.innerHTML = '&#10006;';
        submitterHeaderSpan.style.cssText = 'cursor: pointer;' +
            'user-select: none;' +
            'font-size: 18px;' +
            'font-weight: normal;' +
            'position: absolute;' +
            'right: 10px;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            'color: white;' +
            '';
        submitterHeaderH2.appendChild(submitterHeaderSpan);

        // Element preview textarea
        const textareaDiv = document.createElement('textarea');
        textareaDiv.id = bguid();
        textareaDiv.style.cssText = 'height:100px;' +
            'font-family: monospace;' +
            'width:380px;' +
            'margin: 10px;' +
            'resize: none;' +
            'font-size: 12px;' +
            'color: #333;' +
            'background-color: rgba(255,255,255,0.9);' +
            'border-radius: 4px;' +
            'border: 1px solid #ccc;' +
            '';
        textareaDiv.disabled = true;
        if (elmClicked) {
            textareaDiv.value = nodeToString(elmClicked);
        }
        submitterDiv.appendChild(textareaDiv);

        // Controls container
        const inputContainer = document.createElement('div');
        inputContainer.style.cssText = 'margin: 10px;';

        // Element size control (embiggen)
        const embiggenContainer = document.createElement('div');
        embiggenContainer.innerText = 'Adjust selection size:';    
        embiggenContainer.style.cssText = 'font-size: 14px;' +
            'margin-bottom: 5px;' +
            '';

        const pathDepth = (path || []).length;
        const embiggenInput = document.createElement('input');
        embiggenInput.style.cssText = 'cursor: pointer;' +
            'width: 100%;' +
            'margin-bottom: 15px;' +
            '';
        embiggenInput.id = bguid();
        embiggenInput.value = pathDepth > 2 ? 2 : 0;
        embiggenInput.step = '1';
        embiggenInput.min = '0';
        embiggenInput.type = 'range';
        embiggenInput.max = (pathDepth - 1);
        embiggenInput.addEventListener('input', function(e) {
            retargetAdMouseClick(path[embiggenInput.value]);
        });
        
        // Initialize with a good default selection
        if (pathDepth > 2) {
            retargetAdMouseClick(path[2]);
        }
        
        embiggenContainer.appendChild(embiggenInput);
        inputContainer.appendChild(embiggenContainer);

        // Button controls container
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = 'display: flex;' +
            'flex-direction: row;' +
            'align-items: stretch;' +
            'width: 100%;' +
            'margin-top: 10px;' +
            '';
        inputContainer.appendChild(buttonContainer);

        // Cancel button
        const cancelButton = document.createElement('div');
        cancelButton.innerText = 'Cancel';
        cancelButton.id = bguid();
        cancelButton.style.cssText = 'cursor: pointer;' +
            'margin: 0px;' +
            'padding: 10px;' +
            'text-align: center;' +
            'background-color: #f44336;' +
            'white-space: nowrap;' +
            'font-size: 16px;' +
            'box-shadow: 0 2px 4px rgba(0,0,0,0.2);' +
            'border-radius: 4px;' +
            'flex: 1;' +
            '';
        buttonContainer.appendChild(cancelButton);
                
        // Submit button
        const submitButton = document.createElement('div');
        submitButton.innerText = 'Submit';
        submitButton.id = bguid();
        submitButton.style.cssText = 'cursor: pointer;' +
            'margin: 0px 0px 0px 10px;' +
            'padding: 10px;' +
            'text-align: center;' +
            'background-color: #4CAF50;' +
            'white-space: nowrap;' +
            'font-size: 16px;' +
            'box-shadow: 0 2px 4px rgba(0,0,0,0.2);' +
            'border-radius: 4px;' +
            'flex: 1;' +
            '';
        buttonContainer.appendChild(submitButton);

        // Help text for keyboard shortcuts
        const shortcutsHelp = document.createElement('div');
        shortcutsHelp.innerHTML = '<strong>Keyboard shortcuts:</strong><br>' +
            '← → Arrow keys to adjust selection<br>' +
            'Enter to submit<br>' +
            'Esc to cancel';
        shortcutsHelp.style.cssText = 'font-size: 12px;' +
            'margin: 15px 0 5px 0;' +
            'color: rgba(255,255,255,0.8);' +
            '';
        inputContainer.appendChild(shortcutsHelp);

        // Finish building
        submitterDiv.appendChild(inputContainer);
        document.body.appendChild(submitterDiv);

        // Highlight clicked element
        highLightElm(elmClicked);

        // Event listeners
        submitterHeaderH2.addEventListener('mousedown', moveSubmitBox, true);
        
        // Submit button listener
        submitButton.addEventListener('click', function(e) {
            if (!targeting.currentElement) return;
            
            // Store the element information
            const elementInfo = {
                tagName: targeting.currentElement.tagName,
                id: targeting.currentElement.id,
                className: targeting.currentElement.className,
                path: getElementXPath(targeting.currentElement),
                content: targeting.currentElement.textContent.trim(),
                html: nodeToString(targeting.currentElement),
                url: window.location.href
            };
            
            // Store in local storage for further processing
            chrome.storage.local.set({
                lastSubmittedElement: elementInfo
            });
            
            // Report to background script
            chrome.runtime.sendMessage({
                type: 'ELEMENT_SUBMITTED',
                element: elementInfo
            });
            
            // Show success message
            submitSuccess();
            
            // Reset and exit targeting mode
            targeting.active = false;
            reset();
            
            // Report back to popup
            chrome.runtime.sendMessage({
                type: 'targetingComplete',
                success: true
            });
        }, true);

        // Cancel button listener
        cancelButton.addEventListener('click', function(e) {
            reset();
            // Go back to targeting overlay
            if (targeting.active) {
                buildOverlay();
            }
        }, true);

        // Close button listener
        submitterHeaderSpan.addEventListener('click', function(e) {
            moveMouseIsDown = false;
            removeMoveSubmitBoxMouseEvent();
            window.removeEventListener('keyup', arrowKeyListen, true);
            
            // Reset and exit targeting mode
            targeting.active = false;
            reset();
            
            // Report back to popup
            chrome.runtime.sendMessage({
                type: 'targetingComplete',
                success: false,
                canceled: true
            });
        }, true);

        // Add keyboard navigation
        arrowKeyListen = function(e) {
            if (e.key === "ArrowRight") {
                // Decrease depth (move to parent)
                const currentValue = parseInt(embiggenInput.value, 10);
                if (currentValue < parseInt(embiggenInput.max)) {
                    embiggenInput.value = currentValue + 1;
                    retargetAdMouseClick(path[embiggenInput.value]);
                }
            } else if (e.key === "ArrowLeft") {
                // Increase depth (move to child)
                const currentValue = parseInt(embiggenInput.value, 10);
                if (currentValue > 0) {
                    embiggenInput.value = currentValue - 1;
                    retargetAdMouseClick(path[embiggenInput.value]);
                }
            } else if (e.key === "Escape" || e.key === "Esc") {
                // Cancel
                removeMoveSubmitBoxMouseEvent();
                window.removeEventListener('keyup', arrowKeyListen, true);
                
                if (targeting.active) {
                    reset();
                    buildOverlay();
                } else {
                    reset();
                }
            } else if (e.key === "Enter") {
                // Submit
                submitButton.click();
                window.removeEventListener('keyup', arrowKeyListen, true);
            }
        };
        window.addEventListener('keyup', arrowKeyListen, true);
        
        // Functions for the submitter
        function moveSubmitBox(e) {
            window.addEventListener('mouseup', removeMoveSubmitBoxMouseEvent, true);
            moveMouseIsDown = true;
            moveClickY = e.clientY - parseInt(submitterDiv.style.top, 10);
            moveClickX = e.clientX - parseInt(submitterDiv.style.left, 10);
            // Short timeout to just make sure the user didn't randomly click
            setTimeout(function() {
                if(moveMouseIsDown) {
                    window.addEventListener('mousemove', moveSubmitBoxMouseEvent, true);
                }
            }, 300);
        }

        function retargetAdMouseClick(elm) {
            while (pastElementArray.length > 0) {
                resetPastElms();
            }
            textareaDiv.value = nodeToString(elm);
            highLightElm(elm);
            targeting.currentElement = elm;
            
            // Update popup with element info
            sendElementInfoToPopup(elm);
        }
    }
    
    // Highlight the selected element
    function highLightElm(curElm) {
        if (!curElm) return;
        
        if (pastElementArray.indexOf(curElm) == -1) {
            // Remove previous highlights
            while (pastElementArray.length > 0) {
                resetPastElms();
            }
            // Add new highlight
            pastElementArray.push(curElm);
            pastElementDictionary.push({'elm': curElm, 'copy': curElm.cloneNode(true)});
            curElm.style.boxShadow = "0 0 10px red";
            curElm.style.zIndex = 2147483646;
        }
    }
    
    // Reset highlighted elements
    function resetPastElms() {
        if (pastElementArray.length === 0) return;
        
        const result = pastElementDictionary.find(x => {
            return x.elm === pastElementArray[(pastElementArray.length - 1)];
        });
        
        if (result) {
            pastElementArray[(pastElementArray.length - 1)].style = result.copy.style.cssText;
            pastElementArray.pop();
    
            pastElementDictionary = pastElementDictionary.filter(x => {
                return x.copy !== result.copy;
            });
        }
    }
    
    // Reset all UI elements and state
    function reset() {
        while (pastElementArray.length > 0) {
            resetPastElms();
        }
        if (overlay.parentNode) {
            overlay.remove();
        }
        overlay = document.createElement('div');
        if (submitterDiv.parentNode) {
            submitterDiv.remove();
        }
        submitterDiv = document.createElement('div');
        submitterDiv.id = bguid();
        document.removeEventListener('click', targetAdMouseClick, true);
        if (arrowKeyListen) {
            window.removeEventListener('keyup', arrowKeyListen, true);
        }
        
        // Reset targeting state
        targeting.active = false;
        targeting.currentElement = null;
        targeting.targetPath = [];
    }
    
    // Helper functions for movement
    function moveSubmitBoxMouseEvent(e) {
        const tempY = Math.max(0, (e.clientY - moveClickY));
        const tempX = Math.max(0, (e.clientX - moveClickX));
        submitterDiv.style.top = tempY + 'px';
        submitterDiv.style.left = tempX + 'px';
    }
    
    function removeMoveSubmitBoxMouseEvent(e) {
        moveMouseIsDown = false;
        // Save position for next time
        const submittedToolBoxOptions = { 
            y: submitterDiv.style.top, 
            x: submitterDiv.style.left 
        };
        chrome.storage.local.set({ 
            "targetingToolBox": JSON.stringify(submittedToolBoxOptions)
        });
        window.removeEventListener('mousemove', moveSubmitBoxMouseEvent, true);
        window.removeEventListener('mouseup', removeMoveSubmitBoxMouseEvent, true);
    }
    
    // Success notification
    function submitSuccess() {
        const successDiv = document.createElement('div');
        successDiv.id = bguid();
        successDiv.style.cssText = 'position: fixed;' +
            'right: 20px;' +
            'top: 20px;' +
            'background-color: #4CAF50;' +
            'z-index: 2147483647;' +
            'margin: 10px;' +
            'padding: 15px 20px;' +
            'text-align: center;' +
            'font-size: 16px;' +
            'white-space: nowrap;' +
            'color: white;' +
            'box-shadow: 0 4px 8px rgba(0,0,0,0.3);' +
            'border-radius: 4px;' +
            'font-family: Arial, Helvetica, sans-serif;' +
            '';
        successDiv.innerText = 'Ad element submitted successfully!';
        document.body.appendChild(successDiv);
        
        // Fade out effect
        let opacity = 1.0;
        const fade = setInterval(() => {
            if (opacity <= 0.1) {
                successDiv.remove();
                clearInterval(fade);
            } else {
                opacity -= 0.1;
                successDiv.style.opacity = opacity;
            }
        }, 200);
    }
    
    // Utility function to generate a unique ID
    function bguid(a) {
        return a ? (a^Math.random()*16>>a/4).toString(16) : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, bguid);
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
    
    // Send element info to popup
    function sendElementInfoToPopup(element) {
        if (!element) return;
        
        const elementInfo = {
            tagName: element.tagName,
            id: element.id,
            className: element.className
        };
        
        chrome.runtime.sendMessage({
            type: 'targetingUpdate',
            elementInfo: elementInfo
        });
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