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

// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     var elmArr = request.message;
//     console.log("received array: "+elmArr.length);
//     var running = false;
//     var i = 0;

//         async function tokenize(message) {
//             return makeTokens(message);
//         }

//         async function looprun(elmArr){
//             await wasm_bindgen('without_a_bundler_bg.wasm');
//             var startTime = new Date();
//             var tokenArr = [];
//             // todo latest idea is to try and convert wasm to use array and spit back array of arrays.

//             // for (let i = 0; i < elmArr.length; i++) {
//             //     var tokens = await tokenize(elmArr[i]);
//             //     tokenArr.push(tokens);
//             // }
//             // both work about the same
//             var tokens = await tokenize(elmArr);

//             console.log(tokens);
// 		    console.log("seconds to build tokjen array: ",(new Date() - startTime) / 1000);

//             var results = await predictFromToken(tokens);
//             return results;
//         }
            
//         looprun(elmArr).then(x=>{
//             sendResponse(x);
//         });
//         return true;
//         //return Promise.resolve({response: "stopped"});
        
// });

