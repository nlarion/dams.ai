"""
CNN model architectures for advertisement detection.
Provides various model options including transfer learning and custom architectures.
"""

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, Model
from typing import Tuple


def build_mobilenet_classifier(
    input_shape: Tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 1,
    trainable_layers: int = 20
) -> Model:
    """
    Build a MobileNetV2-based classifier for ad detection.
    Lightweight and suitable for browser deployment.

    Args:
        input_shape: Input image shape (height, width, channels)
        num_classes: Number of output classes (1 for binary)
        trainable_layers: Number of top layers to unfreeze for training

    Returns:
        Compiled Keras model
    """
    # Load pre-trained MobileNetV2 (without top classification layer)
    base_model = keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )

    # Freeze the base model initially
    base_model.trainable = False

    # Create new model on top
    inputs = keras.Input(shape=input_shape)

    # Preprocessing for MobileNetV2 (scales to [-1, 1])
    x = keras.applications.mobilenet_v2.preprocess_input(inputs)

    # Base model
    x = base_model(x, training=False)

    # Pooling and classification head
    x = layers.GlobalAveragePooling2D(name='global_avg_pooling')(x)
    x = layers.Dropout(0.5, name='dropout')(x)
    x = layers.Dense(128, activation='relu', name='dense_128')(x)
    x = layers.Dropout(0.3, name='dropout_2')(x)

    # Output layer
    if num_classes == 1:
        outputs = layers.Dense(1, activation='sigmoid', name='output')(x)
    else:
        outputs = layers.Dense(num_classes, activation='softmax', name='output')(x)

    model = Model(inputs, outputs)

    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy' if num_classes == 1 else 'categorical_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
    )

    print(f"MobileNetV2 classifier built with {input_shape} input")
    print(f"Total params: {model.count_params():,}")
    print(f"Base model frozen: {not base_model.trainable}")

    return model


def unfreeze_model(model: Model, num_layers: int = 20) -> Model:
    """
    Unfreeze top layers of a model for fine-tuning.

    Args:
        model: Keras model with frozen base
        num_layers: Number of layers to unfreeze from the top

    Returns:
        Model with unfrozen layers
    """
    # Find the base model (typically the first layer after input)
    base_model = None
    for layer in model.layers:
        if hasattr(layer, 'layers') and len(layer.layers) > 10:
            base_model = layer
            break

    if base_model is None:
        print("Warning: Could not find base model to unfreeze")
        return model

    # Unfreeze the top layers
    base_model.trainable = True

    # Freeze all layers except the last num_layers
    for layer in base_model.layers[:-num_layers]:
        layer.trainable = False

    # Recompile with lower learning rate for fine-tuning
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.0001),
        loss=model.loss,
        metrics=model.metrics
    )

    trainable_params = sum([tf.size(w).numpy() for w in model.trainable_weights])
    print(f"Model unfrozen: {num_layers} layers trainable")
    print(f"Trainable params: {trainable_params:,}")

    return model


def build_efficientnet_classifier(
    input_shape: Tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 1
) -> Model:
    """
    Build an EfficientNetB0-based classifier for ad detection.
    Better accuracy than MobileNet but larger model size.

    Args:
        input_shape: Input image shape (height, width, channels)
        num_classes: Number of output classes (1 for binary)

    Returns:
        Compiled Keras model
    """
    # Load pre-trained EfficientNetB0
    base_model = keras.applications.EfficientNetB0(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )

    # Freeze the base model initially
    base_model.trainable = False

    # Create new model on top
    inputs = keras.Input(shape=input_shape)

    # Preprocessing for EfficientNet
    x = keras.applications.efficientnet.preprocess_input(inputs)

    # Base model
    x = base_model(x, training=False)

    # Pooling and classification head
    x = layers.GlobalAveragePooling2D(name='global_avg_pooling')(x)
    x = layers.BatchNormalization(name='bn')(x)
    x = layers.Dropout(0.5, name='dropout')(x)
    x = layers.Dense(256, activation='relu', name='dense_256')(x)
    x = layers.Dropout(0.3, name='dropout_2')(x)

    # Output layer
    if num_classes == 1:
        outputs = layers.Dense(1, activation='sigmoid', name='output')(x)
    else:
        outputs = layers.Dense(num_classes, activation='softmax', name='output')(x)

    model = Model(inputs, outputs)

    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy' if num_classes == 1 else 'categorical_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
    )

    print(f"EfficientNetB0 classifier built with {input_shape} input")
    print(f"Total params: {model.count_params():,}")

    return model


def build_custom_cnn(
    input_shape: Tuple[int, int, int] = (224, 224, 3),
    num_classes: int = 1
) -> Model:
    """
    Build a custom CNN from scratch for ad detection.
    Lightweight but requires more training data.

    Args:
        input_shape: Input image shape (height, width, channels)
        num_classes: Number of output classes (1 for binary)

    Returns:
        Compiled Keras model
    """
    model = keras.Sequential([
        # Input layer
        layers.Input(shape=input_shape),

        # Normalization
        layers.Rescaling(1./255),

        # Conv block 1
        layers.Conv2D(32, (3, 3), activation='relu', padding='same', name='conv1'),
        layers.BatchNormalization(name='bn1'),
        layers.MaxPooling2D((2, 2), name='pool1'),

        # Conv block 2
        layers.Conv2D(64, (3, 3), activation='relu', padding='same', name='conv2'),
        layers.BatchNormalization(name='bn2'),
        layers.MaxPooling2D((2, 2), name='pool2'),

        # Conv block 3
        layers.Conv2D(128, (3, 3), activation='relu', padding='same', name='conv3'),
        layers.BatchNormalization(name='bn3'),
        layers.MaxPooling2D((2, 2), name='pool3'),

        # Conv block 4
        layers.Conv2D(256, (3, 3), activation='relu', padding='same', name='conv4'),
        layers.BatchNormalization(name='bn4'),
        layers.GlobalAveragePooling2D(name='global_avg_pooling'),

        # Dense layers
        layers.Dense(512, activation='relu', name='dense_512'),
        layers.Dropout(0.5, name='dropout'),
        layers.Dense(128, activation='relu', name='dense_128'),
        layers.Dropout(0.3, name='dropout_2'),

        # Output layer
        layers.Dense(
            1 if num_classes == 1 else num_classes,
            activation='sigmoid' if num_classes == 1 else 'softmax',
            name='output'
        )
    ])

    # Compile model
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy' if num_classes == 1 else 'categorical_crossentropy',
        metrics=['accuracy', keras.metrics.Precision(), keras.metrics.Recall()]
    )

    print(f"Custom CNN built with {input_shape} input")
    print(f"Total params: {model.count_params():,}")

    return model


def create_data_generators(
    train_dir: str,
    val_dir: str,
    test_dir: str = None,
    image_size: Tuple[int, int] = (224, 224),
    batch_size: int = 32,
    augment: bool = True
) -> Tuple:
    """
    Create data generators for training, validation, and test sets.

    Args:
        train_dir: Path to training data directory
        val_dir: Path to validation data directory
        test_dir: Path to test data directory (optional)
        image_size: Target image size (height, width)
        batch_size: Batch size for training
        augment: Whether to apply data augmentation

    Returns:
        Tuple of (train_generator, val_generator, test_generator)
    """
    if augment:
        # Data augmentation for training
        train_datagen = keras.preprocessing.image.ImageDataGenerator(
            rescale=1./255,
            rotation_range=15,
            width_shift_range=0.1,
            height_shift_range=0.1,
            shear_range=0.1,
            zoom_range=0.1,
            horizontal_flip=True,
            fill_mode='nearest'
        )
    else:
        train_datagen = keras.preprocessing.image.ImageDataGenerator(rescale=1./255)

    # No augmentation for validation/test
    val_datagen = keras.preprocessing.image.ImageDataGenerator(rescale=1./255)

    # Create generators
    train_generator = train_datagen.flow_from_directory(
        train_dir,
        target_size=image_size,
        batch_size=batch_size,
        class_mode='binary',
        shuffle=True
    )

    val_generator = val_datagen.flow_from_directory(
        val_dir,
        target_size=image_size,
        batch_size=batch_size,
        class_mode='binary',
        shuffle=False
    )

    test_generator = None
    if test_dir:
        test_generator = val_datagen.flow_from_directory(
            test_dir,
            target_size=image_size,
            batch_size=batch_size,
            class_mode='binary',
            shuffle=False
        )

    print(f"Train generator: {train_generator.samples} samples")
    print(f"Val generator: {val_generator.samples} samples")
    if test_generator:
        print(f"Test generator: {test_generator.samples} samples")

    return train_generator, val_generator, test_generator


if __name__ == "__main__":
    # Test model building
    print("Testing MobileNetV2 model...")
    model = build_mobilenet_classifier()
    model.summary()

    print("\n" + "="*80 + "\n")
    print("Testing Custom CNN model...")
    model = build_custom_cnn()
    model.summary()
