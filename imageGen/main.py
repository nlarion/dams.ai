#!/usr/bin/env python3
"""
Main orchestrator for advertisement detection image generation pipeline.
Generates balanced datasets with progress tracking and resumption support.
"""

import os
import json
import argparse
import logging
import time
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from dotenv import load_dotenv
from tqdm import tqdm

from prompt_generator import PromptGenerator
from image_generator import ImageGenerator
from database import MetadataDB
from config import (
    DEFAULT_DELAY, DEFAULT_BATCH_SIZE, PARAMETERS,
    GENERATION_PROFILES, INVALID_COMBINATIONS
)

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


def sanitize_folder_name(name: str) -> str:
    """Convert parameter value to valid folder name."""
    # Remove common suffixes and clean up
    name = name.replace(" and ", "_")
    name = name.replace(" ", "_")
    name = name.replace("-", "_")
    name = name.lower()
    # Remove trailing descriptors
    for suffix in ["_retail", "_services", "_products", "_and_tourism",
                   "_and_wellness", "_and_apparel", "_delivery", "_streaming_services",
                   "_and_accommodations", "_and_holiday_sales", "_and_gyms",
                   "_cards_and_banking", "_and_courses", "_streaming", "_and_accessories"]:
        if name.endswith(suffix):
            name = name[:-len(suffix)]
    return name


def validate_parameters(parameters: Dict[str, str], is_ad: bool) -> Tuple[bool, List[str]]:
    """
    Validate parameter combinations for semantic consistency.

    Args:
        parameters: Dictionary of generation parameters
        is_ad: Whether this is for an ad image

    Returns:
        Tuple of (is_valid, list of issues)
    """
    issues = []

    if not is_ad:
        return True, []

    # Check for invalid combinations
    for invalid in INVALID_COMBINATIONS:
        match = True
        for key, value in invalid.items():
            if parameters.get(key) != value:
                match = False
                break
        if match:
            issues.append(f"Invalid combination: {invalid}")

    return len(issues) == 0, issues


class DatasetGenerator:
    """Orchestrates the generation of a balanced dataset of ad/non-ad images."""

    def __init__(
        self,
        api_key: str,
        output_dir: Path,
        delay: float = DEFAULT_DELAY,
        seed: int = None,
        batch_id: str = None
    ):
        """
        Initialize the dataset generator.

        Args:
            api_key: Google AI Studio API key
            output_dir: Root directory for output
            delay: Seconds between API calls
            seed: Random seed for reproducibility
            batch_id: Optional batch identifier for grouping generations
        """
        self.output_dir = Path(output_dir)
        self.ads_dir = self.output_dir / "ads"
        self.non_ads_dir = self.output_dir / "non_ads"
        self.db_path = self.output_dir / "metadata.db"
        self.batch_id = batch_id or datetime.now().strftime("%Y%m%d_%H%M%S")

        # Create base output directories
        self.ads_dir.mkdir(parents=True, exist_ok=True)
        self.non_ads_dir.mkdir(parents=True, exist_ok=True)

        # Create industry subdirectories automatically
        self._create_industry_folders()

        # Initialize components
        self.prompt_generator = PromptGenerator(seed=seed)
        self.image_generator = ImageGenerator(api_key, delay=delay)
        self.db = MetadataDB(self.db_path)

        logger.info(f"DatasetGenerator initialized with output dir: {output_dir}")
        logger.info(f"Batch ID: {self.batch_id}")

    def _create_industry_folders(self):
        """Create subdirectories for each industry and content type."""
        # Create ad industry folders
        for industry in PARAMETERS["ad_industry"]:
            folder_name = sanitize_folder_name(industry)
            (self.ads_dir / folder_name).mkdir(exist_ok=True)

        # Create non-ad content type folders
        content_types = set()
        for content in PARAMETERS["content_type"]:
            # Extract main category from content type description
            folder_name = self._get_content_folder(content)
            content_types.add(folder_name)

        for folder_name in content_types:
            (self.non_ads_dir / folder_name).mkdir(exist_ok=True)

        logger.info(f"Created {len(PARAMETERS['ad_industry'])} industry folders")
        logger.info(f"Created {len(content_types)} content type folders")

    def _get_content_folder(self, content_type: str) -> str:
        """Map content type description to folder name."""
        # Extract key category from content type
        mappings = {
            "news": "news",
            "sports": "sports",
            "celebrity": "entertainment",
            "product review": "reviews",
            "social media": "social",
            "meme": "memes",
            "animal": "animals",
            "Olympic": "sports",
            "coach": "sports",
            "product photo": "products",
            "cartoon": "cartoons",
            "food": "food",
            "travel": "travel",
            "editorial": "editorial",
            "behind-the-scenes": "entertainment",
            "musician": "entertainment",
            "nature": "nature",
            "tutorial": "tutorials",
            "infographic": "infographics"
        }

        content_lower = content_type.lower()
        for key, folder in mappings.items():
            if key.lower() in content_lower:
                return folder
        return "other"

    def get_next_filename(self, label: str, subfolder: str) -> Tuple[str, Path]:
        """
        Generate the next filename for an image.

        Args:
            label: 'ad' or 'non_ad'
            subfolder: Industry or content type subfolder

        Returns:
            Tuple of (filename, full output directory path)
        """
        count = self.db.get_count(label) + 1
        filename = f"{label}_{count:05d}.png"

        if label == "ad":
            output_dir = self.ads_dir / subfolder
        else:
            output_dir = self.non_ads_dir / subfolder

        return filename, output_dir

    def generate_image(
        self,
        is_ad: bool,
        industry: Optional[str] = None,
        validate: bool = False
    ) -> bool:
        """
        Generate a single image (ad or non-ad).

        Args:
            is_ad: Whether to generate an advertisement image
            industry: Optional specific industry to generate for
            validate: Whether to validate parameter combinations

        Returns:
            True if successful, False otherwise
        """
        label = "ad" if is_ad else "non_ad"

        # Generate prompt (with optional industry override)
        if industry and is_ad:
            prompt, parameters = self.prompt_generator.generate_prompt(
                is_ad, industry_override=industry
            )
        else:
            prompt, parameters = self.prompt_generator.generate_prompt(is_ad)

        # Validate parameters if requested
        if validate:
            is_valid, issues = validate_parameters(parameters, is_ad)
            if not is_valid:
                logger.warning(f"Invalid parameter combination: {issues}")
                # Regenerate with different parameters
                return self.generate_image(is_ad, industry, validate)

        # Determine subfolder
        if is_ad:
            subfolder = sanitize_folder_name(parameters["ad_industry"])
        else:
            subfolder = self._get_content_folder(parameters["content_type"])

        # Generate filename
        filename, output_dir = self.get_next_filename(label, subfolder)

        # Track generation time
        start_time = time.time()

        # Generate and save image
        success, metadata = self.image_generator.generate_and_save(
            prompt=prompt,
            parameters=parameters,
            output_dir=output_dir,
            filename=filename,
            label=label
        )

        generation_duration_ms = int((time.time() - start_time) * 1000)

        if success and metadata:
            # Add enhanced metadata
            metadata["generation_duration_ms"] = generation_duration_ms
            metadata["batch_id"] = self.batch_id
            metadata["api_model_version"] = "gemini-2.5-flash-preview-05-20"
            metadata["retry_count"] = self.image_generator.last_retry_count

            # Get file size
            filepath = output_dir / filename
            if filepath.exists():
                metadata["file_size_bytes"] = filepath.stat().st_size

            # Save to database
            self.db.add_image(metadata)
            self.db.update_stats(label, success=True)

            logger.info(f"Successfully generated {label} image: {subfolder}/{filename}")
            return True
        else:
            self.db.update_stats(label, success=False)
            logger.warning(f"Failed to generate {label} image")
            return False

    def generate_dataset(
        self,
        num_images: int,
        balanced: bool = True,
        industry: Optional[str] = None,
        profile: Optional[str] = None,
        validate: bool = False
    ):
        """
        Generate a dataset of images.

        Args:
            num_images: Total number of images to generate
            balanced: If True, generate 50/50 split of ads/non-ads
            industry: Optional specific industry to focus on
            profile: Optional generation profile name
            validate: Whether to validate parameter combinations
        """
        logger.info(f"Starting generation of {num_images} images (balanced: {balanced})")

        # Load profile if specified
        if profile:
            profile_data = self.db.get_profile(profile)
            if profile_data:
                config = profile_data["config"]
                logger.info(f"Using profile: {profile}")
                # Override settings from profile
                if "industry" in config:
                    industry = config["industry"]
                if "balanced" in config:
                    balanced = config["balanced"]
            else:
                logger.warning(f"Profile '{profile}' not found, using defaults")

        if industry:
            logger.info(f"Focusing on industry: {industry}")

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
                success = self.generate_image(is_ad, industry, validate)

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
        stats = self.db.get_stats()
        logger.info("=" * 80)
        logger.info("GENERATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Total requested: {num_images}")
        logger.info(f"Successful: {successful}")
        logger.info(f"Failed: {failed}")
        logger.info(f"Ad images: {stats['ads_count']}")
        logger.info(f"Non-ad images: {stats['non_ads_count']}")
        logger.info(f"Output directory: {self.output_dir}")
        logger.info(f"Database: {self.db_path}")
        logger.info("=" * 80)

    def export_statistics(self) -> Dict:
        """Export comprehensive statistics about the dataset."""
        return self.db.export_stats()

    def close(self):
        """Clean up resources."""
        self.db.close()


def setup_default_profiles(db: MetadataDB):
    """Set up default generation profiles."""
    profiles = {
        "finance_focus": {
            "config": {"industry": "financial services", "balanced": False},
            "description": "Generate only finance industry advertisements"
        },
        "ecommerce_focus": {
            "config": {"industry": "e-commerce retail", "balanced": False},
            "description": "Generate only e-commerce advertisements"
        },
        "balanced_all": {
            "config": {"balanced": True},
            "description": "Balanced 50/50 split across all industries"
        },
        "gaming_focus": {
            "config": {"industry": "gaming", "balanced": False},
            "description": "Generate only gaming advertisements"
        }
    }

    for name, data in profiles.items():
        db.save_profile(name, data["config"], data["description"])


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
    parser.add_argument(
        '--industry',
        type=str,
        default=None,
        help='Generate ads for specific industry only (e.g., "financial services")'
    )
    parser.add_argument(
        '--profile',
        type=str,
        default=None,
        help='Use a predefined generation profile'
    )
    parser.add_argument(
        '--export-stats',
        action='store_true',
        help='Export statistics and exit'
    )
    parser.add_argument(
        '--validate',
        action='store_true',
        help='Validate parameter combinations during generation'
    )
    parser.add_argument(
        '--migrate',
        action='store_true',
        help='Migrate old JSON metadata to SQLite'
    )
    parser.add_argument(
        '--list-profiles',
        action='store_true',
        help='List available generation profiles'
    )
    parser.add_argument(
        '--list-industries',
        action='store_true',
        help='List available industries'
    )

    args = parser.parse_args()

    # Handle info commands first
    if args.list_industries:
        print("Available industries:")
        for industry in PARAMETERS["ad_industry"]:
            print(f"  - {industry}")
        return 0

    # Load environment variables
    load_dotenv()
    api_key = os.getenv('GOOGLE_API_KEY')

    # For some commands we don't need API key
    if args.export_stats or args.migrate or args.list_profiles:
        output_path = Path(args.output_dir)
        db_path = output_path / "metadata.db"

        if not db_path.exists() and not args.migrate:
            logger.error(f"Database not found at {db_path}")
            return 1

        db = MetadataDB(db_path)

        if args.list_profiles:
            profiles = db.list_profiles()
            if profiles:
                print("Available profiles:")
                for name in profiles:
                    profile = db.get_profile(name)
                    print(f"  - {name}: {profile.get('description', '')}")
            else:
                print("No profiles found. Run generation once to create defaults.")
            db.close()
            return 0

        if args.migrate:
            json_path = output_path / "metadata.json"
            if json_path.exists():
                count = db.migrate_from_json(json_path)
                print(f"Migrated {count} records from JSON to SQLite")
                # Rename old file
                json_path.rename(json_path.with_suffix('.json.bak'))
                print(f"Old JSON file renamed to {json_path.with_suffix('.json.bak')}")
            else:
                print(f"No JSON metadata found at {json_path}")
            db.close()
            return 0

        if args.export_stats:
            stats = db.export_stats()
            print(json.dumps(stats, indent=2))
            db.close()
            return 0

        db.close()

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

    # Setup default profiles if they don't exist
    if not generator.db.list_profiles():
        setup_default_profiles(generator.db)
        logger.info("Created default generation profiles")

    # Generate dataset
    try:
        generator.generate_dataset(
            num_images=args.num_images,
            balanced=not args.unbalanced,
            industry=args.industry,
            profile=args.profile,
            validate=args.validate
        )
        return 0
    except KeyboardInterrupt:
        logger.info("\nGeneration interrupted by user")
        logger.info(f"Progress saved to {generator.db_path}")
        return 130
    except Exception as e:
        logger.error(f"Unexpected error: {e}", exc_info=True)
        return 1
    finally:
        generator.close()


if __name__ == "__main__":
    exit(main())
