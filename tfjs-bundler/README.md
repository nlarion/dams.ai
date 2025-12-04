# TensorFlow.js Bundler for DAMS.AI

This directory contains the webpack bundler for TensorFlow.js used in the DAMS.AI Chrome extension. It bundles TensorFlow.js and the ImageAdPredictor class into a single file that can be imported by the extension's background script.

## Purpose

The bundler creates a single `tfjs-bundle.js` file that:
- Includes TensorFlow.js core libraries
- Includes WASM backend support for better performance
- Exports the `ImageAdPredictor` class for CNN-based image ad detection
- Is optimized for Chrome extension deployment

## What Changed from v1 (NLP)

**Previous (v1.0):**
- Text-based NLP classification
- AdPredictor class with tokenization
- Vocabulary loading
- Text preprocessing

**Current (v2.0):**
- Image-based CNN classification
- ImageAdPredictor class with image preprocessing
- Model config loading
- Image tensor preprocessing for 224x224 input

## Setup

1. **Install dependencies:**
   ```bash
   cd tfjs-bundler
   npm install
   # or
   yarn install
   ```

2. **Build the bundle:**
   ```bash
   npm run build
   ```

   If you encounter OpenSSL errors (common with older Node versions):
   ```bash
   npm run build:legacy
   ```

   Or manually:
   ```bash
   export NODE_OPTIONS=--openssl-legacy-provider
   npx webpack build --config webpack.config.js
   ```

## Output

After building, the following files are generated in `dist/`:
- `tfjs-bundle.js` - The bundled TensorFlow.js library with ImageAdPredictor
- `tfjs-bundle.js.map` - Source map for debugging
- `tfjs-bundle.js.LICENSE.txt` - License information

## Usage in Chrome Extension

### 1. Copy bundle to background.js

After building, copy the contents of `dist/tfjs-bundle.js` to the beginning of `../chromeExtension/background.js`:

```bash
# Manual copy (recommended to review changes)
# Copy contents of dist/tfjs-bundle.js to top of ../chromeExtension/background.js
```

### 2. Use in background script

The `ImageAdPredictor` class is now available globally:

```javascript
// In background.js (after the bundled code)

// Initialize predictor
const predictor = new ImageAdPredictor();
await predictor.initialize();

// Predict from image element
const result = await predictor.predict(imageElement);
console.log(result);
// {
//   isAd: true,
//   label: 'Ad',
//   confidence: 0.92,
//   adProbability: 0.92,
//   threshold: 0.5
// }

// Predict from base64
const base64Image = 'data:image/png;base64,...';
const result = await predictor.predict(base64Image);

// Batch predictions
const images = [img1, img2, img3];
const results = await predictor.predictBatch(images);
```

## ImageAdPredictor API

### Constructor
```javascript
const predictor = new ImageAdPredictor();
```

### Methods

#### `initialize()`
Initialize the predictor by loading the model and configuration.
```javascript
await predictor.initialize();
```

#### `predict(input)`
Predict if an image is an advertisement.
- **input**: HTMLImageElement, HTMLCanvasElement, or base64 string
- **returns**: Promise<Object> with prediction result

```javascript
const result = await predictor.predict(imageElement);
```

#### `predictBatch(images)`
Predict multiple images at once.
- **images**: Array of images or base64 strings
- **returns**: Promise<Array<Object>> with prediction results

```javascript
const results = await predictor.predictBatch([img1, img2, img3]);
```

#### `getModelInfo()`
Get information about the loaded model.
```javascript
const info = predictor.getModelInfo();
console.log(info);
// {
//   inputShape: [null, 224, 224, 3],
//   outputShape: [null, 1],
//   inputHeight: 224,
//   inputWidth: 224,
//   threshold: 0.5,
//   backend: 'wasm',
//   config: { ... }
// }
```

#### `dispose()`
Dispose of the model and free memory.
```javascript
predictor.dispose();
```

## Model Configuration

The predictor automatically loads `model/model_config.json` which should contain:

```json
{
  "model_type": "custom_cnn",
  "input_shape": [224, 224, 3],
  "image_height": 224,
  "image_width": 224,
  "threshold": 0.5,
  "class_names": ["ads", "non_ads"],
  "preprocessing": {
    "rescale": "1./255",
    "method": "built-in"
  }
}
```

## Image Preprocessing

The `ImageAdPredictor` automatically:
1. Resizes images to 224x224 (or configured size)
2. Converts to RGB tensors
3. The model includes a built-in Rescaling layer (1./255), so no manual normalization needed
4. Adds batch dimension for inference

## Performance

- **WASM Backend**: Enabled by default for better CPU performance
- **GPU Backend**: Can be enabled if WebGL is available
- **Memory Management**: Tensors are automatically disposed after prediction

## Troubleshooting

### Build Errors

**OpenSSL Error:**
```
Error: error:0308010C:digital envelope routines::unsupported
```
**Solution:** Use `npm run build:legacy` or set `NODE_OPTIONS=--openssl-legacy-provider`

**Module Not Found:**
```
Error: Cannot find module '@tensorflow/tfjs'
```
**Solution:** Run `npm install` first

### Runtime Errors

**Model Not Loading:**
- Ensure `model/model.json` exists in the extension directory
- Check that model weights files (.bin) are present
- Verify `model_config.json` is correctly formatted

**WASM Backend Issues:**
- Ensure `.wasm` files are copied to the extension directory
- Check Chrome extension manifest allows loading WASM files

## Files

```
tfjs-bundler/
├── README.md                # This file
├── package.json             # Dependencies and build scripts
├── webpack.config.js        # Webpack configuration
├── src/
│   └── index.js            # ImageAdPredictor class
└── dist/                   # Generated files (gitignored)
    ├── tfjs-bundle.js      # Bundled output
    ├── tfjs-bundle.js.map  # Source map
    └── tfjs-bundle.js.LICENSE.txt
```

## Development

When making changes:

1. Edit `src/index.js`
2. Run `npm run build`
3. Copy `dist/tfjs-bundle.js` to `../chromeExtension/background.js`
4. Test in Chrome extension
5. Commit changes

## Notes

- The bundle includes WASM backend support but not GPU (WebGL) support by default
- Model must be trained and exported to TensorFlow.js format first (see `../training/`)
- The bundle is ~900KB minified (similar to the old NLP version)
- No longer includes text tokenization or vocabulary (removed for CNN approach)
