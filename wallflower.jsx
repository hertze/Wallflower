// W A L L F L O W E R
//
// Version 2 beta
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Default settings ------------------------------------------------------------

var pre_flash_r = 255;
var pre_flash_g = 105;
var pre_flash_b = 40;
var pre_flash_strength = 10;
var blur_radius = 3;
var auto_adjust_preflash = true;
var save_blackpoint = true;
var desaturation = true;

var desat_boost = 0.5; // how strongly to boost desaturation when mask coverage is small (0..1)
var desaturation_amount_setting = 20; // user-editable amount (1..100) used as divisor

var preflash_auto_samples = 5; // grid samples per axis (5x5)
var preflash_shadow_threshold = 64; // luminance threshold considered 'shadow'

// Preflash curve tuning (tweak these at the top of the script)
// - `preflash_damp_max`: maximum overall damp applied to tones (0..1)
// - `preflash_blackcomp_max`: max additional black-point pull (0..255)
// - `preflash_mid_blend`: how strongly midtones favor the gentler damped() curve (0..1)
// - `preflash_min_factor`: lowest allowed multiplier to avoid total crush (0..1)
// - `preflash_blackshift_max`: max input threshold that will be forced to black (0..255)
var preflash_damp_max = 0.6;
var preflash_blackcomp_max = 40;
var preflash_mid_blend = 0.7;
var preflash_min_factor = 0.35;
var preflash_blackshift_max = 12;

// Blackpoint detection and remap settings
var blackpoint_threshold_fraction = 0.05; // fraction of pixels to consider 'significant' (default 0.2%)
var blackpoint_tolerance = 2; // bins; only remap when initial black is at least this darker than post-curve

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
					/saveblackpoint [(SaveBlackPoint) /boolean]
					/desaturation [(Desaturation) /boolean]
					/desatamount [(DesatAmount) /integer]
					>>
						>>
					>> ]]></terminology>
</javascriptresource>
// END__HARVEST_EXCEPTION_ZSTRING
*/


function displayDialog(thisRecipe, saveStatus, autoAdjust, saveBlackParam, desatParam, desatAmountParam, runmode) {
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

	// Save original blackpoint checkbox (placed after auto-adjust)
	// This controls whether we detect & bake the original blackpoint.
	dialog.saveblack = dialog.add("checkbox", undefined, "Save original blackpoint");
	if (saveBlackParam !== undefined) {
		dialog.saveblack.value = (saveBlackParam.toLowerCase() === "true");
	} else {
		dialog.saveblack.value = save_blackpoint;
	}

	// Desaturation checkbox + amount (placed before Save checkbox)
	var desatGroup = dialog.add("group");
	desatGroup.orientation = "row";
	dialog.desaturation = desatGroup.add("checkbox", undefined, "Reduce Preflash Saturation");
	dialog.desatAmount = desatGroup.add("edittext", undefined, undefined, { name: "desatAmount" });
	dialog.desatAmount.characters = 4;
	// remove extra padding around the small numeric field
	try { dialog.desatAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var desatPctLabel = desatGroup.add("statictext", undefined, "%");
	try { desatPctLabel.margins = [4, 0, 0, 0]; } catch(e) {}

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
		save_blackpoint = dialog.saveblack.value.toString();
		desaturation_amount_setting = parseInt(dialog.desatAmount.text) || desaturation_amount_setting;
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
		"saveblackpoint": save_blackpoint,
		"desaturation": desaturation,
		"desatamount": desaturation_amount_setting
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
				if (result.saveblackpoint !== undefined && result.saveblackpoint !== null) {
					d.putString(stringIDToTypeID('saveblackpoint'), result.saveblackpoint);
				}
				if (result.desaturation !== undefined && result.desaturation !== null) {
					d.putString(stringIDToTypeID('desaturation'), result.desaturation);
				}
				if (result.desatamount !== undefined && result.desatamount !== null) {
					d.putInteger(stringIDToTypeID('desatamount'), result.desatamount);
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
		var desat = null;
		var desatamount = null;
		try { autoadjust = app.playbackParameters.getString(stringIDToTypeID('autoadjust')); } catch(e) { autoadjust = undefined; }
		try { saveblack = app.playbackParameters.getString(stringIDToTypeID('saveblackpoint')); } catch(e) { saveblack = undefined; }
		try { desat = app.playbackParameters.getString(stringIDToTypeID('desaturation')); } catch(e) { desat = undefined; }
		try { desatamount = app.playbackParameters.getInteger(stringIDToTypeID('desatamount')); } catch(e) { desatamount = undefined; }
		
		if (app.playbackDisplayDialogs == DialogModes.ALL) {
			// user run action in dialog mode (edit action step)
				var result = displayDialog(recipe, savestatus, autoadjust, saveblack, desat, desatamount, "edit");
			if (!result.recipe || result.recipe == "") { isCancelled = true; return } else {
				var d = new ActionDescriptor;
				d.putString(stringIDToTypeID('recipe'), result.recipe);
				d.putString(stringIDToTypeID('savestatus'), result.savestatus);
					d.putString(stringIDToTypeID('autoadjust'), result.autoadjust);
					d.putString(stringIDToTypeID('saveblackpoint'), result.saveblackpoint);
					d.putString(stringIDToTypeID('desaturation'), result.desaturation);
					d.putInteger(stringIDToTypeID('desatamount'), result.desatamount);
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
				"saveblackpoint": saveblack,
				"desaturation": desat,
				"desatamount": desatamount
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
		// Apply save_blackpoint setting from dialog/playbackParameters if present
		if (runtimesettings.saveblackpoint !== undefined && runtimesettings.saveblackpoint !== null) {
			save_blackpoint = (runtimesettings.saveblackpoint.toLowerCase() === "true");
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
				desaturation_amount_setting = parseInt(runtimesettings.desatamount) || desaturation_amount_setting;
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

function createLuminanceMasks(rangeStart, rangeEnd, maskName, blurRadius) {

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
		tempLayer.adjustLevels(rangeStart, rangeEnd, 1.0, 0, 255);

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
function computeImageBlackPoint(thresholdFraction) {
	try {
		var d = app.activeDocument;
		var totalPixels = d.width.as("px") * d.height.as("px");
		var rHist = d.channels[0].histogram;
		var gHist = d.channels[1].histogram;
		var bHist = d.channels[2].histogram;

		var threshold = Math.max(0, Math.min(1, (thresholdFraction !== undefined) ? thresholdFraction : blackpoint_threshold_fraction));
		var cumulative = 0;
		for (var i = 0; i <= 255; i++) {
			var avg = ((rHist[i] || 0) + (gHist[i] || 0) + (bHist[i] || 0)) / 3.0;
			cumulative += avg;
			if (totalPixels && (cumulative / totalPixels) >= threshold) {
				return i;
			}
		}
		return 255;
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

try {	
	if (executeScript == true) {

		// Upgrade to 16-bit if needed
		if (BitsPerChannelType.SIXTEEN) {
			var was16Bit = true;
			doc.bitsPerChannel = BitsPerChannelType.SIXTEEN;
		}

		// Check initial blackpoint
		// Analyze initial black point (first significant dark bin)
		var initialBlackPoint = 0;
		if (save_blackpoint) {
			try {
				initialBlackPoint = computeImageBlackPoint(); // use default threshold (configurable)
			} catch (e) { initialBlackPoint = 0; }
		}

		// Create luminance masks (pass scaled blur radius)
		createLuminanceMasks(0,255, "Whole Mask", doc_scale * blur_radius);
		createLuminanceMasks(0,64, "Shadow Mask", 0);
		createLuminanceMasks(192,255, "Highlight Mask", 0);

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

		// Preflash
		if (auto_adjust_preflash) {
			pre_flash_strength = autoAdjustPreflashStrength(pre_flash_strength);
		}
		if (pre_flash_strength > 0) {
			var preflashLayer = doc.artLayers.add();
			preflashLayer.name = "Preflash";
			preflashLayer.blendMode = BlendMode.LINEARDODGE;
			preflashLayer.opacity = pre_flash_strength;
			
			doc.selection.load(doc.channels.getByName("Whole Mask"));
			doc.selection.fill(preflashColor);
			doc.selection.deselect();
			preflashLayer.merge();

			// Smart preflash compensation: darken more in shadows (including black point), less in highlights.
			var damp = Math.min(preflash_damp_max, (pre_flash_strength / 100) * preflash_damp_max); // overall strength
			var blackComp = Math.round((pre_flash_strength / 100) * preflash_blackcomp_max); // max extra shadow pull
			function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
			function damped(v) {
				var t = v / 255.0; // 0..1
				// Use t^2 so highlights (t~1) are barely affected, shadows (t~0) affected more
				var factor = 1 - damp * (1 - t * t);
				factor = Math.max(preflash_min_factor, factor); // avoid total crush
				return clamp255(v * factor);
			}
			function comp(v) {
				// additional black-point compensation that tapers toward highlights
				var base = damped(v);
				var t = v / 255.0;
				var extra = Math.round(blackComp * Math.pow(1 - t, 3)); // cubic falloff: much stronger near 0, minimal in midtones
				return clamp255(base - extra);
			}
			// Blend midtones back toward the gentler damped() result so midtones are less affected
			var midBlend = preflash_mid_blend; // 0..1 where 1 = fully damped (less change), 0 = fully comp (more change)
			var p0 = comp(0);
			var p32 = comp(32);
			var p64 = Math.round(comp(64) * (1 - midBlend) + damped(64) * midBlend);
			var p128 = Math.round(comp(128) * (1 - midBlend) + damped(128) * midBlend);
			var p192 = comp(192);
			var p255 = comp(255);
			// Optionally force a small input range to map to 0 to restore true blacks
			var blackShiftInput = Math.round((pre_flash_strength / 100) * preflash_blackshift_max); // 0..preflash_blackshift_max
			var curvePoints = [];
			curvePoints.push([0, p0]);
			if (blackShiftInput > 0) {
				// Map the small input threshold down to 0 to recover blackpoint
				curvePoints.push([blackShiftInput, 0]);
			}
			curvePoints = curvePoints.concat([
				[32, p32],
				[64, p64],
				[128, p128],
				[192, p192],
				[255, p255]
			]);
			// Apply the preflash compensation curve.
			imagelayer.adjustCurves(curvePoints);
			// Restore the original black point: measure the actual post-curve
			// result and apply a 3-point corrective curves pass only if needed.
			// (Simulation was abandoned because Photoshop's spline interpolation
			// differs from linear prediction, causing unreliable results.)
			if (save_blackpoint) {
				try {
					var actualPostCurveBlack = Math.max(0, Math.min(255, Math.round(computeImageBlackPoint())));
					var bp = Math.max(0, Math.min(255, Math.round(initialBlackPoint || 0)));
					if (actualPostCurveBlack > bp + blackpoint_tolerance) {
						// Apply an inverted-S in the shadow zone to both restore the black point
						// and compensate for the increased shadow contrast from the compression.
						// q1 sits above the straight line (lifts deep shadows = less dark near black),
						// q2 sits below it (darkens upper shadows), together forming the inverted S.
						var q1In  = Math.round(actualPostCurveBlack * 0.25);
						var q1Out = Math.round(bp * 0.35);
						var q2In  = Math.round(actualPostCurveBlack * 0.75);
						var q2Out = Math.round(bp * 0.65);
						var corrPoints;
						if (q1In > 0 && q1In < q2In && q2In < actualPostCurveBlack) {
							corrPoints = [
								[0, 0],
								[q1In, q1Out],
								[q2In, q2Out],
								[actualPostCurveBlack, bp],
								[128, 128],
								[255, 255]
							];
						} else {
							// Fallback for very small shadow ranges
							corrPoints = [[0, 0], [actualPostCurveBlack, bp], [128, 128], [255, 255]];
						}
						imagelayer.adjustCurves(corrPoints);
					}
				} catch (e) {}
			}
		}

		// Lower micro contrast
		var microContratLayer = imagelayer.duplicate();
		microContratLayer.name = "Micro Contrast";
		microContratLayer.blendMode = BlendMode.LUMINOSITY;
		microContratLayer.opacity = 30;

		microContratLayer.applyGaussianBlur(doc_scale * 0.8);
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
		grainLayer.applyAddNoise(doc_scale*10, NoiseDistribution.GAUSSIAN, true);
		doc.selection.load(doc.channels.getByName("Whole Mask"));
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
			var shadowMask = doc.channels.getByName("Shadow Mask");
			if (shadowMask) {
				shadowMask.remove();
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