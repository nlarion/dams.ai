"""
Image generator using Google's Imagen API.
Handles API calls, rate limiting, retry logic, and image saving.
Adapted for advertisement detection training data generation.
"""

import os
import time
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Tuple
import google.generativeai as genai
from PIL import Image
import io
import logging

from config import IMAGE_RESOLUTION, DEFAULT_DELAY

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ImageGenerator:
    """Handles image generation using Google Imagen API."""

    def __init__(self, api_key: str, delay: float = DEFAULT_DELAY, max_retries: int = 3):
        """
        Initialize the image generator.

        Args:
            api_key: Google AI Studio API key
            delay: Seconds to wait between API calls (rate limiting)
            max_retries: Maximum number of retry attempts for failed requests
        """
        self.api_key = api_key
        self.delay = delay
        self.max_retries = max_retries

        # Configure the API
        genai.configure(api_key=api_key)

        # Initialize the Imagen model
        self.model = genai.ImageGenerationModel("imagen-3.0-generate-001")

        logger.info(f"ImageGenerator initialized with {delay}s delay and {max_retries} max retries")

    def generate_image(self, prompt: str) -> Optional[Image.Image]:
        """
        Generate an image from a prompt with retry logic.

        Args:
            prompt: Text prompt for image generation

        Returns:
            PIL Image object or None if generation failed
        """
        for attempt in range(self.max_retries):
            try:
                logger.info(f"Generating image (attempt {attempt + 1}/{self.max_retries})")

                # Generate image using Imagen API
                result = self.model.generate_images(
                    prompt=prompt,
                    number_of_images=1,
                    safety_filter_level="block_some",
                    person_generation="allow_adult",
                    aspect_ratio="1:1"
                )

                # Extract the image from the result
                if result.images:
                    image = result.images[0]
                    # Convert to PIL Image
                    pil_image = image._pil_image
                    logger.info("Image generated successfully")
                    return pil_image
                else:
                    logger.warning("No images returned from API")
                    return None

            except Exception as e:
                logger.error(f"Error on attempt {attempt + 1}: {str(e)}")
                if attempt < self.max_retries - 1:
                    wait_time = self.delay * (attempt + 1)  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error("Max retries reached. Generation failed.")
                    return None

        return None

    def save_image(
        self,
        image: Image.Image,
        output_dir: Path,
        filename: str,
        parameters: Dict[str, str],
        prompt: str,
        label: str
    ) -> Optional[Dict]:
        """
        Save generated image and return metadata.

        Args:
            image: PIL Image to save
            output_dir: Directory to save image
            filename: Name of the image file
            parameters: Parameters used to generate the image
            prompt: Full prompt used for generation
            label: Image label ('ad' or 'non_ad')

        Returns:
            Metadata dictionary or None if save failed
        """
        try:
            # Ensure output directory exists
            output_dir.mkdir(parents=True, exist_ok=True)

            # Save image
            filepath = output_dir / filename
            image.save(filepath, format='PNG')
            logger.info(f"Image saved to {filepath}")

            # Create metadata entry
            metadata = {
                "filename": filename,
                "filepath": str(filepath),
                "label": label,
                "parameters": parameters,
                "prompt": prompt,
                "timestamp": datetime.now().isoformat(),
                "image_size": f"{image.width}x{image.height}"
            }

            return metadata

        except Exception as e:
            logger.error(f"Error saving image: {str(e)}")
            return None

    def generate_and_save(
        self,
        prompt: str,
        parameters: Dict[str, str],
        output_dir: Path,
        filename: str,
        label: str
    ) -> Tuple[bool, Optional[Dict]]:
        """
        Generate an image and save it with metadata.

        Args:
            prompt: Text prompt for generation
            parameters: Parameters used in the prompt
            output_dir: Directory to save the image
            filename: Name for the image file
            label: Image label ('ad' or 'non_ad')

        Returns:
            Tuple of (success: bool, metadata: Optional[Dict])
        """
        # Generate image
        image = self.generate_image(prompt)

        if image is None:
            return False, None

        # Add delay before next call (rate limiting)
        time.sleep(self.delay)

        # Save image and get metadata
        metadata = self.save_image(image, output_dir, filename, parameters, prompt, label)

        if metadata is None:
            return False, None

        return True, metadata


def main():
    """Test the image generator."""
    from dotenv import load_dotenv

    # Load environment variables
    load_dotenv()
    api_key = os.getenv('GOOGLE_API_KEY')

    if not api_key:
        print("Error: GOOGLE_API_KEY not found in .env file")
        return

    # Initialize generator
    generator = ImageGenerator(api_key, delay=1)

    # Test prompt
    test_prompt = "A realistic website banner advertisement for a summer sale, featuring bright colors, '50% OFF' text, and a 'Shop Now' button"

    # Test generation
    print("Testing image generation...")
    image = generator.generate_image(test_prompt)

    if image:
        print(f"Success! Generated image: {image.size}")

        # Test saving
        output_dir = Path("test_output")
        test_params = {"ad_type": "banner", "industry": "retail"}
        metadata = generator.save_image(
            image,
            output_dir,
            "test_ad_image.png",
            test_params,
            test_prompt,
            "ad"
        )
        print(f"Metadata: {json.dumps(metadata, indent=2)}")
    else:
        print("Generation failed")


if __name__ == "__main__":
    main()
