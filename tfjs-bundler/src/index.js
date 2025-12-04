import * as tf from '@tensorflow/tfjs';

/**
 * ImageAdPredictor - CNN-based image advertisement detector
 *
 * Classifies images as advertisements or non-advertisements using a
 * trained CNN model. Designed for Chrome extension deployment.
 */
export class ImageAdPredictor {
  constructor() {
    this.model = null;
    this.config = null;
    this.isInitialized = false;

    // Default configuration (will be loaded from model_config.json)
    this.inputHeight = 224;
    this.inputWidth = 224;
    this.threshold = 0.5;
  }

  /**
   * Initialize the predictor by loading the model and configuration
   * @returns {Promise<ImageAdPredictor>} Initialized predictor instance
   */
  async initialize() {
    if (!this.isInitialized) {
      console.log('Initializing ImageAdPredictor...');

      // Load model and config in parallel
      [this.model, this.config] = await Promise.all([
        this.loadModel(),
        this.loadConfig()
      ]);

      // Update configuration from loaded config
      if (this.config) {
        this.inputHeight = this.config.image_height || 224;
        this.inputWidth = this.config.image_width || 224;
        this.threshold = this.config.threshold || 0.5;
      }

      this.isInitialized = true;
      console.log('ImageAdPredictor initialized successfully');
      console.log(`Model input size: ${this.inputWidth}x${this.inputHeight}`);
      console.log(`Classification threshold: ${this.threshold}`);
    }
    return this;
  }

  /**
   * Load the TensorFlow.js CNN model
   * @returns {Promise<tf.LayersModel>} Loaded model
   */
  async loadModel() {
    console.log('Loading CNN model...');
    console.log('TensorFlow.js backend:', tf.getBackend());

    tf.enableProdMode();
    await tf.ready();

    const model = await tf.loadLayersModel('model/model.json');
    console.log('Model loaded successfully');
    console.log('Model input shape:', model.inputs[0].shape);

    return model;
  }

  /**
   * Load model configuration
   * @returns {Promise<Object>} Configuration object
   */
  async loadConfig() {
    try {
      const response = await fetch('./model/model_config.json');
      const config = await response.json();
      console.log('Model config loaded:', config);
      return config;
    } catch (error) {
      console.warn('Could not load model config, using defaults:', error);
      return null;
    }
  }

  /**
   * Preprocess an image element for model input
   * @param {HTMLImageElement|HTMLCanvasElement} imageElement - Image to preprocess
   * @returns {tf.Tensor3D} Preprocessed image tensor
   */
  preprocessImage(imageElement) {
    return tf.tidy(() => {
      // Convert image to tensor
      let tensor = tf.browser.fromPixels(imageElement);

      // Resize to model input size
      tensor = tf.image.resizeBilinear(tensor, [this.inputHeight, this.inputWidth]);

      // Note: The custom CNN model includes a Rescaling layer (1./255)
      // So we don't need to normalize here - the model handles it

      // Add batch dimension [height, width, channels] -> [1, height, width, channels]
      tensor = tensor.expandDims(0);

      return tensor;
    });
  }

  /**
   * Preprocess image from base64 string
   * @param {string} base64String - Base64 encoded image
   * @returns {Promise<tf.Tensor3D>} Preprocessed image tensor
   */
  async preprocessImageFromBase64(base64String) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const tensor = this.preprocessImage(img);
          resolve(tensor);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = (error) => {
        reject(new Error('Failed to load image from base64'));
      };

      img.src = base64String;
    });
  }

  /**
   * Predict if an image is an advertisement
   * @param {HTMLImageElement|HTMLCanvasElement|string} input - Image element or base64 string
   * @returns {Promise<Object>} Prediction result
   */
  async predict(input) {
    // Ensure the model is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    let inputTensor;

    try {
      // Handle different input types
      if (typeof input === 'string') {
        // Base64 string
        inputTensor = await this.preprocessImageFromBase64(input);
      } else {
        // Image or canvas element
        inputTensor = this.preprocessImage(input);
      }

      // Make prediction
      const outputTensor = this.model.predict(inputTensor);
      const prediction = await outputTensor.data();

      // Get probability score
      const adProbability = prediction[0];
      const isAd = adProbability > this.threshold;
      const label = isAd ? 'Ad' : 'Not Ad';
      const confidence = isAd ? adProbability : (1 - adProbability);

      // Cleanup tensors
      inputTensor.dispose();
      outputTensor.dispose();

      return {
        isAd,
        label,
        confidence,
        adProbability,
        threshold: this.threshold
      };
    } catch (error) {
      console.error('Prediction error:', error);

      // Cleanup on error
      if (inputTensor) {
        inputTensor.dispose();
      }

      throw error;
    }
  }

  /**
   * Batch predict multiple images
   * @param {Array<HTMLImageElement|string>} images - Array of images or base64 strings
   * @returns {Promise<Array<Object>>} Array of prediction results
   */
  async predictBatch(images) {
    // Ensure the model is initialized
    if (!this.isInitialized) {
      await this.initialize();
    }

    const predictions = [];

    for (const image of images) {
      try {
        const result = await this.predict(image);
        predictions.push(result);
      } catch (error) {
        console.error('Error predicting image:', error);
        predictions.push({
          isAd: false,
          label: 'Error',
          confidence: 0,
          adProbability: 0,
          error: error.message
        });
      }
    }

    return predictions;
  }

  /**
   * Dispose of the model and free memory
   */
  dispose() {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.isInitialized = false;
    console.log('ImageAdPredictor disposed');
  }

  /**
   * Get model information
   * @returns {Object} Model info
   */
  getModelInfo() {
    if (!this.isInitialized || !this.model) {
      return null;
    }

    return {
      inputShape: this.model.inputs[0].shape,
      outputShape: this.model.outputs[0].shape,
      inputHeight: this.inputHeight,
      inputWidth: this.inputWidth,
      threshold: this.threshold,
      backend: tf.getBackend(),
      config: this.config
    };
  }
}

// Usage example:
// const predictor = new ImageAdPredictor();
// await predictor.initialize();
//
// // Predict from image element
// const imgElement = document.querySelector('img');
// const result = await predictor.predict(imgElement);
// console.log(result); // { isAd: true, label: 'Ad', confidence: 0.92, ... }
//
// // Predict from base64
// const base64Image = 'data:image/png;base64,...';
// const result2 = await predictor.predict(base64Image);
//
// // Batch predictions
// const images = [img1, img2, img3];
// const results = await predictor.predictBatch(images);
