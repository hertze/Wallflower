// W A L L F L O W E R
//
// Version 2 beta
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Default settings ------------------------------------------------------------

var pre_flash_r = 132;
var pre_flash_g = 104;
var pre_flash_b = 86;
var pre_flash_strength = 10;
var blur_radius = 3;
var auto_adjust_preflash = true;
var preserve_whitepoint = false;
var whitepoint_restore_strength = 70; // 1–100: percentage to restore the original white point
var preserve_blackpoint = false;
var blackpoint_restore_strength = 70; // 1–100: percentage to restore the original black point
var desaturation = true;

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
	if (autoAdjust !== undefined) {
		dialog.autoadjust.value = (autoAdjust.toLowerCase() === "true");
	} else {
		dialog.autoadjust.value = auto_adjust_preflash;
	}

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
	if (saveWhiteParam !== undefined) {
		dialog.savewhite.value = (saveWhiteParam.toLowerCase() === "true");
	} else {
		dialog.savewhite.value = preserve_whitepoint;
	}
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
	if (saveBlackParam !== undefined) {
		dialog.saveblack.value = (saveBlackParam.toLowerCase() === "true");
	} else {
		dialog.saveblack.value = preserve_blackpoint;
	}
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

	if (desatParam !== undefined) {
		dialog.desaturation.value = (desatParam.toLowerCase() === "true");
	} else {
		dialog.desaturation.value = desaturation;
	}
	if (desatAmountParam !== undefined) {
		dialog.desatAmount.text = desatAmountParam;
	} else {
		dialog.desatAmount.text = desaturation_amount_setting.toString();
	}

	dialog.savestatus = dialog.add("checkbox", undefined, "Save and Close When Done");
	if (saveStatus !== undefined) {
		dialog.savestatus.value = (saveStatus.toLowerCase() === "true");
	} else {
		dialog.savestatus.value
	}

	var buttons = dialog.add( "group" );
	var submit = buttons.add("button", undefined, undefined, { name: "submit" });
	submit.text = "Use this recipe";
	
	submit.onClick = function () {
		thisRecipe = dialog.edittext1.text;
		saveStatus = dialog.savestatus.value.toString();
		autoAdjust = dialog.autoadjust.value.toString();
		desaturation = dialog.desaturation.value.toString();
		preserve_whitepoint = dialog.savewhite.value.toString();
		preserve_blackpoint = dialog.saveblack.value.toString();
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
			d.putString(stringIDToTypeID('savestatus'), result.savestatus);
				if (result.autoadjust !== undefined && result.autoadjust !== null) {
					d.putString(stringIDToTypeID('autoadjust'), result.autoadjust);
				}
				if (result.savewhitepoint !== undefined && result.savewhitepoint !== null) {
					d.putString(stringIDToTypeID('savewhitepoint'), result.savewhitepoint);
				}
				if (result.saveblackpoint !== undefined && result.saveblackpoint !== null) {
					d.putString(stringIDToTypeID('saveblackpoint'), result.saveblackpoint);
				}
				if (result.desaturation !== undefined && result.desaturation !== null) {
					d.putString(stringIDToTypeID('desaturation'), result.desaturation);
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
		var savestatus = app.playbackParameters.getString(stringIDToTypeID('savestatus'));
		var autoadjust = null;
		var saveblack = null;
		var savewhite = null;
		var desat = null;
		var desatamount = null;
		var blackrestoreamt = null;
		var whiterestoreamt = null;
		try { autoadjust = app.playbackParameters.getString(stringIDToTypeID('autoadjust')); } catch(e) { autoadjust = undefined; }
		try { saveblack = app.playbackParameters.getString(stringIDToTypeID('saveblackpoint')); } catch(e) { saveblack = undefined; }
		try { savewhite = app.playbackParameters.getString(stringIDToTypeID('savewhitepoint')); } catch(e) { savewhite = undefined; }
		try { desat = app.playbackParameters.getString(stringIDToTypeID('desaturation')); } catch(e) { desat = undefined; }
		try { desatamount = app.playbackParameters.getInteger(stringIDToTypeID('desatamount')); } catch(e) { desatamount = undefined; }
		try { blackrestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('blackrestoreamt')); } catch(e) { blackrestoreamt = undefined; }
		try { whiterestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('whiterestoreamt')); } catch(e) { whiterestoreamt = undefined; }
		
		if (app.playbackDisplayDialogs == DialogModes.ALL) {
			// user run action in dialog mode (edit action step)
				var result = displayDialog(recipe, savestatus, autoadjust, saveblack, savewhite, desat, desatamount, blackrestoreamt, whiterestoreamt, "edit");
			if (!result.recipe || result.recipe == "") { isCancelled = true; return } else {
				var d = new ActionDescriptor;
				d.putString(stringIDToTypeID('recipe'), result.recipe);
				d.putString(stringIDToTypeID('savestatus'), result.savestatus);
					d.putString(stringIDToTypeID('autoadjust'), result.autoadjust);
					d.putString(stringIDToTypeID('savewhitepoint'), result.savewhitepoint);
					d.putString(stringIDToTypeID('saveblackpoint'), result.saveblackpoint);
					d.putString(stringIDToTypeID('desaturation'), result.desaturation);
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
	save = (saveStatus.toLowerCase() === "true");
		// Apply preserve_whitepoint setting from dialog/playbackParameters if present
		if (runtimesettings.savewhitepoint !== undefined && runtimesettings.savewhitepoint !== null) {
			preserve_whitepoint = (runtimesettings.savewhitepoint.toLowerCase() === "true");
		}
		// Apply preserve_blackpoint setting from dialog/playbackParameters if present
		if (runtimesettings.saveblackpoint !== undefined && runtimesettings.saveblackpoint !== null) {
			preserve_blackpoint = (runtimesettings.saveblackpoint.toLowerCase() === "true");
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
			auto_adjust_preflash = (autoAdjustSetting.toLowerCase() === "true");
		}
			// Apply desaturation setting from dialog/playbackParameters if present
			if (desatSetting !== undefined && desatSetting !== null) {
				desaturation = (desatSetting.toLowerCase() === "true");
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

function computeAverageLightness() {
	try {
		var d = app.activeDocument;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var sum = 0;
		var i;
		if (d.mode === DocumentMode.LAB) {
			var lHist = d.channels.getByName(lightness_channel_name).histogram;
			for (i = 0; i <= 255; i++) {
				sum += (lHist[i] || 0) * i;
			}
		} else {
			var rHist = d.channels[0].histogram;
			var gHist = d.channels[1].histogram;
			var bHist = d.channels[2].histogram;
			for (i = 0; i <= 255; i++) {
				var avg = ((rHist[i] || 0) + (gHist[i] || 0) + (bHist[i] || 0)) / 3.0;
				sum += avg * i;
			}
		}
		return totalPixels ? (sum / totalPixels) : 128;
	} catch (e) {
		return 128;
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
		if (auto_adjust_preflash) {
			pre_flash_strength = autoAdjustPreflashStrength(pre_flash_strength);
		}
		if (pre_flash_strength > 0) {
			var preflashLayer = doc.artLayers.add();
			preflashLayer.name = "Preflash";
			preflashLayer.blendMode = BlendMode.SCREEN;
			preflashLayer.opacity = pre_flash_strength;
			
			doc.selection.load(doc.channels.getByName("Whole Mask"));
			doc.selection.fill(preflashColor);
			doc.selection.deselect();
			preflashLayer.merge();

			doc.changeMode(ChangeMode.LAB);
			var savedChannels = doc.activeChannels;
			doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];

			// Model compensation as a toe/shoulder response driven by exposure strength
			// and the precomputed mask coverage rather than global mean brightness.
			var strengthNorm = pre_flash_strength / 100;
			var damp = Math.min(preflash_damp_max, strengthNorm * preflash_damp_max);
			var midComp = Math.round((28 + 46 * paperResponseCoverage) * strengthNorm * (0.9 + damp * 0.75));
			var shoulderComp = Math.round((18 + 34 * wholeMaskCoverage) * strengthNorm * (0.9 + (1 - preflash_mid_blend) * 0.45));
			function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
			function gentle(v) {
				var t = v / 255.0; // 0..1
				var toeProtect = Math.pow(1 - t, 2.0);
				var midWeight = 4 * t * (1 - t);
				var extra = midComp * (0.7 * midWeight + 0.35 * t) * (1 - 0.84 * toeProtect);
				return clamp255(v - extra);
			}
			function comp(v) {
				// Add extra rollback in the shoulder so highlight contrast does not build up.
				var base = gentle(v);
				var t = v / 255.0;
				var extra = Math.round(shoulderComp * Math.pow(t, 2.0));
				return clamp255(base - extra);
			}
			// Blend lower mids back toward the gentler damped() result so the toe stays open.
			var midBlend = preflash_mid_blend; // 0..1 where 1 = fully damped (less change), 0 = fully comp (more change)
			var p0 = comp(0);
			var p32 = comp(32);
			var p64 = Math.round(comp(64) * (1 - midBlend) + gentle(64) * midBlend);
			var p128 = Math.round(comp(128) * (1 - midBlend) + gentle(128) * midBlend);
			var p160Raw = comp(160);
			var p160 = Math.min(p160Raw, p128 + (160 - 128));
			var p192Raw = comp(192);
			var p192 = Math.min(p192Raw, p160 + (192 - 160));
			// Lower the 255 anchor by the same amount as p192 so highlight contrast does not increase.
			var p255 = Math.max(p192, Math.min(255, p192 + (255 - 192)));
			// Constrain the shoulder spline with an intermediate anchor on the same linear falloff.
			var p224 = Math.max(p192, Math.min(p255, p192 + (224 - 192)));
			// Step 1: preflash compensation curve - pure tone correction, no blackpoint logic.
			var curvePoints = [
				[0, p0],
				[32, p32],
				[64, p64],
				[128, p128],
				[160, p160],
				[192, p192],
				[224, p224],
				[255, p255]
			];
			// Apply in Lab/Lightness only - colour-neutral, no hue/saturation shift.

			imagelayer.adjustCurves(curvePoints);

			// Step 2: restore black and/or white point in a single curve pass.
			var needBlack = false, needWhite = false;
			var actualPostLevelBlack, bp, restoredBp;
			var actualPostLevelWhite, wp, restoredWp;

			doc.activeChannels = savedChannels;

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
						var midIn = p128;
						var gamma = 1.0;
						// Only compute gamma when inputs are distinct and mid lies inside the input range
						if (inWhite > inBlack) {
							var t = (midIn - inBlack) / (inWhite - inBlack);
							// desired normalized output for mid should equal midIn mapped into output range
							var tprime = (midIn - outBlack) / (outWhite - outBlack);
							// numeric safety
							if (t > 0 && t < 1 && tprime > 0 && tprime < 1) {
								// solve tprime = t^(1/gamma)  =>  gamma = ln(t) / ln(tprime)
								try {
									gamma = Math.log(t) / Math.log(tprime);
									// clamp gamma to reasonable photographic bounds
									if (!isFinite(gamma) || gamma <= 0) gamma = 1.0;
									gamma = Math.max(0.25, Math.min(4.0, gamma));
								} catch (e) { gamma = 1.0; }
							}
						}
						// Apply a single Levels pass mapping the measured endpoints to the restored endpoints
						imagelayer.adjustLevels(inBlack, inWhite, gamma, outBlack, outWhite);
					} catch (e) {
						// fall back silently if adjustLevels is unsupported in this context
					}

				doc.activeChannels = savedChannels;
			}
			doc.changeMode(ChangeMode.RGB);
		}

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