(function() {
    // Globals
    const apiUrl = 'https://dams.ai';
    let overlay = document.createElement('div');
    let submitterDiv = document.createElement('div');
    submitterDiv.id = bguid();
    let pastElementArray = [];
    let pastElementDictionary = [];
    let moveClickX, moveClickY;
    let submissionCount = 0;
    let currentElement = null;
    let targetPath = [];
    let targetingActive = false;

    // Listen for messages from popup to start targeting mode
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startTargeting') {
            targetingActive = true;
            buildOverlay();
            sendResponse({ success: true });
            return true;
        } else if (message.action === 'stopTargeting') {
            targetingActive = false;
            reset();
            sendResponse({ success: true });
            return true;
        }
        return false;
    });

    // Add escape key listener
    document.addEventListener('keyup', escapeKeyListen, true);

    // When user clicks on overlay to target an element
    function targetAdMouseClick(e) {
        e.stopPropagation();
        e.preventDefault();
        
        // Remove the overlay but keep targeting active
        overlay.remove();
        
        // Get the element under the click point
        currentElement = document.elementFromPoint(e.clientX, e.clientY);
        
        // Remove the click listener
        document.removeEventListener('click', targetAdMouseClick, true);
        
        // Build the DOM path to the element
        targetPath = findPath(currentElement);
        
        // Update popup with element info
        sendElementInfoToPopup(currentElement);
        
        // Show the submitter div
        submitDiv(currentElement);
        
        return false;
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

    // Build the floating control panel
    function submitDiv(elmClicked) {
        // Local vars
        let moveMouseIsDown = false;
        const path = targetPath;
        
        // Build submit div
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
            if (!currentElement) return;
            
            // Store the element information
            const elementInfo = {
                tagName: currentElement.tagName,
                id: currentElement.id,
                className: currentElement.className,
                path: getElementXPath(currentElement),
                content: currentElement.textContent.trim(),
                html: nodeToString(currentElement),
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
            targetingActive = false;
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
            if (targetingActive) {
                buildOverlay();
            }
        }, true);

        // Close button listener
        submitterHeaderSpan.addEventListener('click', function(e) {
            moveMouseIsDown = false;
            removeMoveSubmitBoxMouseEvent();
            window.removeEventListener('keyup', arrowKeyListen, true);
            
            // Reset and exit targeting mode
            targetingActive = false;
            reset();
            
            // Report back to popup
            chrome.runtime.sendMessage({
                type: 'targetingComplete',
                success: false,
                canceled: true
            });
        }, true);

        // Add keyboard navigation
        window.addEventListener('keyup', arrowKeyListen, true);

        // Functions
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
            currentElement = elm;
            
            // Update popup with element info
            sendElementInfoToPopup(elm);
        }

        function arrowKeyListen(e) {
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
                
                if (targetingActive) {
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
        window.removeEventListener('keyup', arrowKeyListen, true);
    }

    // Escape key handler
    function escapeKeyListen(e) {
        if (e.key === "Escape" || e.key === "Esc") {
            if (targetingActive) {
                if (overlay.parentElement != null) {
                    // Cancel overlay
                    targetingActive = false;
                    reset();
                    chrome.runtime.sendMessage({
                        type: 'targetingComplete',
                        success: false,
                        canceled: true
                    });
                } else if (submitterDiv.parentElement != null) {
                    // Cancel submitter, back to overlay
                    reset();
                    buildOverlay();
                }
            }
        }
    }

    // Movement handlers for the floating div
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

    // Helper function to convert DOM element to string
    function nodeToString(node) {
        if (!node) return '';
        const tmpNode = document.createElement('div');
        tmpNode.appendChild(node.cloneNode(true));
        const str = tmpNode.innerHTML;
        return str;
    }

    // Get the DOM path to an element
    function findPath(target) {
        const path = [];
        while (target) {
            path.push(target);
            target = target.parentElement;
        }
        return path;
    }

    // Get XPath of an element for storing
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
        
        const siblings = element.parentNode.childNodes;
        let count = 0;
        let index = 0;
        
        for (let i = 0; i < siblings.length; i++) {
            const sibling = siblings[i];
            
            if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
                count++;
            }
            
            if (sibling === element) {
                index = count;
            }
        }
        
        return `${getElementXPath(element.parentNode)}/${element.tagName.toLowerCase()}[${index}]`;
    }

    // Utility function to generate a unique ID
    function bguid(a) {
        return a ? (a^Math.random()*16>>a/4).toString(16) : ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, bguid);
    }

    function arrowKeyListen(e) {
        // This will be defined inside submitDiv
    }
})();