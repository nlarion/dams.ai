# Advertisement Detection Image Generator

A synthetic image generation pipeline for creating realistic advertisement vs non-advertisement training data using Google's Imagen API.

## Overview

This pipeline generates balanced datasets of website screenshots showing either advertisements or legitimate content. It's designed to create diverse training datasets for CNN models that detect advertisements by analyzing images.

## Features

- **Balanced Dataset Generation**: Automatically generates 50/50 split of ad vs non-ad images
- **Parameter Variation**: Randomizes 10+ parameters including ad types, industries, visual styles, and more
- **Rate Limiting**: Built-in delays and retry logic to handle API rate limits
- **Crash Recovery**: Saves metadata after each image for resumability
- **Progress Tracking**: Live progress bars and detailed logging
- **Reproducible**: Optional random seed for deterministic generation

## Setup

### 1. Get Your API Key

1. Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Create a new API key
4. Copy the API key

### 2. Configure Environment

Create a `.env` file in the `imageGen` directory:

```bash
cp .env.example .env
```

Edit `.env` and add your API key:

```
GOOGLE_API_KEY=your_actual_api_key_here
```

### 3. Install Dependencies

From the `dams.ai` root directory:

```bash
pip install -r requirements.txt
```

## Usage

### Basic Usage

Generate 10 images (5 ads, 5 non-ads):

```bash
cd imageGen
python3 main.py
```

### Common Use Cases

**Generate 100 images for testing:**
```bash
python3 main.py --num-images 100
```

**Generate 1000 images with 3-second delay (slower, safer for rate limits):**
```bash
python3 main.py --num-images 1000 --delay 3
```

**Generate images with reproducible results:**
```bash
python3 main.py --num-images 50 --seed 42
```

**Generate only ad images (unbalanced):**
```bash
python3 main.py --num-images 100 --unbalanced
```

**Custom output directory:**
```bash
python3 main.py --num-images 100 --output-dir ./training_data
```

### Command-Line Options

```
--num-images    Number of images to generate (default: 10)
--output-dir    Output directory path (default: output)
--delay         Seconds between API calls (default: 2)
--seed          Random seed for reproducibility (optional)
--unbalanced    Generate only ad images (default: balanced 50/50)
```

## Output Structure

```
output/
├── ads/                  # Advertisement images
│   ├── ad_00001.png
│   ├── ad_00002.png
│   └── ...
├── non_ads/             # Non-advertisement images
│   ├── non_ad_00001.png
│   ├── non_ad_00002.png
│   └── ...
└── metadata.json        # Complete metadata for all generated images
```

## Metadata Format

The `metadata.json` file tracks all generated images:

```json
{
  "images": [
    {
      "filename": "ad_00001.png",
      "filepath": "output/ads/ad_00001.png",
      "label": "ad",
      "parameters": {
        "ad_type": "banner advertisement",
        "ad_industry": "e-commerce retail",
        "ad_visual_style": "bright and colorful with gradient backgrounds",
        "ad_cta_button": "Shop Now",
        "ad_promo_text": "50% OFF",
        ...
      },
      "prompt": "A realistic screenshot of a banner advertisement...",
      "timestamp": "2025-01-15T10:30:00.123456",
      "image_size": "1024x1024"
    }
  ],
  "generation_stats": {
    "total_generated": 100,
    "ads_count": 50,
    "non_ads_count": 50,
    "failed_count": 2,
    "started_at": "2025-01-15T10:00:00",
    "last_updated": "2025-01-15T11:30:00"
  }
}
```

## Testing Individual Components

### Test Prompt Generator

```bash
python3 prompt_generator.py
```

This will display example prompts for both ads and non-ads.

### Test Image Generator

Create a `.env` file first, then:

```bash
python3 image_generator.py
```

This will generate a single test image to verify API connectivity.

## Parameter Variations

The pipeline randomizes these parameters for each image:

**Advertisement Images:**
- **Ad Types**: banner, sidebar, popup, native, video thumbnail, sponsored post
- **Industries**: e-commerce, travel, finance, gaming, tech, health, fashion, etc.
- **Visual Styles**: bright/colorful, minimalist, bold/flashy, professional, playful
- **CTA Buttons**: "Shop Now", "Buy Now", "Learn More", "Sign Up Free", etc.
- **Promo Text**: "50% OFF", "Limited Time", "Free Shipping", etc.
- **Placements**: top banner, sidebar, in-feed, footer, modal

**Non-Advertisement Images:**
- **Content Types**: article body, navigation, comments, author bio, footer
- **UI Elements**: buttons, forms, menus, search bars, checkboxes
- **Media Types**: editorial photos, infographics, video players, icons
- **Page Sections**: hero, features, testimonials, pricing, contact

**Common Parameters:**
- **Color Schemes**: blue/white, red/white, gradient, monochrome, etc.
- **Layout Styles**: centered, full-width, card-based, grid, stacked
- **Device Context**: desktop, mobile, tablet
- **Theme**: light mode, dark mode

## Cost Considerations

- Google Imagen charges per image generated
- Check current pricing at [Google AI Pricing](https://ai.google.dev/pricing)
- Start small (10-100 images) to estimate costs
- Use `--delay 2` or higher to avoid rate limit errors

## Recommended Workflow

1. **Initial Test** (10 images): Verify everything works
   ```bash
   python3 main.py --num-images 10
   ```

2. **Quality Check** (100 images): Review variation and realism
   ```bash
   python3 main.py --num-images 100
   ```

3. **Model Testing** (1000 images): Train initial model
   ```bash
   python3 main.py --num-images 1000 --delay 3
   ```

4. **Full Dataset** (5k-10k images): Production dataset
   ```bash
   python3 main.py --num-images 5000 --delay 2
   ```

## Logs

All operations are logged to:
- Console (stdout)
- `generation.log` file

Check the log file for detailed error messages and API responses.

## Interruption Handling

If generation is interrupted (Ctrl+C or crash):
- Progress is automatically saved to `metadata.json`
- Simply run the command again
- The script will continue from where it left off (filenames increment automatically)

## Troubleshooting

**API Key Error:**
```
GOOGLE_API_KEY not found in .env file
```
→ Ensure `.env` file exists in `imageGen/` directory with valid API key

**Import Errors:**
```
ModuleNotFoundError: No module named 'google.generativeai'
```
→ Install dependencies: `pip install -r ../requirements.txt`

**Rate Limit Errors:**
```
Error on attempt 1: Rate limit exceeded
```
→ Increase delay: `--delay 5`

**Image Generation Fails:**
→ Check `generation.log` for detailed error messages
→ Verify API key has proper permissions
→ Check your Google Cloud quota/billing

## Next Steps

After generating images:

1. **Validate Quality**: Manually review sample images from both classes
2. **Check Balance**: Verify equal distribution of ad/non-ad images
3. **Analyze Variation**: Ensure good diversity in parameters
4. **Train Model**: Use images with a CNN model (see `../training/`)
5. **Iterate**: Adjust parameters in `config.py` if needed

## Configuration

To customize generation parameters, edit `config.py`:

- **PARAMETERS**: Define new parameter variations
- **AD_TEMPLATE**: Modify advertisement prompt template
- **NON_AD_TEMPLATE**: Modify non-ad content prompt template
- **IMAGE_RESOLUTION**: Change output image size (default: 1024)
- **DEFAULT_DELAY**: Change default API delay (default: 2 seconds)

## License

This project is licensed under the Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0).

See [../LICENSE.md](../LICENSE.md) for full license text.
