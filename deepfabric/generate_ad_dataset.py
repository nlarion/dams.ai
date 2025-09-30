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
from pathlib import Path

# Add current directory to path to import custom formatter
sys.path.insert(0, str(Path(__file__).parent))

from ad_detection_formatter import AdDetectionFormatter


def create_temp_config(original_config: str, raw_output: str) -> str:
    """
    Create a temporary config file with the timestamped output filename.

    Args:
        original_config: Path to the original YAML configuration file
        raw_output: The timestamped output filename

    Returns:
        Path to the temporary configuration file
    """
    # Load the original config
    with open(original_config, 'r') as f:
        config = yaml.safe_load(f)

    # Update the output filename
    if 'dataset' in config and 'save_as' in config['dataset']:
        config['dataset']['save_as'] = raw_output

    # Save to temporary config file
    temp_config = f"temp_config_{int(time.time())}.yaml"
    with open(temp_config, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)

    return temp_config


def run_deepfabric(config_file: str, raw_output: str):
    """
    Run deepfabric with the given configuration file.

    Args:
        config_file: Path to the YAML configuration file
        raw_output: Output filename for the raw dataset
    """
    # Create temporary config with updated output filename
    temp_config = create_temp_config(config_file, raw_output)

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
        print(f"Stderr: {e.stderr}")
        sys.exit(1)
    except FileNotFoundError:
        print("deepfabric not found. Please install it first:")
        print("pip install deepfabric")
        sys.exit(1)
    finally:
        # Clean up temporary config file
        try:
            Path(temp_config).unlink()
            print(f"Cleaned up temporary config: {temp_config}")
        except:
            pass


def format_dataset(input_file: str, output_file: str):
    """
    Apply custom formatter to convert conversational data to structured format.

    Args:
        input_file: Path to raw JSONL file from deepfabric
        output_file: Path to save formatted JSON file
    """
    print(f"Formatting dataset from {input_file} to {output_file}")

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

    # Initialize formatter
    formatter = AdDetectionFormatter()

    # Format samples
    formatted_samples = []
    skipped = 0

    for i, sample in enumerate(raw_samples):
        try:
            formatted = formatter._format_single_sample(sample)
            if formatted:
                formatted_samples.append(formatted)
            else:
                skipped += 1
                print(f"Skipped sample {i}: Could not extract required data")
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
    config_file = "python-tutorial.yaml"

    # Show existing datasets
    existing_datasets = list(Path('.').glob('dataset_*.json'))
    if existing_datasets:
        print("Existing datasets:")
        for dataset in sorted(existing_datasets):
            # Skip raw files
            if '_raw' not in dataset.name:
                size = dataset.stat().st_size / 1024  # Size in KB
                print(f"  - {dataset.name} ({size:.1f} KB)")
        print()

    # Generate timestamp-based filenames
    timestamp = int(time.time())
    raw_output = f"debug/dataset_{timestamp}_raw.jsonl"
    final_output = f"dataset/dataset_{timestamp}.json"

    # Step 1: Generate raw data with deepfabric
    print("=" * 50)
    print("Step 1: Generating raw data with deepfabric")
    print(f"Timestamp: {timestamp}")
    print("=" * 50)
    run_deepfabric(config_file, raw_output)

    # Step 2: Format the data
    print("\n" + "=" * 50)
    print("Step 2: Formatting data to structured format")
    print("=" * 50)
    success = format_dataset(raw_output, final_output)

    if success:
        print("\n" + "=" * 50)
        print("✅ Dataset generation complete!")
        print(f"Final dataset saved to: {final_output}")

        # Show sample of the output
        with open(final_output, 'r') as f:
            data = json.load(f)
            if data:
                print(f"\nDataset contains {len(data)} samples")
                print("\nSample entry:")
                print(json.dumps(data[0], indent=2))
    else:
        print("\n❌ Dataset formatting failed")
        sys.exit(1)


if __name__ == "__main__":
    main()