"""
Prompt generator for advertisement detection image generation.
Builds prompts from templates with randomized parameter variations.
"""

import random
from typing import Dict, Tuple, Optional, List
from config import PARAMETERS, AD_TEMPLATE, NON_AD_TEMPLATE, INDUSTRY_WEIGHTS


class PromptGenerator:
    """Generates prompts with randomized parameters for image generation."""

    def __init__(self, seed: int = None, use_weights: bool = True):
        """
        Initialize the prompt generator.

        Args:
            seed: Optional random seed for reproducibility
            use_weights: Whether to use weighted sampling for industries
        """
        if seed is not None:
            random.seed(seed)
        self.use_weights = use_weights

    def _weighted_choice(self, items: List[str], weights_dict: Dict[str, float]) -> str:
        """
        Select an item using weighted sampling.

        Args:
            items: List of items to choose from
            weights_dict: Dictionary mapping items to their weights

        Returns:
            Selected item
        """
        weights = [weights_dict.get(item, 1.0) for item in items]
        return random.choices(items, weights=weights, k=1)[0]

    def generate_random_parameters(
        self,
        is_ad: bool = True,
        industry_override: Optional[str] = None
    ) -> Dict[str, str]:
        """
        Generate a random set of parameters for an image.

        Args:
            is_ad: Whether this is for an advertisement image
            industry_override: Optional specific industry to use (for ads only)

        Returns:
            Dictionary of parameters with randomly selected values
        """
        params = {}

        if is_ad:
            # Ad-specific parameters
            params['ad_type'] = random.choice(PARAMETERS['ad_type'])

            # Handle industry selection with optional override and weighting
            if industry_override:
                params['ad_industry'] = industry_override
            elif self.use_weights:
                params['ad_industry'] = self._weighted_choice(
                    PARAMETERS['ad_industry'],
                    INDUSTRY_WEIGHTS
                )
            else:
                params['ad_industry'] = random.choice(PARAMETERS['ad_industry'])

            params['ad_visual_style'] = random.choice(PARAMETERS['ad_visual_style'])
            params['ad_focus'] = random.choice(PARAMETERS['ad_focus'])
            params['ad_cta_button'] = random.choice(PARAMETERS['ad_cta_button'])
            params['ad_promo_text'] = random.choice(PARAMETERS['ad_promo_text'])
            params['ad_placement_context'] = random.choice(PARAMETERS['ad_placement_context'])
        else:
            # Non-ad content parameters
            params['content_type'] = random.choice(PARAMETERS['content_type'])

        # Common parameters for both
        params['color_scheme'] = random.choice(PARAMETERS['color_scheme'])
        params['layout_style'] = random.choice(PARAMETERS['layout_style'])
        params['device_context'] = random.choice(PARAMETERS['device_context'])
        params['theme_mode'] = random.choice(PARAMETERS['theme_mode'])

        return params

    def build_prompt(self, parameters: Dict[str, str], is_ad: bool = True) -> str:
        """
        Build a complete prompt from parameters.

        Args:
            parameters: Dictionary of parameter values
            is_ad: Whether this is for an advertisement image

        Returns:
            Formatted prompt string
        """
        template = AD_TEMPLATE if is_ad else NON_AD_TEMPLATE
        return template.format(**parameters)

    def generate_prompt(
        self,
        is_ad: bool = True,
        industry_override: Optional[str] = None
    ) -> Tuple[str, Dict[str, str]]:
        """
        Generate a complete prompt with random parameters.

        Args:
            is_ad: Whether this is for an advertisement image
            industry_override: Optional specific industry to use (for ads only)

        Returns:
            Tuple of (prompt_string, parameters_dict)
        """
        parameters = self.generate_random_parameters(is_ad, industry_override)
        prompt = self.build_prompt(parameters, is_ad)
        return prompt, parameters


def main():
    """Test the prompt generator."""
    generator = PromptGenerator()

    print("=" * 80)
    print("ADVERTISEMENT IMAGE PROMPT EXAMPLE")
    print("=" * 80)
    prompt, params = generator.generate_prompt(is_ad=True)
    print(f"\nParameters:")
    for key, value in params.items():
        print(f"  {key}: {value}")
    print(f"\nPrompt:\n{prompt}\n")

    print("=" * 80)
    print("NON-ADVERTISEMENT CONTENT PROMPT EXAMPLE")
    print("=" * 80)
    prompt, params = generator.generate_prompt(is_ad=False)
    print(f"\nParameters:")
    for key, value in params.items():
        print(f"  {key}: {value}")
    print(f"\nPrompt:\n{prompt}\n")


if __name__ == "__main__":
    main()
