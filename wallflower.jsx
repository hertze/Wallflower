// W A L L F L O W E R
//
// Version 2 beta
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Default settings ------------------------------------------------------------

var pre_flash_r = 182;
var pre_flash_g = 96;
var pre_flash_b = 44;
var pre_flash_strength = 20;
var blur_radius = 3;
var auto_adjust_preflash = true;
var preserve_whitepoint = false;
var whitepoint_restore_strength = 20; // 1–100: percentage to restore the original white point
var preserve_blackpoint = true;
var blackpoint_restore_strength = 70; // 1–100: percentage to restore the original black point
var desaturation = false;

var lightness_channel_name = "Lightness"; // name of the lightness channel in Lab mode

var desat_boost = 0.5; // how strongly to boost desaturation when mask coverage is small (0..1)
var desaturation_amount_setting = 20; // user-editable amount (1..100) used as divisor

var microSmooth_strength = 50; // opacity percentage for the micro-smoothing layer (0..100)

var preflash_auto_samples = 5; // grid samples per axis (5x5)
var preflash_shadow_threshold = 64; // luminance threshold considered 'shadow'

var highlight_mask_gamma = 1.0; // gamma to bias highlight mask when building (lower = more midtone coverage)
var whole_mask_gamma = 1.0; // gamma to bias whole mask when building (lower = more midtone coverage)
var paper_response_mask_gamma = 0.65; // stronger toe weighting for print-response smoothing
var paper_response_mask_range_end = 192; // extend into lower mids but keep upper mids/highlights cleaner

// Preflash tuning
// - `preflash_damp_max` (0..1): overall exposure/contrast damping applied
//   by the preflash. Think of this as global "fill" applied before tonal
//   shaping — higher values increase the amount of darkening applied to
//   shadows and midtones. Use lower values to preserve overall contrast.
// - `preflash_blackcomp_max` (0..255): extra black-point pull applied near
//   the toe of the mapping. This controls shadow compression/crush —
//   increase to deepen blacks, reduce to keep shadow detail.
// - `preflash_mid_blend` (0..1): blends the aggressive compensation result
//   with a gentler damped mapping for midtones. Values closer to 1
//   preserve midtone separation; values near 0 favor stronger shadow
//   correction.
// - `preflash_min_factor` (0..1): hard floor for the tone multiplier so the
//   darkest tones never collapse to absolute black. Acts as a safety net
//   when using aggressive preflash strengths.
//
// Note: black/white "restore" after compensation now uses a Levels-based
// mapping (not additional curve anchors). See the restoration settings
// below for detection and strength controls.
var preflash_damp_max = 0.6;
var preflash_blackcomp_max = 40;
var preflash_mid_blend = 0.7;
var preflash_min_factor = 0.35;
var preflash_lift_max = 52; // max Lightness lift in upper tones at strength=100
var preflash_black_lift_max = 40; // max blackpoint lift at strength=100
var preflash_comp_midtone_max = 26; // max midtone pullback after lift
var preflash_comp_highlight_max = 38; // max highlight pullback after lift

// Black / white point detection and restoration (how to think in photo terms)
// - `blackpoint_threshold_fraction`: fraction of image pixels used to decide
//   where the true black point sits. Use a small value (e.g. 0.003) to find
//   the darkest "real" pixels and ignore isolated noise or clipping. Increase
//   this for very noisy or textured shadows so the detector ignores tiny
//   specks.
// - `blackpoint_tolerance`: minimum histogram-bin difference (in L bins)
//   required before we attempt to restore the black point. Prevents tiny
//   measurement noise from triggering a restore. ~2 is a good default.
// - `blackpoint_restore_strength` (1–100): percentage to restore blacks back
//   toward their original position after compensation. Lower values give
//   softer corrections with fewer midtone side-effects.
// - `whitepoint_threshold_fraction`: similar to black threshold but scans
//   from the top of the histogram. Keep it tight (small) so specular highlights
//   don't dominate the measurement; it helps recover highlight roll-off rather
//   than specular clipping.
// - `whitepoint_tolerance`: minimum bin gap to require before restoring
//   highlights. Prevents unnecessary tiny shifts.
// - `whitepoint_restore_strength` (1–100): percentage to restore whites back
//   toward their original position. Lower values give subtler highlight
//   recovery.
var blackpoint_threshold_fraction = 0.003;  // fraction of pixels to consider 'significant' (5%)
var blackpoint_tolerance = 2; // bins; only remap when initial black is at least this brighter than post-curve
var whitepoint_threshold_fraction = 0.003; // tight (0.1%) - finds the actual top-end occupied bin, not clipped specular
var whitepoint_tolerance = 2; // bins; only remap when post-curve white is at least this brighter than original

var save = false;
		

// ---------------------------------------------------------------------


// DO NOT EDIT BELOW THIS LINE -----------------------------------------

/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource>
<name>Wallflower</name>
<menu>automate</menu>
<enableinfo>true</enableinfo>
<eventid>f3c2a1d9-8b7e-4c1f-9238-52e9d7f8b5b4</eventid>
<terminology><![CDATA[<< /Version 1
	/Events <<
	/f3c2a1d9-8b7e-4c1f-9238-52e9d7f8b5b4 [(Wallflower) <<
	/recipe [(Recipe) /string]
	/savestatus [(Save) /boolean]
	/autoadjust [(AutoAdjust) /boolean]
	/savewhitepoint [(SaveWhitePoint) /boolean]
	/saveblackpoint [(SaveBlackPoint) /boolean]
	/desaturation [(Desaturation) /boolean]
	/desatamount [(DesatAmount) /integer]
	/blackrestoreamt [(BlackRestoreAmt) /integer]
	/whiterestoreamt [(WhiteRestoreAmt) /integer]
		>>]
			>>
	>> ]]></terminology>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/

function coerceBoolean(value, fallback) {
	if (value === undefined || value === null) return (fallback === true);
	if (typeof value === "boolean") return value;
	if (typeof value === "string") return (value.toLowerCase() === "true");
	if (typeof value === "number") return (value !== 0);
	return (fallback === true);
}


function displayDialog(thisRecipe, saveStatus, autoAdjust, saveBlackParam, saveWhiteParam, desatParam, desatAmountParam, blackRestoreParam, whiteRestoreParam, runmode) {
	// Display dialog box.
	var dialog = new Window("dialog");
	dialog.text = "Wallflower";
	dialog.orientation = "column";
	dialog.alignChildren = ["left", "top"];
	dialog.spacing = 10;
	dialog.margins = 20;

	dialog.statictext1 = dialog.add("statictext", undefined, undefined, { name: "label" });
	if (runmode != "edit") {
		dialog.statictext1.text = "Paste your recipe here:";
	} else {
		dialog.statictext1.text = "Edit your recipe here:";
	}
	dialog.statictext1.alignment = ["fill", "top"];

	dialog.edittext1 = dialog.add("edittext", undefined, undefined, { multiline: true });
	dialog.edittext1.alignment = ["fill", "top"];
	dialog.edittext1.size = [500, 50];
	dialog.edittext1.text = thisRecipe ? thisRecipe : '';
	
	// Auto-adjust preflash checkbox
	dialog.autoadjust = dialog.add("checkbox", undefined, "Auto-adjust Preflash");
	dialog.autoadjust.value = coerceBoolean(autoAdjust, auto_adjust_preflash);

	// Keep White Point checkbox + restore strength field
	var savewhiteGroup = dialog.add("group");
	savewhiteGroup.orientation = "row";
	savewhiteGroup.spacing = 2;
	dialog.savewhite = savewhiteGroup.add("checkbox", undefined, "Preserve White Point at");
	dialog.whiteRestoreAmount = savewhiteGroup.add("edittext", undefined, undefined, { name: "whiteRestoreAmount" });
	dialog.whiteRestoreAmount.characters = 4;
	try { dialog.whiteRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var whitePctLabel = savewhiteGroup.add("statictext", undefined, "%");
	try { whitePctLabel.margins = [0, 0, 0, 0]; } catch(e) {}
	dialog.savewhite.value = coerceBoolean(saveWhiteParam, preserve_whitepoint);
	if (whiteRestoreParam !== undefined) {
		dialog.whiteRestoreAmount.text = whiteRestoreParam.toString();
	} else {
		dialog.whiteRestoreAmount.text = whitepoint_restore_strength.toString();
	}

	// Save original blackpoint checkbox + restore strength field
	var saveblackGroup = dialog.add("group");
	saveblackGroup.orientation = "row";
	saveblackGroup.spacing = 2;
	dialog.saveblack = saveblackGroup.add("checkbox", undefined, "Preserve Black Point at");
	dialog.blackRestoreAmount = saveblackGroup.add("edittext", undefined, undefined, { name: "blackRestoreAmount" });
	dialog.blackRestoreAmount.characters = 4;
	try { dialog.blackRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var blackPctLabel = saveblackGroup.add("statictext", undefined, "%");
	try { blackPctLabel.margins = [0, 0, 0, 0]; } catch(e) {}
	dialog.saveblack.value = coerceBoolean(saveBlackParam, preserve_blackpoint);
	if (blackRestoreParam !== undefined) {
		dialog.blackRestoreAmount.text = blackRestoreParam.toString();
	} else {
		dialog.blackRestoreAmount.text = blackpoint_restore_strength.toString();
	}

	// Desaturation checkbox + amount (placed before Save checkbox)
	var desatGroup = dialog.add("group");
	desatGroup.orientation = "row";
	desatGroup.spacing = 2;
	dialog.desaturation = desatGroup.add("checkbox", undefined, "Reduce Preflash Saturation at");
	dialog.desatAmount = desatGroup.add("edittext", undefined, undefined, { name: "desatAmount" });
	dialog.desatAmount.characters = 4;
	// remove extra padding around the small numeric field
	try { dialog.desatAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var desatPctLabel = desatGroup.add("statictext", undefined, "%");
	try { desatPctLabel.margins = [0, 0, 0, 0]; } catch(e) {}

	dialog.desaturation.value = coerceBoolean(desatParam, desaturation);
	if (desatAmountParam !== undefined) {
		dialog.desatAmount.text = desatAmountParam;
	} else {
		dialog.desatAmount.text = desaturation_amount_setting.toString();
	}

	dialog.savestatus = dialog.add("checkbox", undefined, "Save and Close When Done");
	dialog.savestatus.value = coerceBoolean(saveStatus, save);

	var buttons = dialog.add( "group" );
	var submit = buttons.add("button", undefined, undefined, { name: "submit" });
	submit.text = "Use this recipe";
	
	submit.onClick = function () {
		thisRecipe = dialog.edittext1.text;
		saveStatus = dialog.savestatus.value;
		autoAdjust = dialog.autoadjust.value;
		desaturation = dialog.desaturation.value;
		preserve_whitepoint = dialog.savewhite.value;
		preserve_blackpoint = dialog.saveblack.value;
		var _ds = parseInt(dialog.desatAmount.text); if (!isNaN(_ds)) desaturation_amount_setting = _ds;
		var _bp = parseInt(dialog.blackRestoreAmount.text); if (!isNaN(_bp)) blackpoint_restore_strength = _bp;
		var _wp = parseInt(dialog.whiteRestoreAmount.text); if (!isNaN(_wp)) whitepoint_restore_strength = _wp;
		dialog.close();
	};
	
	if (runmode != "edit") {
		var without = buttons.add("button", undefined, undefined, { name: "without" });
		without.text = "Use default settings";
		
		without.onClick = function () {
			thisRecipe = "none";
			saveStatus = false;
			dialog.close();
		};
	}
	
	dialog.show();

	return {
		"recipe": thisRecipe,
		"savestatus": saveStatus,
		"autoadjust": autoAdjust,
		"savewhitepoint": preserve_whitepoint,
		"saveblackpoint": preserve_blackpoint,
		"desaturation": desaturation,
		"desatamount": desaturation_amount_setting,
		"blackrestoreamt": blackpoint_restore_strength,
		"whiterestoreamt": whitepoint_restore_strength
	};
}

function getRecipe() {
	// Retrieve recipe from action or dialog
	if (!app.playbackParameters.count) {
		//normal run (from scripts menu)

		var result = displayDialog();
		
		if (!result.recipe || result.recipe == '') { isCancelled = true; return } else {
			var d = new ActionDescriptor;
			d.putString(stringIDToTypeID('recipe'), result.recipe);
			d.putBoolean(stringIDToTypeID('savestatus'), coerceBoolean(result.savestatus, save));
				if (result.autoadjust !== undefined && result.autoadjust !== null) {
					d.putBoolean(stringIDToTypeID('autoadjust'), coerceBoolean(result.autoadjust, auto_adjust_preflash));
				}
				if (result.savewhitepoint !== undefined && result.savewhitepoint !== null) {
					d.putBoolean(stringIDToTypeID('savewhitepoint'), coerceBoolean(result.savewhitepoint, preserve_whitepoint));
				}
				if (result.saveblackpoint !== undefined && result.saveblackpoint !== null) {
					d.putBoolean(stringIDToTypeID('saveblackpoint'), coerceBoolean(result.saveblackpoint, preserve_blackpoint));
				}
				if (result.desaturation !== undefined && result.desaturation !== null) {
					d.putBoolean(stringIDToTypeID('desaturation'), coerceBoolean(result.desaturation, desaturation));
				}
				if (result.desatamount !== undefined && result.desatamount !== null) {
					d.putInteger(stringIDToTypeID('desatamount'), result.desatamount);
				}
				if (result.blackrestoreamt !== undefined && result.blackrestoreamt !== null) {
					d.putInteger(stringIDToTypeID('blackrestoreamt'), result.blackrestoreamt);
				}
				if (result.whiterestoreamt !== undefined && result.whiterestoreamt !== null) {
					d.putInteger(stringIDToTypeID('whiterestoreamt'), result.whiterestoreamt);
				}
			app.playbackParameters = d;        
			return result;
		}
	}
	else {
		var recipe = app.playbackParameters.getString(stringIDToTypeID('recipe'));
		var savestatus = null;
		var autoadjust = null;
		var saveblack = null;
		var savewhite = null;
		var desat = null;
		var desatamount = null;
		var blackrestoreamt = null;
		var whiterestoreamt = null;
		try { savestatus = app.playbackParameters.getBoolean(stringIDToTypeID('savestatus')); } catch(e) {
			try { savestatus = app.playbackParameters.getString(stringIDToTypeID('savestatus')); } catch(ee) { savestatus = undefined; }
		}
		try { autoadjust = app.playbackParameters.getBoolean(stringIDToTypeID('autoadjust')); } catch(e) {
			try { autoadjust = app.playbackParameters.getString(stringIDToTypeID('autoadjust')); } catch(ee) { autoadjust = undefined; }
		}
		try { saveblack = app.playbackParameters.getBoolean(stringIDToTypeID('saveblackpoint')); } catch(e) {
			try { saveblack = app.playbackParameters.getString(stringIDToTypeID('saveblackpoint')); } catch(ee) { saveblack = undefined; }
		}
		try { savewhite = app.playbackParameters.getBoolean(stringIDToTypeID('savewhitepoint')); } catch(e) {
			try { savewhite = app.playbackParameters.getString(stringIDToTypeID('savewhitepoint')); } catch(ee) { savewhite = undefined; }
		}
		try { desat = app.playbackParameters.getBoolean(stringIDToTypeID('desaturation')); } catch(e) {
			try { desat = app.playbackParameters.getString(stringIDToTypeID('desaturation')); } catch(ee) { desat = undefined; }
		}
		try { desatamount = app.playbackParameters.getInteger(stringIDToTypeID('desatamount')); } catch(e) { desatamount = undefined; }
		try { blackrestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('blackrestoreamt')); } catch(e) { blackrestoreamt = undefined; }
		try { whiterestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('whiterestoreamt')); } catch(e) { whiterestoreamt = undefined; }
		
		if (app.playbackDisplayDialogs == DialogModes.ALL) {
			// user run action in dialog mode (edit action step)
				var result = displayDialog(recipe, savestatus, autoadjust, saveblack, savewhite, desat, desatamount, blackrestoreamt, whiterestoreamt, "edit");
			if (!result.recipe || result.recipe == "") { isCancelled = true; return } else {
				var d = new ActionDescriptor;
				d.putString(stringIDToTypeID('recipe'), result.recipe);
				d.putBoolean(stringIDToTypeID('savestatus'), coerceBoolean(result.savestatus, save));
					d.putBoolean(stringIDToTypeID('autoadjust'), coerceBoolean(result.autoadjust, auto_adjust_preflash));
					d.putBoolean(stringIDToTypeID('savewhitepoint'), coerceBoolean(result.savewhitepoint, preserve_whitepoint));
					d.putBoolean(stringIDToTypeID('saveblackpoint'), coerceBoolean(result.saveblackpoint, preserve_blackpoint));
					d.putBoolean(stringIDToTypeID('desaturation'), coerceBoolean(result.desaturation, desaturation));
					d.putInteger(stringIDToTypeID('desatamount'), result.desatamount);
					d.putInteger(stringIDToTypeID('blackrestoreamt'), result.blackrestoreamt);
					d.putInteger(stringIDToTypeID('whiterestoreamt'), result.whiterestoreamt);
				app.playbackParameters = d;
			}
			executeScript = false;
			return result;
		}
		if (app.playbackDisplayDialogs != DialogModes.ALL) {
			// user run script without recording
			return {
				"recipe": recipe,
				"savestatus": savestatus,
				"autoadjust": autoadjust,
				"savewhitepoint": savewhite,
				"saveblackpoint": saveblack,
				"desaturation": desat,
			"desatamount": desatamount,
			"blackrestoreamt": blackrestoreamt,
			"whiterestoreamt": whiterestoreamt
			};
		}
	}
}

function processRecipe(runtimesettings) {
	// Process the recipe and change settings
	var thisRecipe = runtimesettings.recipe;
	var saveStatus = runtimesettings.savestatus;
	var autoAdjustSetting = runtimesettings.autoadjust;
	var desatSetting = runtimesettings.desaturation;
	save = coerceBoolean(saveStatus, false);
		// Apply preserve_whitepoint setting from dialog/playbackParameters if present
		if (runtimesettings.savewhitepoint !== undefined && runtimesettings.savewhitepoint !== null) {
			preserve_whitepoint = coerceBoolean(runtimesettings.savewhitepoint, preserve_whitepoint);
		}
		// Apply preserve_blackpoint setting from dialog/playbackParameters if present
		if (runtimesettings.saveblackpoint !== undefined && runtimesettings.saveblackpoint !== null) {
			preserve_blackpoint = coerceBoolean(runtimesettings.saveblackpoint, preserve_blackpoint);
		}
	thisRecipe = thisRecipe.replace(/\s+/g, ""); // Removes spaces
	thisRecipe = thisRecipe.replace(/;+$/, ""); // Removes trailing ;
	
	// Check recipe against syntax (R;G;B;strength)
	const regex = new RegExp('^(?:0|(?:[1-9][0-9]?)|(?:1[0-9][0-9])|(?:2[0-4][0-9])|(?:25[0-5]));(?:0|(?:[1-9][0-9]?)|(?:1[0-9][0-9])|(?:2[0-4][0-9])|(?:25[0-5]));(?:0|(?:[1-9][0-9]?)|(?:1[0-9][0-9])|(?:2[0-4][0-9])|(?:25[0-5]));(?:0|(?:[1-9][0-9]?)|100);(?:0|(?:[1-9][0-9]?)|100)$', 'm');

	if (regex.exec(thisRecipe) !== null) {
		thisRecipe = thisRecipe.split(";"); // Splits into array at ;
		pre_flash_r = parseInt(thisRecipe[0]);
		pre_flash_g = parseInt(thisRecipe[1]);
		pre_flash_b = parseInt(thisRecipe[2]);
		pre_flash_strength = parseInt(thisRecipe[3]);
		blur_radius = parseInt(thisRecipe[4]);
		// Apply autoadjust setting from dialog/playbackParameters if present
		if (autoAdjustSetting !== undefined && autoAdjustSetting !== null) {
			auto_adjust_preflash = coerceBoolean(autoAdjustSetting, auto_adjust_preflash);
		}
			// Apply desaturation setting from dialog/playbackParameters if present
			if (desatSetting !== undefined && desatSetting !== null) {
				desaturation = coerceBoolean(desatSetting, desaturation);
			}
			// Apply desaturation amount (percent) from dialog/playbackParameters if present
			if (runtimesettings.desatamount !== undefined && runtimesettings.desatamount !== null) {
				var _ds = parseInt(runtimesettings.desatamount); if (!isNaN(_ds)) desaturation_amount_setting = _ds;
			}
			// Apply restore strength percentages from dialog/playbackParameters if present
			if (runtimesettings.blackrestoreamt !== undefined && runtimesettings.blackrestoreamt !== null) {
					var _bp = parseInt(runtimesettings.blackrestoreamt); if (!isNaN(_bp)) blackpoint_restore_strength = _bp;
			}
			if (runtimesettings.whiterestoreamt !== undefined && runtimesettings.whiterestoreamt !== null) {
				var _wp = parseInt(runtimesettings.whiterestoreamt); if (!isNaN(_wp)) whitepoint_restore_strength = _wp;
			}
	} else {
		executeScript = false;
		alert("Sorry, but that recipe is faulty! Please check it's syntax and it's settings and then try again.");
	}
}

function saveClose() {
	var file_ending = doc.name.split('.').pop().toLowerCase();
	var fPath = doc.path;
	
	if (file_ending == "tif" || file_ending == "tiff") {
		// Save out the image as tiff
		var tiffFile = new File(fPath);
		tiffSaveOptions = new TiffSaveOptions();
		tiffSaveOptions.imageCompression = TIFFEncoding.NONE;
		tiffSaveOptions.layers = false;
		tiffSaveOptions.embedColorProfile = true;
		doc.saveAs(tiffFile, tiffSaveOptions, false, Extension.LOWERCASE);
	} else {
		// Save out the image as jpeg
		var jpgFile = new File(fPath);
		jpgSaveOptions = new JPEGSaveOptions();
		jpgSaveOptions.formatOptions = FormatOptions.OPTIMIZEDBASELINE;
		jpgSaveOptions.embedColorProfile = true;
		jpgSaveOptions.matte = MatteType.NONE;
		jpgSaveOptions.quality = 12;
		doc.saveAs(jpgFile, jpgSaveOptions, false, Extension.LOWERCASE);
	}
	doc.close(SaveOptions.DONOTSAVECHANGES);
}

// Top-level analyzer: estimate shadow pixel ratio by sampling a grid
function estimateShadowRatio(samplesPerAxis, threshold) {
// Use channel histograms to estimate the fraction of dark pixels.
// This avoids creating ColorSamplers (the color picker) which can be slow
// and intrusive. We approximate dark pixels as those with channel values
// below `threshold` across R/G/B by averaging per-channel cumulative counts.
	try {
		var d = app.activeDocument;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var rHist = d.channels[0].histogram;
		var gHist = d.channels[1].histogram;
		var bHist = d.channels[2].histogram;
		var t = Math.max(0, Math.min(255, Math.round(threshold)));
		var sumR = 0, sumG = 0, sumB = 0;
		for (var i = 0; i <= t; i++) {
			sumR += rHist[i] || 0;
			sumG += gHist[i] || 0;
			sumB += bHist[i] || 0;
		}
		var avgDark = (sumR + sumG + sumB) / 3.0;
		return totalPixels ? (avgDark / totalPixels) : 0;
	} catch (e) {
		return 0; // conservative fallback
	}
}

function autoAdjustPreflashStrength(origStrength) {
	var ratio = estimateShadowRatio(preflash_auto_samples, preflash_shadow_threshold);
	// Bias toward brighter images by using 0.4 as the neutral center
	var biasCenter = 0.3;
	var m = 1 + (1.5 * (biasCenter - ratio));
	var out = Math.round(origStrength * m);
	if (out < 0) out = 0;
	if (out > 100) out = 100;
	return out;
}

function microSmooth(channelName, blurradius, noiseAmount) {
	// Apply a Gaussian blur to the specified channel
	var channel = doc.channels.getByName(channelName);
	doc.activeChannels = [channel];
	doc.activeLayer.applyGaussianBlur(doc_scale * blurradius);
	// Add subtle noise to the channel
	if (noiseAmount > 0) {
		doc.activeLayer.applyAddNoise(noiseAmount, NoiseDistribution.GAUSSIAN, false);
	}
}

function createLuminanceMasks(rangeStart, rangeEnd, gamma, maskName, blurRadius) {

	// Work in RGB mode: create a temporary desaturated layer,
	// adjust its levels to isolate the luminance range, then
	// copy that result into a new alpha/channel.
	var originalActiveLayer = doc.activeLayer;
	var originalChannels = doc.activeChannels;
	var tempLayer = null;

	try {
		tempLayer = imagelayer.duplicate();
		tempLayer.name = maskName + " Temp";

		// Desaturate the duplicated layer to get luminance-like values
		tempLayer.desaturate();

		doc.activeLayer = tempLayer;

		// Apply levels to the layer to isolate the requested range
		// adjustLevels on a layer modifies its pixels (RGB) which is fine
		// Accept optional gamma (placed immediately after input range) to bias midtones when building masks
		gamma = (gamma !== undefined) ? Math.max(0.25, Math.min(4.0, gamma)) : 1.0;
		tempLayer.adjustLevels(rangeStart, rangeEnd, gamma, 0, 255);

		if (rangeStart < 128) {
			tempLayer.invert(); // Invert for shadow ranges to get mask
		}
		// Optionally blur the temporary mask before creating the channel
		if (blurRadius && blurRadius > 0) {
			tempLayer.applyGaussianBlur(blurRadius);
		}

		// Copy the temporary layer's pixels and paste into a new channel
		doc.selection.selectAll();
		doc.selection.copy();

		var newChannel = doc.channels.add();
		newChannel.name = maskName;
		doc.activeChannels = [newChannel];
		doc.paste();
		doc.selection.deselect();

		// Clean up temporary layer
		tempLayer.remove();
	} catch (e) {
		try { if (doc.selection) doc.selection.deselect(); } catch (ee) {}
		try { if (tempLayer) tempLayer.remove(); } catch (ee) {}
		throw e;
	} finally {
		try { doc.activeChannels = originalChannels; } catch (e) {}
		try { doc.activeLayer = originalActiveLayer; } catch (e) {}
	}

}

// Compute desaturation amount (percent) from preflash color and strength
function computeDesaturationAmount(r_in, g_in, b_in, strength) {
	// NOTE: this function now expects coverage to be applied by caller via multiplier.
	// Base desaturation: 1%..10% mapped from strength (0..100)
	var base_desat = Math.max(1, Math.min(10, Math.round(1 + (strength / 100) * 9)));

	// Clamp and normalize inputs
	var r = Math.max(0, Math.min(255, Math.round(r_in || 0)));
	var g = Math.max(0, Math.min(255, Math.round(g_in || 0)));
	var b = Math.max(0, Math.min(255, Math.round(b_in || 0)));
	var maxc = Math.max(r, g, b);
	var minc = Math.min(r, g, b);

	// Simple estimate of colorfulness: (max-min)/max -> 0..1
	var colorSat = (maxc > 0) ? ((maxc - minc) / maxc) : 0;

	// Extra desaturation contribution scaled by strength (max ~5%)
	var extra_scale = 5;
	var extra_desat = Math.round(colorSat * (strength / 100) * extra_scale);

	// Combine (coverage multiplier applied by caller). Return raw value here.
	return Math.max(1, Math.min(30, base_desat + extra_desat));
}

// Compute how much of the provided mask channel is 'on' (0..1 average brightness)
function computeMaskCoverage(channelName) {
	try {
		var d = app.activeDocument;
		var hist = d.channels.getByName(channelName).histogram;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var sum = 0;
		for (var i = 0; i < hist.length; i++) {
			sum += (hist[i] || 0) * i;
		}
		return totalPixels ? (sum / (255.0 * totalPixels)) : 0;
	} catch (e) {
		return 0;
	}
}

// Compute the first 'significant' black histogram bin (0..255) where
// cumulative pixel count exceeds `thresholdFraction` of the image.
// Works in both RGB mode (averages R/G/B channels) and Lab mode (uses L channel only).
function computeImageBlackPoint(thresholdFraction) {
	try {
		var d = app.activeDocument;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var threshold = Math.max(0, Math.min(1, (thresholdFraction !== undefined) ? thresholdFraction : blackpoint_threshold_fraction));
		var cumulative = 0;
		if (d.mode === DocumentMode.LAB) {
			// In Lab mode read the Lightness channel by name
			var lHist = d.channels.getByName(lightness_channel_name).histogram;
			for (var i = 0; i <= 255; i++) {
				cumulative += (lHist[i] || 0);
				if (totalPixels && (cumulative / totalPixels) >= threshold) return i;
			}
		} else {
			var rHist = d.channels[0].histogram;
			var gHist = d.channels[1].histogram;
			var bHist = d.channels[2].histogram;
			for (var i = 0; i <= 255; i++) {
				var avg = ((rHist[i] || 0) + (gHist[i] || 0) + (bHist[i] || 0)) / 3.0;
				cumulative += avg;
				if (totalPixels && (cumulative / totalPixels) >= threshold) return i;
			}
		}
		return 255;
	} catch (e) {
		return 255;
	}
}

// Compute the last 'significant' white histogram bin (0..255) scanning from the top.
// Use a tight thresholdFraction (e.g. 0.001) so specular-clipped bins don't dominate.
function computeImageWhitePoint(thresholdFraction) {
	try {
		var d = app.activeDocument;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var threshold = Math.max(0, Math.min(1, (thresholdFraction !== undefined) ? thresholdFraction : whitepoint_threshold_fraction));
		var cumulative = 0;
		if (d.mode === DocumentMode.LAB) {
			var lHist = d.channels.getByName(lightness_channel_name).histogram;
			for (var i = 255; i >= 0; i--) {
				cumulative += (lHist[i] || 0);
				if (totalPixels && (cumulative / totalPixels) >= threshold) return i;
			}
		} else {
			var rHist = d.channels[0].histogram;
			var gHist = d.channels[1].histogram;
			var bHist = d.channels[2].histogram;
			for (var i = 255; i >= 0; i--) {
				var avg = ((rHist[i] || 0) + (gHist[i] || 0) + (bHist[i] || 0)) / 3.0;
				cumulative += avg;
				if (totalPixels && (cumulative / totalPixels) >= threshold) return i;
			}
		}
		return 0;
	} catch (e) {
		return 0;
	}
}

// Apply desaturation using the Whole Mask: duplicates layer, desaturates, masks and merges
function applyDesaturation(pre_r, pre_g, pre_b, strength) {
	try {
		var coverage = computeMaskCoverage("Whole Mask");
		var raw_desat = computeDesaturationAmount(pre_r, pre_g, pre_b, strength);
		var multiplier = 1 + (1 - coverage) * desat_boost; // 1..1+desat_boost
		// Normalize computed desaturation into 0.0..1.0 (reduce divisor to strengthen effect)
		var normalized = Math.min(1.0, (raw_desat * multiplier) / 15.0);
		// Scale by user percent (1..100) so amount=100 can yield full 100% opacity
		var final_desat = Math.max(0, Math.min(100, Math.round(normalized * desaturation_amount_setting)));

		var desatLayer = imagelayer.duplicate();
		desatLayer.name = "Desaturation";
		desatLayer.blendMode = BlendMode.SATURATION;
		desatLayer.opacity = final_desat;
		desatLayer.desaturate();

		app.activeDocument.activeLayer = desatLayer;

		// Load the whole-mask into the selection, clear outside the mask
		doc.selection.load(doc.channels.getByName("Whole Mask"), SelectionType.REPLACE);
		doc.selection.invert();
		doc.selection.clear();
		doc.selection.deselect();

		desatLayer.merge();
	} catch (e) {
		// fail silently; desaturation is non-critical
	}
}

function softenImage(layer, radius) {
	var doc = app.activeDocument;
	var originalLayer = doc.activeLayer;
	var originalChannels = doc.activeChannels;

	var hpLayer = layer.duplicate();
	hpLayer.name = "High Pass";
	hpLayer.applyHighPass(radius * 2);
	hpLayer.invert();

	// Make the HP layer active and copy its pixels to the clipboard
	doc.activeLayer = hpLayer;

	var hpChannel = null;
	try {
		doc.selection.selectAll();
		doc.selection.copy();

		// Create a new channel and paste the clipboard into it
		hpChannel = doc.channels.add();
		hpChannel.name = "HP Channel";
		doc.activeChannels = [hpChannel];
		doc.paste();

		// Load the HP channel into the selection, switch back to the original layer
		doc.selection.load(hpChannel, SelectionType.REPLACE);
		doc.selection.contract(radius); // Expand the selection by 1 pixel to ensure we cover the edges
		doc.activeLayer = layer;

		// Apply blur to the original layer using the selection
		layer.applyGaussianBlur(radius);

	} catch (e) {
		// If anything fails, swallow the error to avoid leaving document in a bad state
	} finally {
		try { doc.selection.deselect(); } catch (e) {}
		try { if (hpChannel) hpChannel.remove(); } catch (e) {}
		try { if (hpLayer) hpLayer.remove(); } catch (e) {}
		try { doc.activeChannels = originalChannels; } catch (e) {}
		try { doc.activeLayer = originalLayer; } catch (e) {}
	}
}

function applyPreflash(initialBlackPoint, initialWhitePoint, wholeMaskCoverage, paperResponseCoverage) {
	preserve_blackpoint = (preserve_blackpoint === true || preserve_blackpoint === "true");
	preserve_whitepoint = (preserve_whitepoint === true || preserve_whitepoint === "true");

	if (auto_adjust_preflash) {
		pre_flash_strength = autoAdjustPreflashStrength(pre_flash_strength);
	}
	if (pre_flash_strength <= 0) {
		return;
	}

	doc.changeMode(ChangeMode.LAB);
	var savedChannels = doc.activeChannels;

	// Step 1: single paper-shaped Lightness curve in Lab (toe, straight-line, shoulder).
	var strengthNorm = pre_flash_strength / 100;
	function clamp01(v) { return Math.max(0, Math.min(1, v)); }
	function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
	function solveLevelsGamma(midIn, inBlack, inWhite, outBlack, outWhite) {
		var gamma = 1.0;
		if (inWhite > inBlack && outWhite > outBlack) {
			var t = (midIn - inBlack) / (inWhite - inBlack);
			var tprime = (midIn - outBlack) / (outWhite - outBlack);
			if (t > 0 && t < 1 && tprime > 0 && tprime < 1) {
				try {
					gamma = Math.log(t) / Math.log(tprime);
					if (!isFinite(gamma) || gamma <= 0) gamma = 1.0;
					gamma = Math.max(0.25, Math.min(4.0, gamma));
				} catch (e) { gamma = 1.0; }
			}
		}
		return gamma;
	}
	function computeToneParams() {
		// Chroma can increase perceived contrast, so add a mild Lightness lift compensation.
		var chromaScaleMax = 1.25;
		var highStrengthRoll = Math.pow(clamp01((strengthNorm - 0.82) / 0.18), 1.35);
		var topEndLimiter = 1 - 0.24 * highStrengthRoll;
		var chromaScale = chromaScaleMax * strengthNorm * topEndLimiter;
		var chromaNorm = chromaScale / chromaScaleMax;
		var chromaLumaComp = 1 + 0.28 * chromaNorm;
		// Unified exposure driver so higher strength/chroma visibly brightens the preflash result.
		var strengthLiftComp = 1 + 0.52 * Math.pow(strengthNorm, 1.12) * (0.7 + 0.3 * chromaNorm) * topEndLimiter;
		var chromaBlackLiftComp = 1 + chromaNorm;
		var chromaHighlightRollback = 13 * chromaNorm * (0.9 + 0.1 * paperResponseCoverage);

		var liftAmt = preflash_lift_max * strengthNorm * (0.9 + 0.25 * wholeMaskCoverage) * chromaLumaComp * strengthLiftComp;
		// Stronger toe response across the whole strength range.
		var blackLiftNorm = Math.pow(strengthNorm, 0.82);
		var blackLiftFactor = preserve_blackpoint ? (1 - (blackpoint_restore_strength / 100)) : 1;
		var blackLiftAmt = preflash_black_lift_max * blackLiftNorm * (0.85 + 0.15 * wholeMaskCoverage) * blackLiftFactor * chromaBlackLiftComp * strengthLiftComp;
		var compMid = preflash_comp_midtone_max * strengthNorm * (0.8 + 0.2 * wholeMaskCoverage) * (1 - 0.30 * chromaNorm) / strengthLiftComp;
		var whiteRestoreMix = preserve_whitepoint ? (1 - (whitepoint_restore_strength / 100)) : 1;
		// Keep stronger shoulder compression even when preserving whitepoint,
		// then let the restore pass recover the endpoint by the selected percentage.
		var whiteCompFactor = 1.22 * Math.max(0.35, whiteRestoreMix);
		var compHigh = preflash_comp_highlight_max * strengthNorm * (0.95 + 0.25 * paperResponseCoverage) * whiteCompFactor * (1 - 0.18 * chromaNorm) / strengthLiftComp;
		var crushNorm = clamp01((strengthNorm - 0.58) / 0.42);
		var crushAmt = (34 * crushNorm * crushNorm * (0.85 + 0.15 * paperResponseCoverage)) / (0.9 + 0.6 * strengthLiftComp);

		function paperTonePoint(v) {
			var t = v / 255.0;
			var toe = Math.pow(1 - t, 2.2);
			var mid = 4 * t * (1 - t);
			var shoulder = Math.pow(t, 2.4);
			var highlightProtect = 1 - 0.65 * shoulder;
			var midProtect = 1 - 0.32 * mid;
			var y = v;
			// Lift through the straight-line region, add matte toe lift,
			// then compress mids/highlights and high-strength toe.
			y += liftAmt * (0.10 + 0.72 * Math.pow(t, 1.05)) * highlightProtect * midProtect;
			y += blackLiftAmt * toe * 1.1;
			y -= compMid * mid * 1.14;
			y -= compHigh * shoulder * 1.34;
			y -= chromaHighlightRollback * shoulder * shoulder;
			y -= crushAmt * Math.pow(1 - t, 1.8) * 0.8;
			return clamp255(y);
		}

		var p0 = paperTonePoint(0);
		var p32 = paperTonePoint(32);
		var p64 = paperTonePoint(64);
		var p128 = paperTonePoint(128);
		var p160 = paperTonePoint(160);
		var p192 = paperTonePoint(192);
		var p224 = paperTonePoint(224);
		var p255 = paperTonePoint(255);

		// Keep anchors monotonic.
		p32 = Math.max(p0, p32);
		p64 = Math.max(p32, p64);
		p128 = Math.max(p64, p128);
		p160 = Math.max(p128, p160);
		p192 = Math.max(p160, p192);
		p224 = Math.max(p192, p224);
		p255 = Math.max(p224, p255);

		return {
			p128: p128,
			chromaScale: chromaScale,
			curvePoints: [
				[0, p0],
				[32, p32],
				[64, p64],
				[128, p128],
				[160, p160],
				[192, p192],
				[224, p224],
				[255, p255]
			]
		};
	}

	function applyLightness(curvePoints) {
		var lightnessLayer = imagelayer.duplicate();
		lightnessLayer.name = "Preflash Lightness";
		doc.activeLayer = lightnessLayer;
		doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];
		lightnessLayer.adjustCurves(curvePoints);
		doc.activeChannels = savedChannels;
		doc.selection.load(doc.channels.getByName("Whole Mask"));
		doc.selection.invert();
		doc.selection.clear();
		doc.selection.deselect();
		lightnessLayer.merge();
		imagelayer = doc.activeLayer;
	}

	function applyChroma(chromaScale) {
		var chromaLayer = imagelayer.duplicate();
		chromaLayer.name = "Preflash Chroma";
		doc.activeLayer = chromaLayer;

		// Strong, linear chroma ramp for predictable behavior.
		var targetA = preflashColor.lab.a;
		var targetB = preflashColor.lab.b;
		var deltaA = Math.round(targetA * chromaScale);
		var deltaB = Math.round(targetB * chromaScale);

		function shiftedCurve(delta) {
			// Paper-like chroma response: strongest in lower mids/mids,
			// reduced in deep shadows and especially near highlights.
			var d0 = Math.round(delta * 0.30);
			var d64 = Math.round(delta * (0.72 + 0.08 * paperResponseCoverage));
			var d128 = Math.round(delta * 1.00);
			var d192 = Math.round(delta * 0.58);
			var d255 = Math.round(delta * 0.20);
			return [
				[0, clamp255(0 + d0)],
				[64, clamp255(64 + d64)],
				[128, clamp255(128 + d128)],
				[192, clamp255(192 + d192)],
				[255, clamp255(255 + d255)]
			];
		}

		var originalLabChannels = doc.activeChannels;
		doc.selection.load(doc.channels.getByName("Whole Mask"), SelectionType.REPLACE);

		// Shift a channel
		doc.activeChannels = [doc.channels.getByName("a")];
		chromaLayer.adjustCurves(shiftedCurve(deltaA));

		// Shift b channel
		doc.activeChannels = [doc.channels.getByName("b")];
		chromaLayer.adjustCurves(shiftedCurve(deltaB));

		// Keep chroma change strictly inside Whole Mask by removing layer pixels outside the mask.
		doc.selection.invert();
		doc.activeChannels = originalLabChannels;
		doc.selection.clear();
		doc.activeChannels = originalLabChannels;
		doc.selection.deselect();
		chromaLayer.merge();
		imagelayer = doc.activeLayer;
	}

	var tone = computeToneParams();
	// Endpoint mapping is handled in a separate final curve pass below.
	applyLightness(tone.curvePoints);

	// Step 2: restore black and/or white point in a single curve pass.
	var needBlack = false, needWhite = false;
	var actualPostLevelBlack, bp, restoredBp;
	var actualPostLevelWhite, wp, restoredWp;

	doc.activeChannels = savedChannels;

		// Step 3: add chroma in Lab safely by shifting a/b channels (relative move from current values).
	// This avoids hue inversion from absolute fills and keeps tonal work isolated in Lightness.
	applyChroma(tone.chromaScale);

	if (preserve_blackpoint) {
		actualPostLevelBlack = Math.max(0, Math.min(255, Math.round(computeImageBlackPoint())));
		bp = Math.max(0, Math.min(255, Math.round(initialBlackPoint || 0)));
		if (actualPostLevelBlack > bp + blackpoint_tolerance) {
			restoredBp = Math.round(actualPostLevelBlack - (actualPostLevelBlack - bp) * (blackpoint_restore_strength / 100));
			needBlack = true;
		}
	}
	if (preserve_whitepoint) {
		actualPostLevelWhite = Math.max(0, Math.min(255, Math.round(computeImageWhitePoint(whitepoint_threshold_fraction))));
		wp = Math.max(0, Math.min(255, Math.round(initialWhitePoint || 255)));
		if (actualPostLevelWhite < wp - whitepoint_tolerance) {
			restoredWp = Math.round(actualPostLevelWhite + (wp - actualPostLevelWhite) * (whitepoint_restore_strength / 100));
			needWhite = true;
		}
	}

	if (needBlack || needWhite) {
		doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];

		// Use Levels instead of curves for robust black/white restoration
		// Levels parameters: inputShadow, inputGamma, inputHighlight, outputShadow, outputHighlight
		try {
			// Prepare Levels parameters depending on which endpoints we need to restore
			var inBlack = needBlack ? actualPostLevelBlack : 0;
			var inWhite = needWhite ? actualPostLevelWhite : 255;
			var outBlack = needBlack ? restoredBp : 0;
			var outWhite = needWhite ? restoredWp : 255;
			// Choose the mid input value to preserve: use post-compensation mid (p128)
			var gamma = solveLevelsGamma(tone.p128, inBlack, inWhite, outBlack, outWhite);
			// Apply a single Levels pass mapping the measured endpoints to the restored endpoints
			imagelayer.adjustLevels(inBlack, inWhite, gamma, outBlack, outWhite);
		} catch (e) {
			// fall back silently if adjustLevels is unsupported in this context
		}

		doc.activeChannels = savedChannels;
	}

	// Separate global endpoint Levels pass.
	// At strength=100 and preserve disabled: output black->14, output white->250.
	if (!preserve_blackpoint || !preserve_whitepoint) {
		var targetBlack = preserve_blackpoint ? 0 : clamp255(Math.round(14 * strengthNorm));
		var targetWhite = preserve_whitepoint ? 255 : clamp255(255 - Math.round(12 * strengthNorm));
		if (targetWhite <= targetBlack) targetWhite = Math.min(255, targetBlack + 1);
		doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];
		try {
			var endpointGamma = solveLevelsGamma(128, 0, 255, targetBlack, targetWhite);
			imagelayer.adjustLevels(0, 255, endpointGamma, targetBlack, targetWhite);
		} catch (e) {}
		doc.activeChannels = savedChannels;
	}

	// Convert back to RGB for the remaining pipeline stages.
	doc.changeMode(ChangeMode.RGB);

}


// Initial properties, settings and calculations

var doc = app.activeDocument;

app.preferences.rulerUnits = Units.PIXELS;
app.displayDialogs = DialogModes.NO;


// Sets up existing image layer
doc.activeLayer.isBackgroundLayer = false; // Unlocks background layer
var imagelayer = doc.activeLayer;
imagelayer.name = "original"; // Names background layer

// Calculate scale by dividing the shortest document side by 3600
var doc_scale = Math.min(doc.width, doc.height) / 3600;


//
// MAIN ROUTINE
//

var executeScript = true;
var isCancelled = false;
var runtimesettings = getRecipe();
if (runtimesettings.recipe != "none") { processRecipe(runtimesettings); }

// Colors
var preflashColor = new SolidColor();
preflashColor.rgb.red = pre_flash_r;
preflashColor.rgb.green = pre_flash_g;
preflashColor.rgb.blue = pre_flash_b;

var fogColor = new SolidColor();
fogColor.rgb.red = 253;
fogColor.rgb.green = 246;
fogColor.rgb.blue = 227;

var greyColor = new SolidColor();
greyColor.rgb.red = 128;
greyColor.rgb.green = 128;
greyColor.rgb.blue = 128;

try {	
	if (executeScript == true) {

		// Upgrade to 16-bit if needed
		if (BitsPerChannelType.SIXTEEN) {
			var was16Bit = true;
			doc.bitsPerChannel = BitsPerChannelType.SIXTEEN;
		}

		// Create luminance masks (pass scaled blur radius)
		// Pass an explicit gamma (third argument) for each mask to bias midtones when needed
		createLuminanceMasks(0, 255, whole_mask_gamma, "Whole Mask", doc_scale * blur_radius);
		createLuminanceMasks(0, paper_response_mask_range_end, paper_response_mask_gamma, "Paper Response Mask", doc_scale * blur_radius);
		createLuminanceMasks(192, 255, highlight_mask_gamma, "Highlight Mask", 0);
		var wholeMaskCoverage = computeMaskCoverage("Whole Mask");
		var paperResponseCoverage = computeMaskCoverage("Paper Response Mask");

		// Check initial black/white points in Lab before preflash modifies the image.
		var initialBlackPoint = 0;
		var initialWhitePoint = 255;
		try {
			doc.changeMode(ChangeMode.LAB);
			if (preserve_blackpoint) initialBlackPoint = computeImageBlackPoint();
			if (preserve_whitepoint) initialWhitePoint = computeImageWhitePoint(whitepoint_threshold_fraction);
			doc.changeMode(ChangeMode.RGB);
		} catch (e) { initialBlackPoint = 0; initialWhitePoint = 255; }

		// Preflash
		applyPreflash(initialBlackPoint, initialWhitePoint, wholeMaskCoverage, paperResponseCoverage);

		// Lower micro contrast
		var microContratLayer = imagelayer.duplicate();
		microContratLayer.name = "Micro Contrast";
		microContratLayer.blendMode = BlendMode.LUMINOSITY;
		microContratLayer.opacity = microSmooth_strength;

		microContratLayer.applyGaussianBlur(doc_scale * 0.8);
		doc.activeLayer = microContratLayer;
		doc.selection.load(doc.channels.getByName("Paper Response Mask"));
		doc.selection.invert();
		doc.selection.clear();
		doc.selection.deselect();
		microContratLayer.merge();

		// Soften image
		if (blur_radius > 0) {
			softenImage(doc.activeLayer, doc_scale * blur_radius);
		}

		// Halation
		var halationLayer = imagelayer.duplicate();
		halationLayer.name = "Halation";
		halationLayer.blendMode = BlendMode.LINEARDODGE;
		halationLayer.opacity = 50;

		doc.activeLayer = halationLayer;

		doc.selection.load(doc.channels.getByName("Highlight Mask"));
		doc.selection.invert();
		doc.selection.clear();

		halationLayer.applyGaussianBlur(doc_scale * blur_radius * 2);
		doc.selection.load(doc.channels.getByName("Highlight Mask"), SelectionType.REPLACE);
		doc.selection.clear();
		doc.selection.deselect();
		halationLayer.merge();

		// Grain
		var grainLayer = imagelayer.duplicate();
		grainLayer.name = "Grain";
		grainLayer.blendMode = BlendMode.SOFTLIGHT;
		grainLayer.opacity = 50;

		doc.activeLayer = grainLayer;
		doc.selection.selectAll();
		doc.selection.fill(greyColor)
		grainLayer.applyAddNoise(doc_scale*8, NoiseDistribution.GAUSSIAN, true);
		grainLayer.applyGaussianBlur(doc_scale * 0.3);
		doc.selection.load(doc.channels.getByName("Paper Response Mask"));
		doc.selection.invert();
		doc.selection.clear();
		doc.selection.deselect();
		grainLayer.merge();

		// Desaturation (now factors preflash color as well as strength)
		if (desaturation) {
			// Moved full desaturation flow into helper to measure mask coverage and apply multiplier
			applyDesaturation(pre_flash_r, pre_flash_g, pre_flash_b, pre_flash_strength);

		}
		
		// Remove the mask channels since they're no longer needed
		try {
			var wholeMask = doc.channels.getByName("Whole Mask");
			if (wholeMask) {
				wholeMask.remove();
			}
		} catch (e) {}
		
		try {
			var paperResponseMask = doc.channels.getByName("Paper Response Mask");
			if (paperResponseMask) {
				paperResponseMask.remove();
			}
		} catch (e) {}
		
		try {
			var highlightMask = doc.channels.getByName("Highlight Mask");
			if (highlightMask) {
				highlightMask.remove();
			}
		} catch (e) {}

		// Flatten document and save if needed
		doc.flatten();
		
		// Restore bits per channel if changed
		if (was16Bit) {
			doc.bitsPerChannel = BitsPerChannelType.EIGHT;
		}

		if (save == true) { saveClose(); }
	}
	
} catch (e) { alert(e); }