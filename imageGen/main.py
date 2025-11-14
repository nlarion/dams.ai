#!/usr/bin/env python3
"""
Main orchestrator for advertisement detection image generation pipeline.
Generates balanced datasets with progress tracking and resumption support.
"""

import os
import json
import argparse
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List
from dotenv import load_dotenv
from tqdm import tqdm

from prompt_generator import PromptGenerator
from image_generator import ImageGenerator
from config import DEFAULT_DELAY, DEFAULT_BATCH_SIZE

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('generation.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class DatasetGenerator:
    """Orchestrates the generation of a balanced dataset of ad/non-ad images."""

    def __init__(
        self,
        api_key: str,
        output_dir: Path,
        delay: float = DEFAULT_DELAY,
        seed: int = None
    ):
        """
        Initialize the dataset generator.

        Args:
            api_key: Google AI Studio API key
            output_dir: Root directory for output
            delay: Seconds between API calls
            seed: Random seed for reproducibility
        """
        self.output_dir = Path(output_dir)
        self.ads_dir = self.output_dir / "ads"
        self.non_ads_dir = self.output_dir / "non_ads"
        self.metadata_file = self.output_dir / "metadata.json"

        # Create output directories
        self.ads_dir.mkdir(parents=True, exist_ok=True)
        self.non_ads_dir.mkdir(parents=True, exist_ok=True)

        # Initialize components
        self.prompt_generator = PromptGenerator(seed=seed)
        self.image_generator = ImageGenerator(api_key, delay=delay)

        # Load or initialize metadata
        self.metadata = self.load_metadata()

        logger.info(f"DatasetGenerator initialized with output dir: {output_dir}")

    def load_metadata(self) -> Dict:
        """Load existing metadata or create new structure."""
        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, 'r') as f:
                    metadata = json.load(f)
                logger.info(f"Loaded existing metadata with {len(metadata.get('images', []))} images")
                return metadata
            except Exception as e:
                logger.error(f"Error loading metadata: {e}")

        # Initialize new metadata structure
        return {
            "images": [],
            "generation_stats": {
                "total_generated": 0,
                "ads_count": 0,
                "non_ads_count": 0,
                "failed_count": 0,
                "started_at": datetime.now().isoformat(),
                "last_updated": None
            }
        }

    def save_metadata(self):
        """Save metadata to file."""
        try:
            self.metadata["generation_stats"]["last_updated"] = datetime.now().isoformat()
            with open(self.metadata_file, 'w') as f:
                json.dump(self.metadata, f, indent=2)
            logger.debug("Metadata saved")
        except Exception as e:
            logger.error(f"Error saving metadata: {e}")

    def get_next_filename(self, label: str) -> str:
        """
        Generate the next filename for an image.

        Args:
            label: 'ad' or 'non_ad'

        Returns:
            Filename string
        """
        count = self.metadata["generation_stats"][f"{label}s_count"] + 1
        return f"{label}_{count:05d}.png"

    def generate_image(self, is_ad: bool) -> bool:
        """
        Generate a single image (ad or non-ad).

        Args:
            is_ad: Whether to generate an advertisement image

        Returns:
            True if successful, False otherwise
        """
        label = "ad" if is_ad else "non_ad"
        output_dir = self.ads_dir if is_ad else self.non_ads_dir

        # Generate prompt
        prompt, parameters = self.prompt_generator.generate_prompt(is_ad)

        # Generate filename
        filename = self.get_next_filename(label)

        # Generate and save image
        success, metadata = self.image_generator.generate_and_save(
            prompt=prompt,
            parameters=parameters,
            output_dir=output_dir,
            filename=filename,
            label=label
        )

        if success and metadata:
            # Update metadata
            self.metadata["images"].append(metadata)
            self.metadata["generation_stats"]["total_generated"] += 1
            self.metadata["generation_stats"][f"{label}s_count"] += 1

            # Save metadata after each successful generation (crash recovery)
            self.save_metadata()

            logger.info(f"Successfully generated {label} image: {filename}")
            return True
        else:
            self.metadata["generation_stats"]["failed_count"] += 1
            self.save_metadata()
            logger.warning(f"Failed to generate {label} image")
            return False

    def generate_dataset(self, num_images: int, balanced: bool = True):
        """
        Generate a dataset of images.

        Args:
            num_images: Total number of images to generate
            balanced: If True, generate 50/50 split of ads/non-ads
        """
        logger.info(f"Starting generation of {num_images} images (balanced: {balanced})")

        if balanced:
            # Generate equal numbers of each type
            num_per_class = num_images // 2
            generation_plan = (
                [True] * num_per_class +  # Ads
                [False] * num_per_class   # Non-ads
            )

            # If odd number, add one more ad image
            if num_images % 2 == 1:
                generation_plan.append(True)

            # Shuffle to interleave generation
            import random
            random.shuffle(generation_plan)
        else:
            # All ads by default
            generation_plan = [True] * num_images

        # Generate images with progress bar
        successful = 0
        failed = 0

        with tqdm(total=num_images, desc="Generating images") as pbar:
            for is_ad in generation_plan:
                success = self.generate_image(is_ad)

                if success:
                    successful += 1
                else:
                    failed += 1

                pbar.update(1)
                pbar.set_postfix({
                    'success': successful,
                    'failed': failed
                })

        # Final stats
        logger.info("=" * 80)
        logger.info("GENERATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Total requested: {num_images}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Ad images: {self.metadata['generation_stats']['ads_count']}")
        logger.info(f"Non-ad images: {self.metadata['generation_stats']['non_ads_count']}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info("=" * 80)


def main():
    """Main entry point with command-line interface."""
    parser = argparse.ArgumentParser(
        description="Generate synthetic advertisement detection training images"
    )
    parser.add_argument(
        '--num-images',
        type=int,
        default=10,
        help='Total number of images to generate (default: 10)'
    )
    parser.add_argument(
        '--output-dir',
        type=str,
        default='output',
        help='Output directory (default: output)'
    )
    parser.add_argument(
        '--delay',
        type=float,
        default=DEFAULT_DELAY,
        help=f'Seconds between API calls (default: {DEFAULT_DELAY})'
    )
    parser.add_argument(
        '--seed',
        type=int,
        default=None,
        help='Random seed for reproducibility (default: None)'
    )
    parser.add_argument(
        '--unbalanced',
        action='store_true',
        help='Generate only ad images (default: balanced 50/50)'
    )

    args = parser.parse_args()

    # Load environment variables
    load_dotenv()
    api_key = os.getenv('GOOGLE_API_KEY')

    if not api_key:
        logger.error("GOOGLE_API_KEY not found in .env file")
        logger.error("Please create a .env file with your API key:")
        logger.error("  GOOGLE_API_KEY=your_key_here")
        return 1

    # Initialize generator
    generator = DatasetGenerator(
        api_key=api_key,
        output_dir=args.output_dir,
        delay=args.delay,
        seed=args.seed
    )

    # Generate dataset
    try:
        generator.generate_dataset(
            num_images=args.num_images,
            balanced=not args.unbalanced
        )
        return 0
    except KeyboardInterrupt:
        logger.info("\nGeneration interrupted by user")
        logger.info(f"Progress saved to {generator.metadata_file}")
        return 130
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    exit(main())
