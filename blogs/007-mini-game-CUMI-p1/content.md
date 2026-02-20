# Building a Daily Color Mixing Game: A Technical Deep Dive

## Introduction

Welcome to a case study of **CUMI (Can You Mix It?)**, a web-based color mixing game where players attempt to match target colors by mixing from a limited palette. Check out the game at:

[CUMI](/cumi)


In this post, I'll walk through the technical decisions and implementations that brought this game to life—from color science fundamentals to modern web APIs.

In this part 1 discussion - The core challenge: **How do you build a game that accurately measures color perception?**

---

## Chapter 1: Understanding Color—Real World vs Digital

### The Problem with RGB

Most developers are familiar with the RGB (Red, Green, Blue) color model. It's intuitive: combine three light channels and you get any color on a screen. However, RGB was designed for *how screens display colors*, not for *how humans perceive them*.

Consider two colors:
- **Color A**: RGB(255, 0, 0) - Pure red
- **Color B**: RGB(255, 1, 1) - Nearly pure red, slightly warmer

In RGB space, these colors are only **1 unit apart** out of 255 (0.4% difference). To the human eye, however, they're virtually indistinguishable.

Now consider:
- **Color C**: RGB(100, 0, 0) - Dark red
- **Color D**: RGB(100, 50, 50) - Light brownish red

These are also about the same RGB distance, but they look *dramatically* different to humans because they differ significantly in brightness and saturation.

This disconnect between digital representation and human perception is the root issue we needed to solve.

### Introducing CIELAB: Perceptual Color Space

The solution exists in the **CIELAB color space**, a color model designed explicitly to match human color perception. Developed by the International Commission on Illumination (CIE), CIELAB has three dimensions:

- **L*** (Lightness): Ranges from 0 (black) to 100 (white), matching human brightness perception
- **a*** (Color opponent): Ranges from green (-) to red (+)
- **b*** (Color opponent): Ranges from blue (-) to yellow (+)

The genius of CIELAB is that distances between colors in this space correspond approximately to how different those colors *look* to human eyes.

### Converting RGB to CIELAB

The conversion involves two steps:

1. **RGB → Linear RGB**: Account for gamma correction (how screens intensify color values)
2. **Linear RGB → XYZ**: Convert to the CIE XYZ intermediate space using standardized color matrices
3. **XYZ → CIELAB**: Apply the LAB transformation with reference white point adjustments

Here's how we implemented it in our utility:

```typescript
export function rgb2lab(rgb: RGB): LAB {
  // Step 1: Normalize RGB to 0-1 range and remove gamma correction
  let r = rgb.r / 255;
  let g = rgb.g / 255;
  let b = rgb.b / 255;

  r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
  g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
  b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

  // Step 2: Convert to XYZ using standard color matrices
  let x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
  let y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
  let z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

  // Step 3: Convert XYZ to LAB
  x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
  y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
  z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

  return {
    l: (116 * y) - 16,
    a: 500 * (x - y),
    b: 200 * (y - z),
  }
}
```

The reverse conversion (LAB → RGB) uses similar logic with inverse transformations.

---

## Chapter 2: Quantifying Color Match—The Perceptual Distance Metric

### Initial Attempts: Naive Euclidean Distance

When we first tried measuring color similarity, we calculated the straight-line distance between two colors in LAB space and mapped it to a percentage:

```
similarity = max(0, min(100, 100 - distance))
```

This seemed reasonable in theory. But testing revealed a problem: colors that *looked* nearly identical were scoring as low as 70-80% matches, while colors with subtle differences were scoring 95%+. Our visual perception wasn't matching the math.

### The CIE94 Delta E Formula

The solution came from the **CIE94 color difference formula**, a weighted distance calculation that accounts for how human perception varies across different regions of color space:

```typescript
export function deltaE(labA: LAB, labB: LAB) {
  const deltaL = labA.l - labB.l;
  const deltaA = labA.a - labB.a;
  const deltaB = labA.b - labB.b;
  
  // Chroma (saturation) components in CIELAB space
  const c1 = Math.sqrt(labA.a * labA.a + labA.b * labA.b);
  const c2 = Math.sqrt(labB.a * labB.a + labB.b * labB.b);
  const deltaC = c1 - c2;
  
  // Compute the hue component
  let deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
  deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
  
  // Apply weighting factors (humans are less sensitive to lightness than color)
  const sc = 1.0 + 0.045 * c1;
  const sh = 1.0 + 0.015 * c1;
  
  // Normalize differences
  const deltaLKlsl = deltaL / (1.0);
  const deltaCkcsc = deltaC / (sc);
  const deltaHkhsh = deltaH / (sh);
  
  // Combine into single metric
  const i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
  return i < 0 ? 0 : Math.sqrt(i);
}
```

The key insight: The formula applies **different weight** to lightness, chroma (saturation), and hue differences because humans don't perceive changes equally across these dimensions.

### Mapping Delta E to Percentage

The Delta E value now needs to be converted to a user-friendly 0-100% similarity score. We use an exponential decay function:

```typescript
export function perceptualSimilarity(deltaE: number): number {
  const similarity = 100 * Math.exp(-deltaE / 20);
  return Math.max(0, Math.min(100, similarity));
}
```

The constant `20` is tuned to create the right feel: 
- deltaE ≈ 0 → ~100% similarity
- deltaE ≈ 10 → ~61% similarity  
- deltaE ≈ 20 → ~37% similarity
- deltaE > 40 → approaching 0%

This exponential mapping means the game is harder than it looks—the last few percentage points are genuinely challenging!

### Putting It Together

```typescript
export function compareSimilarity(left: RGB, right: RGB) {
  const leftLAB = rgb2lab(left)
  const rightLAB = rgb2lab(right)
  const delta = deltaE(leftLAB, rightLAB)
  return perceptualSimilarity(delta)
}
```

The result: A similarity metric that actually matches human color perception. When a color reads as 99% similar on screen, it genuinely looks nearly identical in real life.

---

## Chapter 3: Mixing Colors—Current Approach and Future Challenges

### Simple RGB Averaging

Our current implementation uses the simplest possible mixing algorithm: average the RGB values of selected colors.

```typescript
export function mixColors(rgbs: RGB[]): RGB {
  if (!rgbs || rgbs.length === 0) {
    throw new Error(`Empty colors`);
  }

  let totalR = 0;
  let totalG = 0;
  let totalB = 0;

  for (const rgb of rgbs) {
    totalR += rgb.r;
    totalG += rgb.g;
    totalB += rgb.b;
  }

  const averageR = totalR / rgbs.length;
  const averageG = totalG / rgbs.length;
  const averageB = totalB / rgbs.length;

  return {
    r: Math.min(255, Math.round(averageR)),
    g: Math.min(255, Math.round(averageG)),
    b: Math.min(255, Math.round(averageB)),
  };
}
```

### Available Palettes

We provide two palette options:

**Standard RGB + Black/White:**
- Red (255, 0, 0)
- Green (0, 255, 0)
- Blue (0, 0, 255)
- Black (0, 0, 0)
- White (255, 255, 255)

**Cyan, Yellow, Magenta + Black/White:**
- Cyan (0, 255, 255)
- Yellow (255, 255, 0)
- Magenta (255, 0, 255)
- Black (0, 0, 0)
- White (255, 255, 255)

### Known Limitation: Strong Color Mixing

The RGB averaging approach has a significant weakness: **mixing strong colors like black and white**.

Example:
- Mix: [Black (0,0,0), White (255,255,255)]
- RGB Average Result: (127.5, 127.5, 127.5) → Medium Gray
- Problem: You can't actually achieve true black or pure white through averaging; they desaturate into gray.

In the real world, mixing black paint with white paint gives gray. But digitally, if you wanted to:
- Darken a red → Mix with black, but you get grayish-red instead of deep red
- Lighten a color → Mix with white, but you get pastel washed-out versions

### Future Enhancement Ideas

For a future version, consider implementing:

1. **HSL/HSV Mixing**: Blend by hue, saturation, and lightness separately for more intuitive results
2. **Subtractive Color Mixing**: Simulate actual paint mixing (CMY model behaves more like real-world paint)
3. **Perceptual Mixing in LAB Space**: Average colors in LAB space instead of RGB to get more natural results
4. **Weighted Mixing**: Allow players to use different amounts of each color (e.g., 2 parts red, 1 part white)
