class AdDetector {
    constructor() {
      this.model = null;
      this.vocabulary = null;
      this.isLoading = false;
      this.isReady = false;
      this.padToken = '<PAD>';
      this.oovToken = '<OOV>';
      this.maxLength = 50;
    }
  
    async loadModel() {
      if (this.isLoading || this.isReady) return this.isReady;
      
      this.isLoading = true;
      try {
        console.log('Loading Ad Detector model...');
        
        // Load the model
        this.model = await tf.loadLayersModel('model/model.json', {
          inputShape: [50]  // Use your max_length value here (50 from your Python code)
        });
        
        // Load the vocabulary
        const response = await fetch(chrome.runtime.getURL('model/vocabulary.json'));
        const vocabData = await response.json();

        // const response = await fetch('./model/vocabulary.json');
        // vocabData = await response.json();
        
        // Process vocabulary based on format
        this.vocabulary = {};
        if (vocabData.tokens && Array.isArray(vocabData.tokens)) {
          // Handle structured format with tokens array
          vocabData.tokens.forEach(pair => {
            if (Array.isArray(pair) && pair.length === 2) {
              this.vocabulary[pair[0]] = parseInt(pair[1], 10);
            }
          });
          
          // Get special tokens if available
          if (vocabData.options && vocabData.options.specialTokens) {
            const specialTokens = vocabData.options.specialTokens;
            if (specialTokens.length >= 1) this.padToken = specialTokens[0];
            if (specialTokens.length >= 2) this.oovToken = specialTokens[1];
          }
          console.log('fucking bullshit', this.vocabulary);
        } else {
          // Handle simple dictionary format
          console.log('wow')
          this.vocabulary = vocabData;
        }
        
        this.isLoading = false;
        this.isReady = true;
        console.log('Ad detector model loaded successfully');
        return true;
      } catch (error) {
        console.error('Error loading ad detector model:', error);
        this.isLoading = false;
        return false;
      }
    }
  
    tokenize(text) {
      // Convert to lowercase and remove punctuation
      const cleanText = text.toLowerCase().replace(/[^\w\s]/g, '');
      
      // Split into words
      const words = cleanText.split(/\s+/);
      
      // Convert words to indices
      const oovIndex = vocab['<OOV>'] || 1;
      const sequence = words.map(word => vocab[word] || oovIndex);
      
      // Truncate or pad as needed
      const padIndex = vocab['<PAD>'] || 0;
      
      if (sequence.length > maxLength) {
        return sequence.slice(0, maxLength);
      } else {
        const padding = Array(maxLength - sequence.length).fill(padIndex);
        return [...sequence, ...padding];
      }
    }
  
    async detectAd(text) {
      if (!this.isReady) {
        if (!this.isLoading) {
          await this.loadModel();
        } else {
          return { isAd: false, confidence: 0 };
        }
      }
  
      try {
        // Skip empty or very short texts
        if (!text || text.length < 10) {
          return { isAd: false, confidence: 0 };
        }
        
        // Tokenize the text
        const sequence = this.tokenize(text);
        
        // Convert to tensor
        const inputTensor = tf.tensor2d([sequence], [1, this.maxLength]);
        
        // Run inference
        const outputTensor = this.model.predict(inputTensor);
        const predictionArray = await outputTensor.data();
        
        // Cleanup tensors to prevent memory leaks
        inputTensor.dispose();
        outputTensor.dispose();
        
        // Get confidence
        const confidence = predictionArray[0];
        
        return {
          isAd: confidence > 0.5,
          confidence: confidence
        };
      } catch (error) {
        console.error('Error detecting ad:', error);
        return { isAd: false, confidence: 0 };
      }
    }
  }
  
  // Create global instance
  window.adDetector = new AdDetector();