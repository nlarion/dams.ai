# TensorFlow NLP Ad Classification

A TensorFlow-based NLP classification system that distinguishes between advertisement ("ads") and non-advertisement ("not ads") text. This project includes a custom tokenizer that can load vocabulary from structured JSON files and export models to TensorFlow.js for browser deployment.

## 🌟 Features

- Custom tokenizer supporting structured vocabulary JSON files
- Binary text classification (ads vs. not ads)
- Complete pipeline from data loading to model training
- Export to TensorFlow.js for in-browser inference
- Comprehensive Jupyter notebook with step-by-step implementation

## 📋 Requirements

- Python 3.6+
- TensorFlow 2.x
- Jupyter Notebook
- NumPy
- Pandas
- Matplotlib
- Scikit-learn
- TensorFlow.js (for conversion to browser format)

## 🚀 Getting Started

### Installation

1. Clone this repository:
```bash
git clone https://github.com/yourusername/tensorflow-nlp-ad-classification.git
cd tensorflow-nlp-ad-classification
```

2. Install the required dependencies:
```bash
pip install -r requirements.txt
```

3. Run Jupyter Notebook:
```bash
jupyter notebook
```

4. Open the `NLP_Classification_Jupyter_Notebook.ipynb` file.

## 💡 Usage

### Training a Model

The notebook guides you through the entire process:

1. Loading/creating a vocabulary
2. Processing a corpus from JSON
3. Creating and training a classification model
4. Evaluating model performance
5. Testing with new text
6. Exporting for TensorFlow.js

### Custom Tokenizer

The project includes a custom tokenizer that supports various vocabulary formats:

```python
# Load tokenizer with structured vocabulary
tokenizer = CustomTokenizer("vocabulary.json")

# Convert texts to sequences
sequences = tokenizer.texts_to_sequences(texts)

# Convert sequences back to texts
texts = tokenizer.sequences_to_texts(sequences)
```

### Vocabulary Format

The tokenizer supports a structured vocabulary format:

```json
{
  "mode": "word",
  "tokens": [
    ["<PAD>", 0],
    ["<OOV>", 1],
    ["< SOS >", 2],
    ["<EOS>", 3],
    ["-", 4],
    ["\"", 5]
  ],
  "merges": [],
  "options": {
    "mode": "word",
    "caseSensitive": false,
    "maxVocabSize": 100000,
    "minFrequency": 2,
    "specialTokens": [
      "<PAD>",
      "<OOV>",
      "< SOS >",
      "<EOS>"
    ]
  }
}
```

### Browser Integration

Once exported, you can use the model in a browser with TensorFlow.js:

```javascript
// Load the model
const model = await tf.loadLayersModel('model.json');

// Load vocabulary
const response = await fetch('vocabulary_structured.json');
const vocabData = await response.json();

// Process tokens
const vocab = {};
vocabData.tokens.forEach(pair => {
  if (Array.isArray(pair) && pair.length === 2) {
    vocab[pair[0]] = pair[1];
  }
});

// Use the model
const prediction = await model.predict(inputTensor);
```

## 📊 Model Architecture

The default model uses:

- Word embeddings (16 dimensions)
- Global average pooling
- Dense layers with dropout
- Binary classification output

You can customize the architecture by modifying the `build_model` function.

## 🧪 Example Results

The model achieves high accuracy on the sample dataset:

| Metric | Score |
|--------|-------|
| Accuracy | ~95% |
| Precision | ~94% |
| Recall | ~96% |
| F1 Score | ~95% |

## 📝 License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

See [LICENSE.md](LICENSE.md) for full license text.

**Summary:**
- ✅ You can use, share, and modify this work for non-commercial purposes
- ✅ You must give appropriate credit and indicate if changes were made
- ❌ You cannot use this work for commercial purposes without permission

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the [issues page](https://github.com/yourusername/tensorflow-nlp-ad-classification/issues).

## 📧 Contact

Neil Larion - [@nlarion](https://twitter.com/nlarion) - [dude@neillarion.com](mailto:dude@neillarion.com) - [website](https://www.neillarion.com)

Project Link: [https://www.dams.ai](https://www.dams.ai)
