#!/usr/bin/env python3
"""
Script to generate ad detection dataset using deepfabric and custom formatter.

This script:
1. Runs deepfabric to generate conversational data
2. Applies the custom AdDetectionFormatter to extract structured data
3. Saves the final dataset in the required format
"""

import json
import sys
import subprocess
import time
import yaml
import argparse
import re
from pathlib import Path

# Add current directory to path to import custom formatter
sys.path.insert(0, str(Path(__file__).parent))

from ad_detection_formatter import AdDetectionFormatter


def create_temp_config(original_config: str, raw_output: str, domain: str = "general",
                       samples: int = 9, temperature: float = 0.8,
                       tree_depth: int = 2, tree_degree: int = 3, ad_ratio: float = 0.5) -> str:
    """
    Create a temporary config file with the timestamped output filename and domain settings.

    Args:
        original_config: Path to the original YAML configuration file
        raw_output: The timestamped output filename
        domain: The domain type (e.g., e-commerce, news, gaming)
        samples: Target number of samples to generate
        temperature: Temperature for generation variety
        tree_depth: Topic tree depth
        tree_degree: Topic tree branching factor
        ad_ratio: Ratio of ads to non-ads (0.0-1.0)

    Returns:
        Path to the temporary configuration file
    """
    # Load the original config as text to preserve formatting and do string replacement
    with open(original_config, 'r') as f:
        config_text = f.read()

    # Replace placeholders with actual values
    config_text = config_text.replace('{DOMAIN}', domain)

    # Now parse as YAML to update the save_as field
    config = yaml.safe_load(config_text)

    # Update domain in config
    config['domain'] = domain

    # Calculate topic tree paths: ~(degree^depth)
    max_paths = tree_degree ** tree_depth

    # Calculate optimal num_steps and batch_size
    # We want to maximize samples while respecting path limits
    batch_size = min(10, max(3, samples // 10))  # Batch size between 3-10
    num_steps = min(samples // batch_size, max_paths)

    # Ensure we don't exceed path limits
    if num_steps * batch_size > max_paths:
        # Adjust batch_size to fit within paths
        batch_size = max(1, max_paths // max(1, num_steps))
        num_steps = max_paths // batch_size

    # Ensure at least 1 step
    if num_steps < 1:
        num_steps = 1
        batch_size = min(samples, max_paths)

    actual_samples = num_steps * batch_size

    # Calculate expected ad vs non-ad distribution
    ad_percentage = int(ad_ratio * 100)
    non_ad_percentage = 100 - ad_percentage

    print(f"\nGeneration parameters:")
    print(f"  Topic tree: depth={tree_depth}, degree={tree_degree} (~{max_paths} paths)")
    print(f"  Samples: {num_steps} steps × {batch_size} batch = {actual_samples} samples")
    print(f"  Temperature: {temperature} (variety)")
    print(f"  Ad ratio: {ad_percentage}% ads, {non_ad_percentage}% non-ads")

    # Warn if tree is too small for requested samples
    if actual_samples < samples:
        print(f"\n⚠️  Warning: Tree size limits samples to {actual_samples} (requested {samples})")
        print(f"   To generate {samples} samples, increase tree size:")
        # Calculate required depth/degree
        import math
        min_depth_needed = math.ceil(math.log(samples, tree_degree)) if tree_degree > 1 else samples
        print(f"   Example: --tree-depth {min_depth_needed} --tree-degree {tree_degree}")
        print(f"   Or: --tree-depth {tree_depth} --tree-degree {math.ceil(samples ** (1/tree_depth))}")

    # Update configuration
    config['topic_tree']['depth'] = tree_depth
    config['topic_tree']['degree'] = tree_degree
    config['topic_tree']['temperature'] = temperature
    config['data_engine']['temperature'] = temperature

    config['dataset']['creation']['num_steps'] = num_steps
    config['dataset']['creation']['batch_size'] = batch_size

    # Inject ad ratio into instructions
    ad_percentage = int(ad_ratio * 100)
    non_ad_percentage = 100 - ad_percentage

    # Add balance instruction to the data engine instructions
    balance_instruction = f"\n\n⚖️ BALANCE REQUIREMENT: Generate approximately {ad_percentage}% advertisement examples and {non_ad_percentage}% non-advertisement examples. Vary between ads and non-ads to maintain this ratio throughout generation.\n"

    if 'data_engine' in config and 'instructions' in config['data_engine']:
        config['data_engine']['instructions'] = balance_instruction + config['data_engine']['instructions']

    # Update the output filename
    if 'dataset' in config and 'save_as' in config['dataset']:
        config['dataset']['save_as'] = raw_output

    # Save to temporary config file
    temp_config = f"temp_config_{int(time.time())}.yaml"
    with open(temp_config, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    # Debug: verify config was saved correctly
    print(f"\n  Debug: Saved config to {temp_config}")
    print(f"  Debug: topic_tree.depth={config['topic_tree']['depth']}, degree={config['topic_tree']['degree']}")
    print(f"  Debug: dataset.creation.num_steps={config['dataset']['creation']['num_steps']}, batch_size={config['dataset']['creation']['batch_size']}")

    return temp_config


def run_deepfabric(config_file: str, raw_output: str, domain: str = "general",
                   samples: int = 9, temperature: float = 0.8,
                   tree_depth: int = 2, tree_degree: int = 3, ad_ratio: float = 0.5):
    """
    Run deepfabric with the given configuration file.

    Args:
        config_file: Path to the YAML configuration file
        raw_output: Output filename for the raw dataset
        domain: The domain type for generation
        samples: Target number of samples to generate
        temperature: Temperature for generation variety
        tree_depth: Topic tree depth
        tree_degree: Topic tree branching factor
        ad_ratio: Ratio of ads to non-ads
    """
    # Create temporary config with updated output filename and domain
    temp_config = create_temp_config(config_file, raw_output, domain, samples,
                                     temperature, tree_depth, tree_degree, ad_ratio)

    print(f"Running deepfabric with config: {temp_config}")
    print(f"Output will be saved to: {raw_output}")

    try:
        # Run deepfabric generate command
        result = subprocess.run(
            ["deepfabric", "generate", temp_config],
            capture_output=True,
            text=True,
            check=True
        )
        print("Deepfabric generation complete!")
        print(result.stdout)

    except subprocess.CalledProcessError as e:
        print(f"Error running deepfabric: {e}")
        print(f"\nStdout: {e.stdout}")
        print(f"\nStderr: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("deepfabric not found. Please install it first:")
        print("pip install deepfabric")
        sys.exit(1)
    finally:
        # Clean up temporary config file (keep on error for debugging)
        if 'e' not in locals():  # Only clean up on success
            try:
                Path(temp_config).unlink()
                print(f"Cleaned up temporary config: {temp_config}")
            except:
                pass
        else:
            print(f"Keeping temp config for debugging: {temp_config}")


def extract_html_content(text: str) -> str:
    """Extract HTML content from markdown code blocks."""
    html_match = re.search(r'```html\s*(.*?)\s*```', text, re.DOTALL | re.IGNORECASE)
    if html_match:
        return html_match.group(1).strip()
    return None


def extract_classification(text: str) -> tuple:
    """
    Extract classification information from text.

    Returns:
        tuple: (is_ad, ad_type, confidence)
    """
    is_ad = False
    ad_type = None
    confidence = 0.95  # Default confidence

    # Extract is_ad
    is_ad_match = re.search(r'is_ad:\s*(true|false)', text, re.IGNORECASE)
    if is_ad_match:
        is_ad = is_ad_match.group(1).lower() == 'true'

    # Extract ad_type
    ad_type_match = re.search(r'Ad Type:\s*(\w+(?:-\w+)*)', text, re.IGNORECASE)
    if ad_type_match:
        ad_type = ad_type_match.group(1).lower()

    return is_ad, ad_type, confidence


def format_dataset(input_file: str, output_file: str, domain: str = "general"):
    """
    Apply custom formatter to convert conversational data to structured HTML format.

    Args:
        input_file: Path to raw JSONL file from deepfabric
        output_file: Path to save formatted JSON file
        domain: The domain type
    """
    print(f"Formatting dataset from {input_file} to {output_file}")
    print(f"Domain: {domain}")

    # Load raw data
    raw_samples = []
    try:
        with open(input_file, 'r') as f:
            for line in f:
                if line.strip():
                    raw_samples.append(json.loads(line))
    except FileNotFoundError:
        print(f"Input file {input_file} not found")
        return False
    except json.JSONDecodeError as e:
        print(f"Error parsing JSON: {e}")
        return False

    print(f"Loaded {len(raw_samples)} raw samples")

    # Format samples based on format type
    formatted_samples = []
    skipped = 0

    for i, sample in enumerate(raw_samples):
        try:
            # Get the response text from the assistant
            response_text = ""
            if 'messages' in sample:
                for msg in sample['messages']:
                    if msg.get('role') == 'assistant':
                        response_text = msg.get('content', '')
                        break

            if not response_text:
                skipped += 1
                print(f"Skipped sample {i}: No assistant response found")
                continue

            # Extract classification info
            is_ad, ad_type, confidence = extract_classification(response_text)

            # Extract HTML content
            html_content = extract_html_content(response_text)
            if html_content:
                formatted = {
                    "html": html_content,
                    "is_ad": is_ad,
                    "ad_type": ad_type,
                    "domain": domain,
                    "confidence": confidence
                }
                formatted_samples.append(formatted)
            else:
                skipped += 1
                print(f"Skipped sample {i}: Could not extract HTML content")

        except Exception as e:
            skipped += 1
            print(f"Error formatting sample {i}: {e}")

    print(f"Successfully formatted {len(formatted_samples)} samples")
    print(f"Skipped {skipped} samples")

    # Save formatted data
    try:
        with open(output_file, 'w') as f:
            json.dump(formatted_samples, f, indent=2)
        print(f"Saved formatted dataset to {output_file}")
        return True
    except Exception as e:
        print(f"Error saving output file: {e}")
        return False


def main():
    """Main execution function."""
    # Set up argument parser
    parser = argparse.ArgumentParser(
        description='Generate HTML ad detection dataset with domain-specific options',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Generate 9 HTML ads for e-commerce domain (default)
  python generate_ad_dataset.py --domain e-commerce

  # Generate 100 balanced samples (50% ads, 50% non-ads)
  python generate_ad_dataset.py --domain gaming --samples 100 --temperature 1.0

  # Generate 1000 samples with maximum variety and 70% ads
  python generate_ad_dataset.py --domain news --samples 1000 --temperature 1.2 \\
    --tree-depth 4 --tree-degree 5 --ad-ratio 0.7

  # Generate balanced dataset with default settings (50/50)
  python generate_ad_dataset.py --domain e-commerce --samples 200

  # Generate dataset with 30% ads, 70% non-ads
  python generate_ad_dataset.py --domain finance --samples 500 --ad-ratio 0.3

Supported domains:
  general, e-commerce, news, social-media, gaming, finance, travel,
  healthcare, education, entertainment, sports, automotive, real-estate,
  food-delivery, fashion, beauty-cosmetics, home-furnishing, electronics,
  job-search, dating, fitness-wellness, pet-supplies, insurance, streaming,
  software-apps, telecommunications, pharma-medication, toys-hobbies,
  legal-services, event-ticketing

Tips for variety:
  - Increase --temperature (0.8-1.5) for more diverse outputs
  - Increase --tree-depth and --tree-degree for more topic variety
  - Tree paths = degree^depth (e.g., depth=4, degree=5 = 625 paths)
        """
    )
    parser.add_argument(
        '--domain',
        type=str,
        default='general',
        choices=['general', 'e-commerce', 'news', 'social-media', 'gaming',
                 'finance', 'travel', 'healthcare', 'education', 'entertainment', 'sports',
                 'automotive', 'real-estate', 'food-delivery', 'fashion', 'beauty-cosmetics',
                 'home-furnishing', 'electronics', 'job-search', 'dating', 'fitness-wellness',
                 'pet-supplies', 'insurance', 'streaming', 'software-apps', 'telecommunications',
                 'pharma-medication', 'toys-hobbies', 'legal-services', 'event-ticketing'],
        help='Domain type for ad generation (default: general)'
    )
    parser.add_argument(
        '--config',
        type=str,
        default='python-tutorial.yaml',
        help='Path to YAML configuration file (default: python-tutorial.yaml)'
    )
    parser.add_argument(
        '--samples',
        type=int,
        default=9,
        help='Target number of samples to generate (default: 9)'
    )
    parser.add_argument(
        '--temperature',
        type=float,
        default=0.8,
        help='Temperature for generation variety (0.0-2.0, default: 0.8, higher=more variety)'
    )
    parser.add_argument(
        '--tree-depth',
        type=int,
        default=2,
        help='Topic tree depth (default: 2, increase for more variety)'
    )
    parser.add_argument(
        '--tree-degree',
        type=int,
        default=3,
        help='Topic tree degree/branching (default: 3, increase for more variety)'
    )
    parser.add_argument(
        '--ad-ratio',
        type=float,
        default=0.5,
        help='Ratio of ads to non-ads (0.0-1.0, default: 0.5 for balanced). 0.5 = 50%% ads, 50%% non-ads'
    )

    args = parser.parse_args()

    config_file = args.config
    domain = args.domain
    samples = args.samples
    temperature = args.temperature
    tree_depth = args.tree_depth
    tree_degree = args.tree_degree
    ad_ratio = args.ad_ratio

    print("=" * 70)
    print(f"HTML Ad Detection Dataset Generator")
    print(f"Domain: {domain}")
    print(f"Target samples: {samples}")
    print(f"Temperature: {temperature}")
    print(f"Ad ratio: {int(ad_ratio*100)}% ads, {int((1-ad_ratio)*100)}% non-ads")
    print("=" * 70)

    # Show existing datasets
    existing_datasets = list(Path('.').glob('dataset/dataset_*.json'))
    if existing_datasets:
        print("\nExisting datasets:")
        for dataset in sorted(existing_datasets):
            # Skip raw files
            if '_raw' not in dataset.name:
                size = dataset.stat().st_size / 1024  # Size in KB
                print(f"  - {dataset.name} ({size:.1f} KB)")
        print()

    # Generate timestamp-based filenames with domain info
    timestamp = int(time.time())
    raw_output = f"debug/dataset_{domain}_{timestamp}_raw.jsonl"
    final_output = f"dataset/dataset_{domain}_{timestamp}.json"

    # Step 1: Generate raw data with deepfabric
    print("\n" + "=" * 70)
    print("Step 1: Generating raw data with deepfabric")
    print(f"Timestamp: {timestamp}")
    print("=" * 70)
    run_deepfabric(config_file, raw_output, domain, samples, temperature, tree_depth, tree_degree, ad_ratio)

    # Step 2: Format the data
    print("\n" + "=" * 70)
    print("Step 2: Formatting data to structured HTML format")
    print("=" * 70)
    success = format_dataset(raw_output, final_output, domain)

    if success:
        print("\n" + "=" * 70)
        print("✅ Dataset generation complete!")
        print(f"Final dataset saved to: {final_output}")

        # Show sample of the output
        with open(final_output, 'r') as f:
            data = json.load(f)
            if data:
                print(f"\nDataset contains {len(data)} samples")
                print(f"Domain: {domain}")
                print(f"Format: HTML")
                print("\nSample entry:")
                print(json.dumps(data[0], indent=2))
        print("=" * 70)
    else:
        print("\n❌ Dataset formatting failed")
        sys.exit(1)


if __name__ == "__main__":
    main()