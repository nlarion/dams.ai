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
        self.last_retry_count = 0  # Track retries for the last generation

        # Configure the API
        genai.configure(api_key=api_key)

        logger.info(f"ImageGenerator initialized with {delay}s delay and {max_retries} max retries")

    def generate_image(self, prompt: str) -> Optional[Image.Image]:
        """
        Generate an image from a prompt with retry logic.

        Args:
            prompt: Text prompt for image generation

        Returns:
            PIL Image object or None if generation failed
        """
        self.last_retry_count = 0  # Reset retry count for this generation

        for attempt in range(self.max_retries):
            try:
                logger.info(f"Generating image (attempt {attempt + 1}/{self.max_retries})")
                logger.info(f"Prompt: {prompt[:100]}...")  # Log first 100 chars of prompt

                # Use Gemini 2.5 Flash Image model from Google AI Studio
                model = genai.GenerativeModel('gemini-2.5-flash-image')

                # Generate image
                response = model.generate_content(prompt)

                # Extract image from response
                if hasattr(response, 'candidates') and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        for part in candidate.content.parts:
                            # Check for file data FIRST (Gemini often returns images as file URIs)
                            if hasattr(part, 'file_data') and part.file_data:
                                logger.info("Image returned as file_data")

                                # Debug: show what's in file_data
                                logger.debug(f"file_data attributes: {dir(part.file_data)}")

                                if hasattr(part.file_data, 'file_uri') and part.file_data.file_uri:
                                    file_uri = part.file_data.file_uri
                                    logger.info(f"File URI found: {file_uri}")

                                    # Download from URI using the configured API
                                    try:
                                        # Use the file API to download
                                        file_name = file_uri.split('/')[-1]
                                        if file_name:
                                            file_obj = genai.get_file(name=file_name)
                                            import requests
                                            img_response = requests.get(file_obj.uri)
                                            if img_response.status_code == 200:
                                                pil_image = Image.open(io.BytesIO(img_response.content))
                                                logger.info("Image downloaded successfully from URI")
                                                self.last_retry_count = attempt  # Track successful attempt
                                                return pil_image
                                            else:
                                                logger.error(f"Failed to download from file URI: {img_response.status_code}")
                                    except Exception as e:
                                        logger.error(f"Error downloading from file API: {e}")
                                        # Try direct download as fallback
                                        try:
                                            import requests
                                            img_response = requests.get(file_uri)
                                            if img_response.status_code == 200:
                                                pil_image = Image.open(io.BytesIO(img_response.content))
                                                logger.info("Image downloaded successfully from direct URI")
                                                self.last_retry_count = attempt  # Track successful attempt
                                                return pil_image
                                        except:
                                            logger.error(f"Direct URI download also failed")
                                else:
                                    logger.warning("file_data exists but file_uri is empty or missing")
                                    # Check if there's mime_type and data
                                    if hasattr(part.file_data, 'mime_type'):
                                        logger.info(f"file_data mime_type: {part.file_data.mime_type}")
                                    # Skip this part and continue to check for inline_data
                                    continue

                            # Check for inline image data
                            elif hasattr(part, 'inline_data'):
                                import base64

                                # Get the image data
                                image_data = part.inline_data.data

                                # Skip if empty
                                if not image_data or len(image_data) == 0:
                                    logger.warning("Inline data is empty, skipping...")
                                    continue

                                # Try different ways to decode the image
                                try:
                                    # If it's base64 encoded
                                    if isinstance(image_data, str):
                                        image_bytes = base64.b64decode(image_data)
                                    else:
                                        image_bytes = image_data

                                    pil_image = Image.open(io.BytesIO(image_bytes))
                                    logger.info("Image generated successfully with Gemini 2.5 Flash Image (inline)")
                                    self.last_retry_count = attempt  # Track successful attempt
                                    return pil_image
                                except Exception as img_error:
                                    logger.error(f"Failed to decode inline image data: {img_error}")
                                    logger.error(f"Image data type: {type(image_data)}")
                                    logger.error(f"Image data length: {len(image_data) if hasattr(image_data, '__len__') else 'N/A'}")

                # Alternative: check if response has a direct image attribute
                if hasattr(response, 'image'):
                    pil_image = response.image
                    logger.info("Image generated successfully")
                    self.last_retry_count = attempt  # Track successful attempt
                    return pil_image

                # Debug: let's see what we actually got
                logger.warning("No images returned from API")
                logger.warning(f"Response type: {type(response)}")
                if hasattr(response, 'candidates') and len(response.candidates) > 0:
                    candidate = response.candidates[0]
                    logger.warning(f"Candidate attributes: {[attr for attr in dir(candidate) if not attr.startswith('_')]}")
                    if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
                        logger.warning(f"Number of parts: {len(candidate.content.parts)}")
                        for i, part in enumerate(candidate.content.parts):
                            logger.warning(f"Part {i} type: {type(part)}")
                            logger.warning(f"Part {i} attributes: {[attr for attr in dir(part) if not attr.startswith('_')]}")
                            if hasattr(part, 'text'):
                                logger.warning(f"Part {i} text: {part.text[:200]}...")
                return None

            except Exception as e:
                logger.error(f"Error on attempt {attempt + 1}: {str(e)}")
                logger.error(f"Error type: {type(e).__name__}")
                self.last_retry_count = attempt  # Track current attempt

                if attempt < self.max_retries - 1:
                    wait_time = self.delay * (attempt + 1)  # Exponential backoff
                    logger.info(f"Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error("Max retries reached. Generation failed.")
                    logger.error(f"Full error: {e}")
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
