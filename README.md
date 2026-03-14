# W A L L F L O W E R – a film print emulation script for Photoshop

Wallflower is a Photoshop script that simulates the look of RA-4 printed and darkroom-scanned photos. It applies a pipeline of effects — preflash, softening, halation, grain and adaptive desaturation — all tunable through a simple recipe.

---

## Installation

1. Copy `wallflower.jsx` into Photoshop's Scripts folder:
   - **macOS:** `/Applications/Adobe Photoshop <version>/Presets/Scripts`
   - **Windows:** `C:\Program Files\Adobe\Adobe Photoshop <version>\Presets\Scripts`
2. Restart Photoshop. **Wallflower** now appears under **File → Automate**.
3. Load the included `.atn` action files via the Actions palette menu → **Load Actions** to get a set of ready-made recipes.

---

## Running the script

Open an RGB image, then choose **File → Automate → Wallflower**. A dialog opens with the following controls:

- **Recipe field** — paste your recipe string here (see [Recipe format](#recipe-format) below).
- **Auto-adjust Preflash** — when checked, the script analyses the image histogram and scales the preflash strength up or down depending on how dark the image is. Brighter images get more preflash; darker images get less. Your recipe's preflash opacity is used as the starting point.
- **Save original blackpoint** — when checked, the script measures where the darkest significant pixels sit in the histogram before processing, then bakes a correction into the preflash compensation curve so the image returns to that same black point after the preflash is applied. Uncheck this if you intentionally want the preflash to lift the blacks, or if you find it produces unexpected results on very dark images.
- **Reduce Preflash Saturation** — when checked, the script applies an adaptive masked desaturation that absorbs some of the color cast introduced by the preflash. The number field next to it (1–100%) controls how strongly this is applied.
- **Save and Close When Done** — when checked, the file is saved and closed after processing. Leave this unchecked while experimenting.

Click **Use this recipe** to run. Click **Use default settings** to run with the script's built-in defaults instead of a recipe.

---

## Recipe format

A recipe is a short string of five numbers separated by semicolons, in the following order:

1. **R**: The red channel of the preflash color. Accepts values from `0` to `255`.
2. **G**: The green channel of the preflash color. Accepts values from `0` to `255`.
3. **B**: The blue channel of the preflash color. Accepts values from `0` to `255`.
4. **PreflashOpacity**: How strong the preflash is, in percent. Accepts values from `0` to `100`. Set to `0` to disable preflash entirely.
5. **BlurRadius**: Size of the blur used for softening and halation. Accepts values from `0` to `100`. Set to `0` to disable softening.

Spaces around semicolons are ignored and a trailing semicolon is fine.

**Example:** `255; 105; 40; 10; 3`
Warm orange preflash at 10% opacity with a slight softening blur.

If the recipe string is invalid a dialog will tell you and the script will abort without touching the image.

---

## What the script does, step by step

### Preflash
A wash of colored light is laid over the image using the preflash color and opacity from the recipe, the same way a real darkroom preflash fogs the paper with light before the main exposure.

After painting the preflash, the script applies a compensation curve to pull tones back toward where they were, but in a tonally-aware way: shadows and the black point are corrected more strongly; midtones are corrected gently; highlights are barely touched. This keeps blacks black and prevents a washed-out look, while letting the preflash color cast remain.

If **Auto-adjust Preflash** is on, the preflash strength is scaled by the image histogram before this step.

### Micro contrast reduction
A very slightly blurred version of the image is subtly laid over the original. This smooths harsh micro contrast and gives a more printed, analogue feel without affecting color.

### Softening
A high-pass based softening is applied using the blur radius from the recipe. The blur is localised to mid-tone areas so edges soften without losing structure.

### Halation
A blurred glow bleeds outward from the brightest areas of the image, simulating the way light halates around highlights on film. The halation spread is twice the blur radius from the recipe, and only affects the brightest tones.

### Grain
Film-like grain is worked into the image, weighted towards darker areas.

### Desaturation (optional)
When **Reduce Preflash Saturation** is checked, the script applies an adaptive masked desaturation to compensate for increased saturation resulting from the added preflash effect. The strength is determined by:

1. The colorfulness and strength of the preflash — a more vivid or stronger preflash produces more desaturation.
2. How much of the image the mask covers — a sparse mask (contrasty images) gets a slight boost.
3. The **%** value you enter — this scales the whole computed result. At 100% the full computed desaturation is applied; at 20% it is one-fifth of that.

---

## Advanced tuning (edit the script directly)

These settings are near the top of `wallflower.jsx`, above the `DO NOT EDIT BELOW THIS LINE` marker. Editing them changes the defaults shown in the dialog and used when no recipe is entered.

### Preflash defaults

- **Preflash color (R, G, B)** — default preflash color. Default: `255, 105, 40` (warm orange).
- **Preflash opacity** — default preflash strength. Default: `10`.
- **Auto-adjust on/off** — whether auto-adjust is checked by default. Default: on.

### Blur default

- **Blur radius** — default blur radius. Default: `3`. Scales automatically with image size at runtime.

### Desaturation defaults

- **Desaturation on/off** — whether the desaturation checkbox is checked by default. Default: on.
- **Desaturation percent** — default value for the % field in the dialog. Default: `20`.
- **Desaturation boost (0.0–1.0)** — how much extra desaturation to apply when the mask covers only a small area of the image. Raise this if contrasty images consistently show weaker desaturation than expected. Default: `0.5`.

### Preflash compensation curve

These control how the compensation curve behaves after painting the preflash. They only have any effect when the preflash opacity is greater than 0.

- **Maximum overall damp (0.0–1.0)** — ceiling for how strongly tones are pulled down. Raise if compensation feels too weak; lower if images go too dark overall. Default: `0.6`.
- **Maximum black-point pull (0–255)** — how far the black point is additionally pushed down. The correction fades out before midtones so it does not affect overall contrast much. Default: `40`.
- **Midtone protection (0.0–1.0)** — blends midtones between full correction and a gentler curve. `1.0` means midtones barely change; `0.0` means midtones get the same treatment as shadows. Default: `0.7`.
- **Minimum tone multiplier (0.0–1.0)** — floor on how far any tone can be darkened. Prevents total tonal crush. Default: `0.35`.
- **Black point recovery (0–255)** — a small bottom range of input values remapped to pure black after the preflash, to restore a true black point. Scales with preflash strength. A value of `12` means that at full preflash strength the bottom 12 levels are forced to 0. Default: `12`.

### Blackpoint detection sensitivity

These control the histogram analysis used by the **Save original blackpoint** feature.

- **Blackpoint threshold (0.0–1.0)** — the cumulative fraction of pixels that must be counted before a histogram bin is considered the black point. Lower values make detection more sensitive to very sparse dark areas; higher values ignore thin dark tails. Default: `0.002` (0.2%).
- **Blackpoint tolerance (0–255)** — minimum difference in bins between the initial black point and the simulated post-curve black point before any correction is applied. This prevents the correction from running on images where the curve barely shifted the blacks. Default: `2`.

### Auto-adjust sensitivity

- **Shadow threshold (0–255)** — how dark a pixel must be to count as shadow when the histogram is analysed. Lower values count fewer pixels as shadows so the auto-adjust will generally apply more preflash. Default: `64`.

---

## Using with Photoshop actions

All dialog settings are saved in the recorded action step: the recipe, auto-adjust state, save-blackpoint on/off, desaturation on/off and the desaturation percent.

- When replayed silently, all stored values are used as-is.
- When the action step is set to show its dialog, it opens pre-filled with the stored values, ready to edit.

To update a stored action's settings: expand the action in the Actions palette, double-click the **Wallflower** step, change what you need and click **Use this recipe**.

---

## Tips and common issues

- **Image looks washed out after preflash** — lower the preflash opacity in the recipe, or increase the maximum black-point pull in the advanced settings.
- **Blacks don't look deep enough** — raise the black point recovery value, or increase the maximum overall damp.
- **Softening is too strong or too weak** — adjust the blur radius in the recipe. Set it to `0` to skip softening entirely.
- **Halation is too strong** — halation blur is twice the blur radius, so reducing the blur radius also reduces halation.
- **Desaturation has no visible effect** — make sure the checkbox is checked and the % value is above a few percent. Very neutral-colored preflash (near-white or near-grey RGB) will produce naturally low computed desaturation regardless of the % value.
- **Script errors on open** — make sure the image is in RGB color mode. 32-bit images are not supported. The script handles 8-bit internally and promotes to 16-bit while processing.
- **Running on a batch or droplet saves files unexpectedly** — the script only saves automatically if Save and Close is enabled in the stored action step. Open the action step dialog and uncheck it.

---

## License

Wallflower © 2025–2026 by Joakim Hertze. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
