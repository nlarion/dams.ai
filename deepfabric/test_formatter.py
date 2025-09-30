#!/usr/bin/env python3
"""Test the formatter with specific samples from the raw dataset."""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from ad_detection_formatter import AdDetectionFormatter

def test_specific_samples(raw_file: str):
    """Test formatter on specific problematic samples."""

    # Load raw samples
    samples = []
    with open(raw_file, 'r') as f:
        for line in f:
            if line.strip():
                samples.append(json.loads(line))

    # Initialize formatter
    formatter = AdDetectionFormatter()

    # Test samples 3 and 4 (indices 3 and 4)
    for idx in [3, 4]:
        if idx < len(samples):
            print(f"\n{'='*50}")
            print(f"Testing Sample {idx}:")
            print(f"{'='*50}")

            sample = samples[idx]

            # Show assistant messages
            assistant_msgs = []
            for msg in sample['messages']:
                if msg['role'] == 'assistant':
                    assistant_msgs.append(msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content'])

            print(f"Assistant messages found: {len(assistant_msgs)}")
            for i, msg in enumerate(assistant_msgs, 1):
                print(f"  Message {i}: {msg}")

            # Try to format
            result = formatter._format_single_sample(sample)

            if result:
                print(f"\n✅ Successfully formatted!")
                print(json.dumps(result, indent=2))
            else:
                print(f"\n❌ Failed to format")

if __name__ == "__main__":
    # Find the most recent raw dataset
    raw_files = sorted(Path('.').glob('dataset_*_raw.jsonl'))
    if raw_files:
        latest_raw = raw_files[-1]
        print(f"Testing with: {latest_raw}")
        test_specific_samples(str(latest_raw))
    else:
        print("No raw dataset files found")