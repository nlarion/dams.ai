#!/usr/bin/env python3
"""
Convert ad detection datasets to training corpus format.

This script reads all dataset JSON files from the dataset/ folder and converts them
to the corpus format expected by the NLP classification notebook.

Input format (from deepfabric):
{
  "html": "<div class='ad-banner'>...</div>",
  "is_ad": true,
  "ad_type": "banner",
  "domain": "e-commerce",
  "confidence": 0.95
}

Output format (for training):
[
  {"text": "html content here", "label": "ads"},
  {"text": "html content here", "label": "not ads"}
]
"""

import json
import sys
from pathlib import Path


def convert_dataset_to_corpus(dataset_files, output_file="sample_corpus.json"):
    """
    Convert ad detection dataset files to training corpus format.

    Args:
        dataset_files: List of paths to dataset JSON files
        output_file: Path to save the output corpus file
    """
    corpus = []
    total_samples = 0
    ads_count = 0
    non_ads_count = 0

    print("=" * 70)
    print("Converting Ad Detection Datasets to Training Corpus")
    print("=" * 70)

    for dataset_file in dataset_files:
        print(f"\nProcessing: {dataset_file.name}")

        try:
            with open(dataset_file, 'r') as f:
                dataset = json.load(f)

            # Each dataset file is a list of samples
            if not isinstance(dataset, list):
                print(f"  Warning: {dataset_file.name} is not a list, skipping")
                continue

            file_samples = 0

            for item in dataset:
                # Convert format
                corpus_item = {
                    "text": item.get("html", ""),
                    "label": "ads" if item.get("is_ad", False) else "not ads"
                }

                corpus.append(corpus_item)
                file_samples += 1

                if item.get("is_ad", False):
                    ads_count += 1
                else:
                    non_ads_count += 1

            print(f"  Loaded {file_samples} samples")
            total_samples += file_samples

        except json.JSONDecodeError as e:
            print(f"  Error parsing {dataset_file.name}: {e}")
        except Exception as e:
            print(f"  Error processing {dataset_file.name}: {e}")

    # Save corpus
    print(f"\n" + "=" * 70)
    print(f"Total samples: {total_samples}")
    print(f"  - Ads: {ads_count}")
    print(f"  - Not ads: {non_ads_count}")
    print(f"  - Balance: {ads_count/total_samples*100:.1f}% ads" if total_samples > 0 else "")
    print("=" * 70)

    if total_samples == 0:
        print("\nNo samples found. Please generate datasets first using generate_ad_dataset.py")
        return False

    # Save to output file
    with open(output_file, 'w') as f:
        json.dump(corpus, f, indent=2)

    print(f"\n✅ Corpus saved to: {output_file}")
    print(f"   Ready for use in NLP training notebook!\n")

    return True


def main():
    """Main execution function."""
    # Get dataset directory
    dataset_dir = Path("dataset")

    if not dataset_dir.exists():
        print(f"Error: Dataset directory '{dataset_dir}' not found")
        print("Please run generate_ad_dataset.py first to create datasets")
        sys.exit(1)

    # Find all dataset JSON files
    dataset_files = list(dataset_dir.glob("dataset_*.json"))

    if not dataset_files:
        print(f"No dataset files found in {dataset_dir}")
        print("Please run generate_ad_dataset.py first to create datasets")
        sys.exit(1)

    print(f"Found {len(dataset_files)} dataset file(s):")
    for f in sorted(dataset_files):
        print(f"  - {f.name}")

    # Convert datasets
    output_file = "sample_corpus.json"
    success = convert_dataset_to_corpus(dataset_files, output_file)

    if not success:
        sys.exit(1)


if __name__ == "__main__":
    main()
