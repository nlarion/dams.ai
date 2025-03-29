// Browser-compatible NLP Tokenizer with Vocabulary Building
// This tokenizer can operate in word-level or subword-level (BPE) mode

class NLPTokenizer {
    constructor(options = {}) {
      // Default options
      this.options = {
        mode: 'word', // 'word' or 'bpe' (byte-pair encoding)
        caseSensitive: false,
        maxVocabSize: 10000,
        minFrequency: 2,
        specialTokens: ['<PAD>', '<OOV>', '<SOS>', '<EOS>'],
        ...options
      };
      
      // Initialize vocabulary-related structures
      this.vocab = new Map(); // token -> id
      this.idToToken = new Map(); // id -> token
      this.tokenFrequency = new Map(); // token -> frequency
      this.merges = new Map(); // For BPE: (pair) -> new token
    }
    
    // Load corpus from a File object (browser)
    async loadCorpusFromFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          try {
            const jsonData = JSON.parse(event.target.result);
            
            // Determine the structure of the JSON
            let corpus = [];
            
            if (Array.isArray(jsonData)) {
              //corpus = jsonData.filter(item => typeof item === 'string');
              corpus = jsonData.flatMap(x=>x.corpus);
            } else if (typeof jsonData === 'object') {
              // Try to find text fields to extract
              const possibleFields = ['text', 'content', 'corpus', 'documents', 'sentences'];
              
              for (const field of possibleFields) {
                if (jsonData[field] && Array.isArray(jsonData[field])) {
                  corpus = jsonData[field].filter(item => typeof item === 'string');
                  break;
                } else if (jsonData[field] && typeof jsonData[field] === 'string') {
                  // If it's a single string, split by newlines
                  corpus = jsonData[field].split(/\r?\n/).filter(Boolean);
                  break;
                }
              }
            }
            
            if (corpus.length === 0) {
              reject(new Error('Could not extract text corpus from JSON file'));
            }
            
            console.log(`Loaded corpus with ${corpus.length} documents/sentences`);
            resolve(corpus);
          } catch (error) {
            reject(new Error('Error parsing JSON: ' + error.message));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Error reading file'));
        };
        
        reader.readAsText(file);
      });
    }
    
    // Load corpus from raw JSON string
    loadCorpusFromString(jsonString) {
      try {
        const jsonData = JSON.parse(jsonString);
        
        // Determine the structure of the JSON
        let corpus = [];
        
        if (Array.isArray(jsonData)) {
          corpus = jsonData.filter(item => typeof item === 'string');
        } else if (typeof jsonData === 'object') {
          // Try to find text fields to extract
          const possibleFields = ['text', 'content', 'corpus', 'documents', 'sentences'];
          
          for (const field of possibleFields) {
            if (jsonData[field] && Array.isArray(jsonData[field])) {
              corpus = jsonData[field].filter(item => typeof item === 'string');
              break;
            } else if (jsonData[field] && typeof jsonData[field] === 'string') {
              // If it's a single string, split by newlines
              corpus = jsonData[field].split(/\r?\n/).filter(Boolean);
              break;
            }
          }
        }
        
        if (corpus.length === 0) {
          throw new Error('Could not extract text corpus from JSON string');
        }
        
        console.log(`Loaded corpus with ${corpus.length} documents/sentences`);
        return corpus;
      } catch (error) {
        console.error('Error loading corpus:', error);
        throw error;
      }
    }
    
    // Process the corpus to build vocabulary
    buildVocabulary(corpus) {
      console.log('Building vocabulary...');
      this.tokenFrequency.clear();
      
      // Add special tokens first with high frequency to ensure they're included
      for (const token of this.options.specialTokens) {
        this.tokenFrequency.set(token, Infinity);
      }
      
      // Process the corpus based on the tokenization mode
      if (this.options.mode === 'word') {
        this._buildWordVocabulary(corpus);
      } else if (this.options.mode === 'bpe') {
        this._buildBPEVocabulary(corpus);
      } else {
        throw new Error(`Unsupported tokenization mode: ${this.options.mode}`);
      }
      
      // Convert frequency map to sorted array of [token, freq] pairs
      const sortedTokens = [...this.tokenFrequency.entries()]
        .sort((a, b) => b[1] - a[1]); // Sort by frequency, descending
      
      // Filter by minimum frequency and limit vocabulary size
      const filteredTokens = sortedTokens
        .filter(([_, freq]) => freq >= this.options.minFrequency)
        .slice(0, this.options.maxVocabSize);
      
      // Build the final vocabulary
      this.vocab.clear();
      this.idToToken.clear();
      
      filteredTokens.forEach(([token, _], index) => {
        this.vocab.set(token, index);
        this.idToToken.set(index, token);
      });
      
      console.log(`Vocabulary built with ${this.vocab.size} tokens`);
      return this.vocab;
    }
    
    // Build word-level vocabulary
    _buildWordVocabulary(corpus) {
      for (const text of corpus) {
        // Handle case sensitivity
        const processedText = this.options.caseSensitive ? text : text.toLowerCase();
        
        // Simple word tokenization (split by whitespace and punctuation)
        const words = processedText.match(/\b\w+\b|\S/g) || [];
        
        for (const word of words) {
          this.tokenFrequency.set(
            word, 
            (this.tokenFrequency.get(word) || 0) + 1
          );
        }
      }
    }
    
    // Build byte-pair encoding vocabulary
    _buildBPEVocabulary(corpus) {
      // First, build character-level vocabulary
      const charFreq = new Map();
      
      for (const text of corpus) {
        const processedText = this.options.caseSensitive ? text : text.toLowerCase();
        
        for (const char of processedText) {
          charFreq.set(char, (charFreq.get(char) || 0) + 1);
        }
      }
      
      // Initialize with character-level tokens
      for (const [char, freq] of charFreq.entries()) {
        this.tokenFrequency.set(char, freq);
      }
      
      // Prepare word counts for BPE
      const wordCounts = new Map();
      
      for (const text of corpus) {
        const processedText = this.options.caseSensitive ? text : text.toLowerCase();
        const words = processedText.split(/\s+/);
        
        for (const word of words) {
          if (word.length > 0) {
            // Add word boundary marker for BPE
            const wordWithBoundary = `${word}`;
            wordCounts.set(
              wordWithBoundary,
              (wordCounts.get(wordWithBoundary) || 0) + 1
            );
          }
        }
      }
      
      // Perform BPE merges until we reach max vocab size
      const maxMerges = this.options.maxVocabSize - this.options.specialTokens.length - charFreq.size;
      
      for (let i = 0; i < maxMerges; i++) {
        // Find the most frequent pair
        const pairCounts = this._getPairCounts(wordCounts);
        if (pairCounts.size === 0) break;
        
        // Get the most frequent pair
        let bestPair = null;
        let maxCount = 0;
        
        for (const [pair, count] of pairCounts.entries()) {
          if (count > maxCount) {
            maxCount = count;
            bestPair = pair;
          }
        }
        
        if (!bestPair || maxCount < this.options.minFrequency) break;
        
        // Create new token from the pair
        const [first, second] = bestPair.split(',');
        const newToken = first + second;
        
        // Add the merge to our vocabulary
        this.merges.set(bestPair, newToken);
        this.tokenFrequency.set(newToken, maxCount);
        
        // Update word counts with the merged token
        this._updateWordCounts(wordCounts, first, second, newToken);
      }
    }
    
    // Helper for BPE: count pairs in the vocabulary
    _getPairCounts(wordCounts) {
      const pairCounts = new Map();
      
      for (const [word, count] of wordCounts.entries()) {
        const symbols = word.split('');
        
        for (let i = 0; i < symbols.length - 1; i++) {
          const pair = `${symbols[i]},${symbols[i + 1]}`;
          pairCounts.set(
            pair,
            (pairCounts.get(pair) || 0) + count
          );
        }
      }
      
      return pairCounts;
    }
    
    // Helper for BPE: update words after a merge
    _updateWordCounts(wordCounts, first, second, newToken) {
      const newWordCounts = new Map();
      
      for (const [word, count] of wordCounts.entries()) {
        // Replace all occurrences of the pair
        let newWord = word;
        const pattern = new RegExp(`${first}${second}`, 'g');
        newWord = newWord.replace(pattern, newToken);
        
        newWordCounts.set(newWord, count);
      }
      
      // Update the word counts
      wordCounts.clear();
      for (const [word, count] of newWordCounts.entries()) {
        wordCounts.set(word, count);
      }
    }
    
    // Tokenize text based on the built vocabulary
    tokenize(text) {
      if (!this.vocab.size) {
        throw new Error('Vocabulary not built. Call buildVocabulary() first.');
      }
      
      const processedText = this.options.caseSensitive ? text : text.toLowerCase();
      
      if (this.options.mode === 'word') {
        return this._wordTokenize(processedText);
      } else if (this.options.mode === 'bpe') {
        return this._bpeTokenize(processedText);
      }
      
      throw new Error(`Unsupported tokenization mode: ${this.options.mode}`);
    }
    
    // Word-level tokenization
    _wordTokenize(text) {
      const words = text.match(/\b\w+\b|\S/g) || [];
      const tokens = [];
      
      for (const word of words) {
        if (this.vocab.has(word)) {
          tokens.push(this.vocab.get(word));
        } else {
          // Use <OOV> token for out-of-vocabulary words
          tokens.push(this.vocab.get('<OOV>'));
        }
      }
      
      return tokens;
    }
    
    // BPE tokenization
    _bpeTokenize(text) {
      const words = text.split(/\s+/);
      const tokens = [];
      
      for (const word of words) {
        if (word.length === 0) continue;
        
        // If the whole word is in vocabulary, use it
        if (this.vocab.has(word)) {
          tokens.push(this.vocab.get(word));
          continue;
        }
        
        // Otherwise, split into characters and apply merges
        let symbols = word.split('');
        
        let changes = true;
        while (changes) {
          changes = false;
          
          for (let i = 0; i < symbols.length - 1; i++) {
            const pair = `${symbols[i]},${symbols[i + 1]}`;
            
            if (this.merges.has(pair)) {
              const newToken = this.merges.get(pair);
              symbols[i] = newToken;
              symbols.splice(i + 1, 1);
              changes = true;
              break;
            }
          }
        }
        
        // Convert to token IDs
        for (const symbol of symbols) {
          if (this.vocab.has(symbol)) {
            tokens.push(this.vocab.get(symbol));
          } else {
            tokens.push(this.vocab.get('<OOV>'));
          }
        }
      }
      
      return tokens;
    }
    
    // Convert token IDs back to text
    detokenize(tokenIds) {
      const tokens = tokenIds.map(id => {
        return this.idToToken.has(id) ? this.idToToken.get(id) : '<OOV>';
      });
      
      // For word-level, just join with spaces
      if (this.options.mode === 'word') {
        return tokens.join(' ');
      }
      
      // For BPE, need to handle subword tokens
      let text = '';
      let insideWord = false;
      
      for (const token of tokens) {
        // Skip special tokens
        if (this.options.specialTokens.includes(token)) {
          continue;
        }
        
        if (insideWord) {
          text += token;
        } else {
          if (text.length > 0) text += ' ';
          text += token;
          insideWord = true;
        }
        
        // Check if token ends with word boundary marker
        if (token.endsWith(' ')) {
          insideWord = false;
        }
      }
      
      return text;
    }
    
    // Save vocabulary to a JSON string
    saveVocabularyToString() {
      const vocabObject = {
        mode: this.options.mode,
        tokens: Array.from(this.vocab.entries()),
        merges: this.options.mode === 'bpe' ? Array.from(this.merges.entries()) : [],
        options: this.options
      };
      
      return JSON.stringify(vocabObject, null, 2);
    }
    
    // Save vocabulary to a file (browser)
    saveVocabularyToFile(filename = 'vocabulary.json') {
      const vocabJSON = this.saveVocabularyToString();
      
      // Create a blob and download link
      const blob = new Blob([vocabJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a download link and trigger it
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      
      // Clean up
      URL.revokeObjectURL(url);
    }
    
    // Load vocabulary from a JSON string
    loadVocabularyFromString(jsonString) {
      const vocabObject = JSON.parse(jsonString);
      
      this.options = vocabObject.options;
      
      // Restore vocabulary maps
      this.vocab.clear();
      this.idToToken.clear();
      
      for (const [token, id] of vocabObject.tokens) {
        this.vocab.set(token, id);
        this.idToToken.set(id, token);
      }
      
      // Restore merges for BPE
      this.merges.clear();
      
      if (this.options.mode === 'bpe') {
        for (const [pair, newToken] of vocabObject.merges) {
          this.merges.set(pair, newToken);
        }
      }
      
      console.log(`Loaded vocabulary with ${this.vocab.size} tokens`);
    }
    
    // Load vocabulary from a File object (browser)
    loadVocabularyFromFile(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (event) => {
          try {
            this.loadVocabularyFromString(event.target.result);
            resolve();
          } catch (error) {
            reject(new Error('Error parsing vocabulary file: ' + error.message));
          }
        };
        
        reader.onerror = () => {
          reject(new Error('Error reading vocabulary file'));
        };
        
        reader.readAsText(file);
      });
    }
  }
  
  // Usage example in a browser environment
  // <input type="file" id="corpusFile" accept=".json">
  // <button id="buildVocab">Build Vocabulary</button>
  // <textarea id="textToTokenize"></textarea>
  // <button id="tokenizeText">Tokenize</button>
  // <div id="results"></div>
  
  /*
  // Example browser usage (put this code in a separate script)
  document.addEventListener('DOMContentLoaded', () => {
    const tokenizer = new NLPTokenizer({ 
      mode: 'word',
      maxVocabSize: 5000,
      minFrequency: 2
    });
    
    let corpus = null;
    
    // Load corpus file
    document.getElementById('corpusFile').addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (file) {
        try {
          corpus = await tokenizer.loadCorpusFromFile(file);
          console.log('Corpus loaded successfully');
        } catch (error) {
          console.error('Error loading corpus:', error);
        }
      }
    });
    
    // Build vocabulary
    document.getElementById('buildVocab').addEventListener('click', () => {
      if (corpus) {
        tokenizer.buildVocabulary(corpus);
        tokenizer.saveVocabularyToFile('vocabulary.json');
      } else {
        console.error('Please load a corpus first');
      }
    });
    
    // Tokenize text
    document.getElementById('tokenizeText').addEventListener('click', () => {
      const text = document.getElementById('textToTokenize').value;
      if (text && tokenizer.vocab.size > 0) {
        const tokens = tokenizer.tokenize(text);
        const detokenized = tokenizer.detokenize(tokens);
        
        document.getElementById('results').innerHTML = `
          <p>Original text: ${text}</p>
          <p>Tokens: ${JSON.stringify(tokens)}</p>
          <p>Detokenized: ${detokenized}</p>
        `;
      } else {
        console.error('Please enter text and build vocabulary first');
      }
    });
  });
  */