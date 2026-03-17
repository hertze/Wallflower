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
var pre_flash_strength = 100;
var blur_radius = 3;
var auto_adjust_preflash = true;
var preserve_whitepoint = true;
var whitepoint_restore_strength = 20; // 1–100: percentage to restore the original white point
var preserve_blackpoint = true;
var blackpoint_restore_strength = 50; // 1–100: percentage to restore the original black point
var preflash_color_amount_setting = 100; // 0-200: preflash chroma amount (100 = current baseline)

var lightness_channel_name = "Lightness"; // name of the lightness channel in Lab mode

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
	/preflashr [(PreflashR) /integer]
	/preflashg [(PreflashG) /integer]
	/preflashb [(PreflashB) /integer]
	/preflashstrength [(PreflashStrength) /integer]
	/blurradius [(BlurRadius) /integer]
	/savestatus [(Save) /boolean]
	/savewhitepoint [(SaveWhitePoint) /boolean]
	/saveblackpoint [(SaveBlackPoint) /boolean]
	/preflashcoloramt [(PreflashColorAmt) /integer]
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

function coerceInteger(value, fallback, minVal, maxVal) {
	var n = parseInt(value, 10);
	if (isNaN(n)) n = fallback;
	if (minVal !== undefined && n < minVal) n = minVal;
	if (maxVal !== undefined && n > maxVal) n = maxVal;
	return n;
}

function displayDialog(settings, runmode) {
	// Display dialog box.
	var dialog = new Window("dialog");
	dialog.text = "Wallflower";
	dialog.orientation = "column";
	dialog.alignChildren = ["fill", "top"];
	dialog.spacing = 14;
	dialog.margins = 20;

	settings = settings || {};
	runmode = runmode || "normal";

 	var preflashPanel = dialog.add("panel", undefined, "Preflash Properties");
 	preflashPanel.orientation = "column";
 	preflashPanel.alignChildren = ["fill", "top"];
	preflashPanel.margins = 14;
	preflashPanel.spacing = 10;

	var rgbGroup = preflashPanel.add("group");
	rgbGroup.orientation = "row";
	rgbGroup.spacing = 6;
	rgbGroup.alignment = ["fill", "top"];
	rgbGroup.add("statictext", undefined, "Preflash Color (RGB)");
	rgbGroup.add("statictext", undefined, "R:");
	dialog.preflashR = rgbGroup.add("edittext", undefined, (settings.preflashr !== undefined ? settings.preflashr : pre_flash_r).toString());
	dialog.preflashR.characters = 3;
	try { dialog.preflashR.margins = [0,0,0,0]; } catch(e) {}
	rgbGroup.add("statictext", undefined, "G:");
	dialog.preflashG = rgbGroup.add("edittext", undefined, (settings.preflashg !== undefined ? settings.preflashg : pre_flash_g).toString());
	dialog.preflashG.characters = 3;
	try { dialog.preflashG.margins = [0,0,0,0]; } catch(e) {}
	rgbGroup.add("statictext", undefined, "B:");
	dialog.preflashB = rgbGroup.add("edittext", undefined, (settings.preflashb !== undefined ? settings.preflashb : pre_flash_b).toString());
	dialog.preflashB.characters = 3;
	try { dialog.preflashB.margins = [0,0,0,0]; } catch(e) {}

	var strengthGroup = preflashPanel.add("group");
	strengthGroup.orientation = "row";
	strengthGroup.spacing = 6;
	strengthGroup.alignment = ["fill", "top"];
	strengthGroup.add("statictext", undefined, "Preflash Strength");
	dialog.preflashStrength = strengthGroup.add("edittext", undefined, (settings.preflashstrength !== undefined ? settings.preflashstrength : pre_flash_strength).toString());
	dialog.preflashStrength.characters = 4;
	try { dialog.preflashStrength.margins = [0,0,0,0]; } catch(e) {}
	strengthGroup.add("statictext", undefined, "%");

	var chromaGroup = preflashPanel.add("group");
	chromaGroup.orientation = "row";
	chromaGroup.spacing = 6;
	chromaGroup.alignment = ["fill", "top"];
	chromaGroup.add("statictext", undefined, "Preflash Chroma");
	dialog.preflashColorAmount = chromaGroup.add("edittext", undefined, (settings.preflashcoloramt !== undefined ? settings.preflashcoloramt : preflash_color_amount_setting).toString());
	dialog.preflashColorAmount.characters = 4;
	try { dialog.preflashColorAmount.margins = [0,0,0,0]; } catch(e) {}
	chromaGroup.add("statictext", undefined, "%");

 	var histogramBlurPanel = dialog.add("panel", undefined, "Histogram and Blur");
 	histogramBlurPanel.orientation = "column";
 	histogramBlurPanel.alignChildren = ["fill", "top"];
	histogramBlurPanel.margins = 14;
	histogramBlurPanel.spacing = 10;

	// Keep White Point checkbox + restore strength field
	var savewhiteGroup = histogramBlurPanel.add("group");
	savewhiteGroup.orientation = "row";
	savewhiteGroup.spacing = 6;
	savewhiteGroup.alignment = ["fill", "top"];
	dialog.savewhite = savewhiteGroup.add("checkbox", undefined, "Preserve White Point at");
	dialog.whiteRestoreAmount = savewhiteGroup.add("edittext", undefined, undefined, { name: "whiteRestoreAmount" });
	dialog.whiteRestoreAmount.characters = 4;
	try { dialog.whiteRestoreAmount.margins = [0,0,0,0]; } catch(e) {}
	try { dialog.whiteRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var whitePctLabel = savewhiteGroup.add("statictext", undefined, "%");
	try { whitePctLabel.margins = [0, 0, 0, 0]; } catch(e) {}
	dialog.savewhite.value = coerceBoolean(settings.savewhitepoint, preserve_whitepoint);
	if (settings.whiterestoreamt !== undefined) {
		dialog.whiteRestoreAmount.text = settings.whiterestoreamt.toString();
	} else {
		dialog.whiteRestoreAmount.text = whitepoint_restore_strength.toString();
	}

	// Save original blackpoint checkbox + restore strength field
	var saveblackGroup = histogramBlurPanel.add("group");
	saveblackGroup.orientation = "row";
	saveblackGroup.spacing = 6;
	saveblackGroup.alignment = ["fill", "top"];
	dialog.saveblack = saveblackGroup.add("checkbox", undefined, "Preserve Black Point at");
	dialog.blackRestoreAmount = saveblackGroup.add("edittext", undefined, undefined, { name: "blackRestoreAmount" });
	dialog.blackRestoreAmount.characters = 4;
	try { dialog.blackRestoreAmount.margins = [0,0,0,0]; } catch(e) {}
	try { dialog.blackRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	var blackPctLabel = saveblackGroup.add("statictext", undefined, "%");
	try { blackPctLabel.margins = [0, 0, 0, 0]; } catch(e) {}
	dialog.saveblack.value = coerceBoolean(settings.saveblackpoint, preserve_blackpoint);
	if (settings.blackrestoreamt !== undefined) {
		dialog.blackRestoreAmount.text = settings.blackrestoreamt.toString();
	} else {
		dialog.blackRestoreAmount.text = blackpoint_restore_strength.toString();
	}

	var blurGroup = histogramBlurPanel.add("group");
	blurGroup.orientation = "row";
	blurGroup.spacing = 6;
	blurGroup.alignment = ["fill", "top"];
	blurGroup.add("statictext", undefined, "Blur radius");
	dialog.blurRadius = blurGroup.add("edittext", undefined, (settings.blurradius !== undefined ? settings.blurradius : blur_radius).toString());
	dialog.blurRadius.characters = 4;
	try { dialog.blurRadius.margins = [0,0,0,0]; } catch(e) {}

	dialog.savestatus = dialog.add("checkbox", undefined, "Save and Close When Done");
	dialog.savestatus.value = coerceBoolean(settings.savestatus, save);

	var buttonSpacer = dialog.add("statictext", undefined, "");
	buttonSpacer.preferredSize = [1, 10];

	var dialogSubmitted = false;
	var dialogUsedDefaults = false;

	var buttons = dialog.add( "group" );
	buttons.spacing = 10;
	var applyBtn = buttons.add("button", undefined, undefined, { name: "ok" });
	if (runmode === "edit") {
		applyBtn.text = "Use These Settings";
		applyBtn.onClick = function () {
			dialogSubmitted = true;
			dialog.close(1);
		};
	} else {
		applyBtn.text = "Run";
		applyBtn.onClick = function () {
			dialogSubmitted = true;
			dialog.close(1);
		};
		var defaultsBtn = buttons.add("button", undefined, "Run with Default Settings");
		defaultsBtn.onClick = function () {
			dialogUsedDefaults = true;
			dialog.__useDefaults = true;
			dialog.close(1);
		};
	}
	var cancelBtn = buttons.add("button", undefined, "Cancel", { name: "cancel" });
	cancelBtn.onClick = function () {
		dialog.close(0);
	};
	var response = dialog.show();
	if (response != 1) return null;
	if (runmode === "edit" && !dialogSubmitted) return null;
	if (runmode !== "edit" && !dialogSubmitted && !dialogUsedDefaults) return null;
	if (dialog.__useDefaults === true) {
		return {
			"preflashr": pre_flash_r,
			"preflashg": pre_flash_g,
			"preflashb": pre_flash_b,
			"preflashstrength": pre_flash_strength,
			"blurradius": blur_radius,
			"savestatus": save,
			"savewhitepoint": preserve_whitepoint,
			"saveblackpoint": preserve_blackpoint,
			"preflashcoloramt": preflash_color_amount_setting,
			"blackrestoreamt": blackpoint_restore_strength,
			"whiterestoreamt": whitepoint_restore_strength
		};
	}

	return {
		"preflashr": coerceInteger(dialog.preflashR.text, pre_flash_r, 0, 255),
		"preflashg": coerceInteger(dialog.preflashG.text, pre_flash_g, 0, 255),
		"preflashb": coerceInteger(dialog.preflashB.text, pre_flash_b, 0, 255),
		"preflashstrength": coerceInteger(dialog.preflashStrength.text, pre_flash_strength, 0, 100),
		"blurradius": coerceInteger(dialog.blurRadius.text, blur_radius, 0, 100),
		"savestatus": dialog.savestatus.value,
		"savewhitepoint": dialog.savewhite.value,
		"saveblackpoint": dialog.saveblack.value,
		"preflashcoloramt": coerceInteger(dialog.preflashColorAmount.text, preflash_color_amount_setting, 0, 200),
		"blackrestoreamt": coerceInteger(dialog.blackRestoreAmount.text, blackpoint_restore_strength, 1, 100),
		"whiterestoreamt": coerceInteger(dialog.whiteRestoreAmount.text, whitepoint_restore_strength, 1, 100)
	};
}

function getSettings() {
	// Retrieve settings from action or dialog
	if (!app.playbackParameters.count) {
		// normal run (from scripts menu)
		var result = displayDialog(undefined, "normal");
		if (!result) { isCancelled = true; executeScript = false; return null; } else {
			var d = new ActionDescriptor;
			d.putInteger(stringIDToTypeID('preflashr'), result.preflashr);
			d.putInteger(stringIDToTypeID('preflashg'), result.preflashg);
			d.putInteger(stringIDToTypeID('preflashb'), result.preflashb);
			d.putInteger(stringIDToTypeID('preflashstrength'), result.preflashstrength);
			d.putInteger(stringIDToTypeID('blurradius'), result.blurradius);
			d.putBoolean(stringIDToTypeID('savestatus'), coerceBoolean(result.savestatus, save));
			d.putBoolean(stringIDToTypeID('savewhitepoint'), coerceBoolean(result.savewhitepoint, preserve_whitepoint));
			d.putBoolean(stringIDToTypeID('saveblackpoint'), coerceBoolean(result.saveblackpoint, preserve_blackpoint));
			d.putInteger(stringIDToTypeID('preflashcoloramt'), result.preflashcoloramt);
			d.putInteger(stringIDToTypeID('blackrestoreamt'), result.blackrestoreamt);
			d.putInteger(stringIDToTypeID('whiterestoreamt'), result.whiterestoreamt);
			app.playbackParameters = d;        
			return result;
		}
	}
	else {
		var preflashr = pre_flash_r;
		var preflashg = pre_flash_g;
		var preflashb = pre_flash_b;
		var preflashstrength = pre_flash_strength;
		var blurradius = blur_radius;
		var savestatus = null;
		var saveblack = null;
		var savewhite = null;
		var preflashcoloramt = null;
		var blackrestoreamt = null;
		var whiterestoreamt = null;
		function normalizePercent(value, fallback, minVal, maxVal) {
			var n = parseInt(value, 10);
			if (isNaN(n)) return fallback;
			if (n < minVal) n = minVal;
			if (n > maxVal) n = maxVal;
			return n;
		}
		try { preflashr = app.playbackParameters.getInteger(stringIDToTypeID('preflashr')); } catch(e) {
			try { preflashr = app.playbackParameters.getString(stringIDToTypeID('preflashr')); } catch(ee) { preflashr = pre_flash_r; }
		}
		try { preflashg = app.playbackParameters.getInteger(stringIDToTypeID('preflashg')); } catch(e) {
			try { preflashg = app.playbackParameters.getString(stringIDToTypeID('preflashg')); } catch(ee) { preflashg = pre_flash_g; }
		}
		try { preflashb = app.playbackParameters.getInteger(stringIDToTypeID('preflashb')); } catch(e) {
			try { preflashb = app.playbackParameters.getString(stringIDToTypeID('preflashb')); } catch(ee) { preflashb = pre_flash_b; }
		}
		try { preflashstrength = app.playbackParameters.getInteger(stringIDToTypeID('preflashstrength')); } catch(e) {
			try { preflashstrength = app.playbackParameters.getString(stringIDToTypeID('preflashstrength')); } catch(ee) { preflashstrength = pre_flash_strength; }
		}
		try { blurradius = app.playbackParameters.getInteger(stringIDToTypeID('blurradius')); } catch(e) {
			try { blurradius = app.playbackParameters.getString(stringIDToTypeID('blurradius')); } catch(ee) { blurradius = blur_radius; }
		}
		try { savestatus = app.playbackParameters.getBoolean(stringIDToTypeID('savestatus')); } catch(e) {
			try { savestatus = app.playbackParameters.getString(stringIDToTypeID('savestatus')); } catch(ee) { savestatus = undefined; }
		}
		try { saveblack = app.playbackParameters.getBoolean(stringIDToTypeID('saveblackpoint')); } catch(e) {
			try { saveblack = app.playbackParameters.getString(stringIDToTypeID('saveblackpoint')); } catch(ee) { saveblack = undefined; }
		}
		try { savewhite = app.playbackParameters.getBoolean(stringIDToTypeID('savewhitepoint')); } catch(e) {
			try { savewhite = app.playbackParameters.getString(stringIDToTypeID('savewhitepoint')); } catch(ee) { savewhite = undefined; }
		}
		try { preflashcoloramt = app.playbackParameters.getInteger(stringIDToTypeID('preflashcoloramt')); } catch(e) {
			try { preflashcoloramt = app.playbackParameters.getString(stringIDToTypeID('preflashcoloramt')); } catch(ee) {
				// Backward compatibility: old action steps may still carry desatamount.
				try { preflashcoloramt = app.playbackParameters.getInteger(stringIDToTypeID('desatamount')); } catch(eee) {
					try { preflashcoloramt = app.playbackParameters.getString(stringIDToTypeID('desatamount')); } catch(eeee) { preflashcoloramt = undefined; }
				}
			}
		}
		preflashcoloramt = normalizePercent(preflashcoloramt, preflash_color_amount_setting, 0, 200);
		preflashr = normalizePercent(preflashr, pre_flash_r, 0, 255);
		preflashg = normalizePercent(preflashg, pre_flash_g, 0, 255);
		preflashb = normalizePercent(preflashb, pre_flash_b, 0, 255);
		preflashstrength = normalizePercent(preflashstrength, pre_flash_strength, 0, 100);
		blurradius = normalizePercent(blurradius, blur_radius, 0, 100);
		try { blackrestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('blackrestoreamt')); } catch(e) { blackrestoreamt = undefined; }
		try { whiterestoreamt = app.playbackParameters.getInteger(stringIDToTypeID('whiterestoreamt')); } catch(e) { whiterestoreamt = undefined; }
		
		if (app.playbackDisplayDialogs == DialogModes.ALL) {
			// user run action in dialog mode (edit action step)
				var result = displayDialog({
					preflashr: preflashr,
					preflashg: preflashg,
					preflashb: preflashb,
					preflashstrength: preflashstrength,
					blurradius: blurradius,
					savestatus: savestatus,
					saveblackpoint: saveblack,
					savewhitepoint: savewhite,
					preflashcoloramt: preflashcoloramt,
					blackrestoreamt: blackrestoreamt,
					whiterestoreamt: whiterestoreamt
				}, "edit");
			if (!result) { isCancelled = true; executeScript = false; return null; } else {
				var d = new ActionDescriptor;
				d.putInteger(stringIDToTypeID('preflashr'), result.preflashr);
				d.putInteger(stringIDToTypeID('preflashg'), result.preflashg);
				d.putInteger(stringIDToTypeID('preflashb'), result.preflashb);
				d.putInteger(stringIDToTypeID('preflashstrength'), result.preflashstrength);
				d.putInteger(stringIDToTypeID('blurradius'), result.blurradius);
				d.putBoolean(stringIDToTypeID('savestatus'), coerceBoolean(result.savestatus, save));
				d.putBoolean(stringIDToTypeID('savewhitepoint'), coerceBoolean(result.savewhitepoint, preserve_whitepoint));
				d.putBoolean(stringIDToTypeID('saveblackpoint'), coerceBoolean(result.saveblackpoint, preserve_blackpoint));
				d.putInteger(stringIDToTypeID('preflashcoloramt'), result.preflashcoloramt);
				d.putInteger(stringIDToTypeID('blackrestoreamt'), result.blackrestoreamt);
				d.putInteger(stringIDToTypeID('whiterestoreamt'), result.whiterestoreamt);
				app.playbackParameters = d;
			}
			executeScript = false;
			return result;
		}
		if (app.playbackDisplayDialogs != DialogModes.ALL) {
			// user run script without recording dialogs
			return {
				"preflashr": preflashr,
				"preflashg": preflashg,
				"preflashb": preflashb,
				"preflashstrength": preflashstrength,
				"blurradius": blurradius,
				"savestatus": savestatus,
				"savewhitepoint": savewhite,
				"saveblackpoint": saveblack,
				"preflashcoloramt": preflashcoloramt,
			"blackrestoreamt": blackrestoreamt,
			"whiterestoreamt": whiterestoreamt
			};
		}
	}
}

function processSettings(runtimesettings) {
	// Process dialog/action settings and update runtime globals
	var saveStatus = runtimesettings.savestatus;
	save = coerceBoolean(saveStatus, false);
		// Apply preserve_whitepoint setting from dialog/playbackParameters if present
		if (runtimesettings.savewhitepoint !== undefined && runtimesettings.savewhitepoint !== null) {
			preserve_whitepoint = coerceBoolean(runtimesettings.savewhitepoint, preserve_whitepoint);
		}
		// Apply preserve_blackpoint setting from dialog/playbackParameters if present
		if (runtimesettings.saveblackpoint !== undefined && runtimesettings.saveblackpoint !== null) {
			preserve_blackpoint = coerceBoolean(runtimesettings.saveblackpoint, preserve_blackpoint);
		}

		if (runtimesettings.preflashr !== undefined && runtimesettings.preflashr !== null) {
			pre_flash_r = coerceInteger(runtimesettings.preflashr, pre_flash_r, 0, 255);
		}
		if (runtimesettings.preflashg !== undefined && runtimesettings.preflashg !== null) {
			pre_flash_g = coerceInteger(runtimesettings.preflashg, pre_flash_g, 0, 255);
		}
		if (runtimesettings.preflashb !== undefined && runtimesettings.preflashb !== null) {
			pre_flash_b = coerceInteger(runtimesettings.preflashb, pre_flash_b, 0, 255);
		}
		if (runtimesettings.preflashstrength !== undefined && runtimesettings.preflashstrength !== null) {
			pre_flash_strength = coerceInteger(runtimesettings.preflashstrength, pre_flash_strength, 0, 100);
		}
		if (runtimesettings.blurradius !== undefined && runtimesettings.blurradius !== null) {
			blur_radius = coerceInteger(runtimesettings.blurradius, blur_radius, 0, 100);
		}
			// Apply preflash color amount (percent) from dialog/playbackParameters if present
			if (runtimesettings.preflashcoloramt !== undefined && runtimesettings.preflashcoloramt !== null) {
				var _pc = parseInt(runtimesettings.preflashcoloramt, 10);
				if (!isNaN(_pc)) preflash_color_amount_setting = Math.max(0, Math.min(200, _pc));
			}
			// Apply restore strength percentages from dialog/playbackParameters if present
			if (runtimesettings.blackrestoreamt !== undefined && runtimesettings.blackrestoreamt !== null) {
					var _bp = parseInt(runtimesettings.blackrestoreamt); if (!isNaN(_bp)) blackpoint_restore_strength = _bp;
			}
			if (runtimesettings.whiterestoreamt !== undefined && runtimesettings.whiterestoreamt !== null) {
				var _wp = parseInt(runtimesettings.whiterestoreamt); if (!isNaN(_wp)) whitepoint_restore_strength = _wp;
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

function applyPreflash(wholeMaskCoverage, paperResponseCoverage) {
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
		// Keep chroma scaling, but simplify Lightness response to a near-linear, exposure-like curve.
		var chromaScaleMax = 1.25;
		var highStrengthRoll = Math.pow(clamp01((strengthNorm - 0.82) / 0.18), 1.35);
		var topEndLimiter = 1 - 0.24 * highStrengthRoll;
		var chromaScale = chromaScaleMax * strengthNorm * topEndLimiter;
		var chromaNorm = chromaScale / chromaScaleMax;

		// Endpoints: preserve mode keeps anchors fixed at 0/255.
		// In non-preserve mode, endpoints follow the same delta as nearby anchors.
		var p0 = 0;
		var p255 = 255;

		// Exposure lift centered around mids with compensation to keep average brightness stable.
		var exposureLift = 24 * strengthNorm * (0.9 + 0.2 * wholeMaskCoverage) * (1 + 0.18 * chromaNorm);
		var midPull = exposureLift * (preserve_whitepoint ? 0.62 : 0.78);
		var highPull = exposureLift * (preserve_whitepoint ? 0.78 : 1.02);
		// Make dark-region lift scale more strongly with preflash strength.
		var shadowLift = exposureLift * (0.55 + 0.45 * strengthNorm);

		var p32 = 32 + shadowLift * 0.88 - midPull * 0.08;
		var p64 = 64 + shadowLift * 1.12 - midPull * 0.22;
		var p128 = 128 + exposureLift - midPull;
		var shoulderStrength = 0.65 + 0.45 * strengthNorm;
		if (preserve_whitepoint) shoulderStrength = shoulderStrength * 0.82;
		var p160 = 160 + exposureLift * 0.68 - (midPull * 0.64 + highPull * (0.22 * shoulderStrength));
		var p192 = 192 + exposureLift * 0.36 - highPull * (1.08 * shoulderStrength);
		var p224 = 224 + exposureLift * 0.10 - highPull * (1.18 * shoulderStrength);

		// Blend upper anchors toward a gentler shoulder trajectory for smoother rolloff.
		var shoulderSmooth = 0.30 + 0.40 * strengthNorm;
		var p192Target = p160 + (192 - 160) * 0.56;
		var p224Target = p192 + (224 - 192) * 0.44;
		p192 = p192 * (1 - shoulderSmooth) + p192Target * shoulderSmooth;
		p224 = p224 * (1 - shoulderSmooth) + p224Target * shoulderSmooth;

		p32 = clamp255(p32);
		p64 = clamp255(p64);
		p128 = clamp255(p128);
		p160 = clamp255(p160);
		p192 = clamp255(p192);
		p224 = clamp255(p224);

		// Keep curve endpoints fixed; endpoint shaping is handled by Levels.
		p0 = 0;
		p255 = 255;

		// Keep anchors monotonic.
		p32 = Math.max(p0, p32);
		p64 = Math.max(p32, p64);
		p128 = Math.max(p64, p128);
		p160 = Math.max(p128, p160);
		p192 = Math.max(p160, p192);
		p224 = Math.max(p192, p224);
		p255 = Math.max(p224, p255);
		if (p255 <= p0) p255 = Math.min(255, p0 + 1);

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

	function applyEndpointLevels(midIn) {
		// Preserve strengths scale how much endpoint/gamma shaping is applied.
		// Example: preserve at 70% => apply 30% of the corresponding side's change.
		var blackChangeScale = preserve_blackpoint ? clamp01(1 - (blackpoint_restore_strength / 100)) : 1;
		var whiteChangeScale = preserve_whitepoint ? clamp01(1 - (whitepoint_restore_strength / 100)) : 1;

		var inBlack = clamp255(Math.round(22 * strengthNorm * blackChangeScale));
		var inWhite = clamp255(255 - Math.round(16 * strengthNorm * whiteChangeScale));
		var outBlack = clamp255(Math.round((42 * strengthNorm + 6) * blackChangeScale));
		var outWhite = clamp255(255 - Math.round(30 * strengthNorm * whiteChangeScale));
		if (inWhite <= inBlack) inWhite = Math.min(255, inBlack + 1);
		if (outWhite <= outBlack) outWhite = Math.min(255, outBlack + 1);

		var restoreChannels = doc.activeChannels;
		if (doc.mode === DocumentMode.LAB) {
			doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];
		} else {
			doc.activeChannels = [doc.channels[0], doc.channels[1], doc.channels[2]];
		}
		try {
			var levelsGammaTarget = solveLevelsGamma(midIn, inBlack, inWhite, outBlack, outWhite);
			var gammaChangeScale = (blackChangeScale + whiteChangeScale) / 2;
			var levelsGamma = 1 + (levelsGammaTarget - 1) * gammaChangeScale;
			if (!preserve_blackpoint && !preserve_whitepoint) {
				levelsGamma = levelsGamma * 0.90;
			}
			levelsGamma = Math.max(0.25, Math.min(4.0, levelsGamma));
			imagelayer.adjustLevels(inBlack, inWhite, levelsGamma, outBlack, outWhite);
		} catch (e) {}
		doc.activeChannels = restoreChannels;
	}

	function applyChroma(chromaScale) {
		var chromaLayer = imagelayer.duplicate();
		chromaLayer.name = "Preflash Chroma";
		doc.activeLayer = chromaLayer;

		// Strong, linear chroma ramp for predictable behavior.
		var targetA = preflashColor.lab.a;
		var targetB = preflashColor.lab.b;
		var colorAmountNorm = Math.max(0, Math.min(2, (preflash_color_amount_setting || 0) / 100));
		// Mild safeguard: softly roll off very high-strength chroma pushes.
		var highStrengthRolloff = 1 - 0.28 * Math.pow(strengthNorm, 1.35);
		if (highStrengthRolloff < 0.65) highStrengthRolloff = 0.65;
		var deltaFactor = chromaScale * colorAmountNorm * highStrengthRolloff;
		var deltaA = Math.round(targetA * deltaFactor);
		var deltaB = Math.round(targetB * deltaFactor);

		// Mild safeguard: cap absolute a/b channel moves to prevent harsh shifts.
		var maxDeltaAB = 44;
		deltaA = Math.max(-maxDeltaAB, Math.min(maxDeltaAB, deltaA));
		deltaB = Math.max(-maxDeltaAB, Math.min(maxDeltaAB, deltaB));

		function shiftedCurve(delta) {
			// Paper-like chroma response: strongest in lower mids/mids,
			// reduced in deep shadows and especially near highlights.
			// Stronger high-strength behavior: progressively desaturate shadows.
			var shadowAtten = Math.max(0.10, 1 - 0.90 * Math.pow(strengthNorm, 1.45));
			var lowerMidAtten = Math.max(0.30, 1 - 0.70 * Math.pow(strengthNorm, 1.25));
			var midAtten = Math.max(0.78, 1 - 0.22 * strengthNorm);
			var d0 = Math.round(delta * 0.30 * shadowAtten);
			var d64 = Math.round(delta * (0.72 + 0.08 * paperResponseCoverage) * lowerMidAtten);
			var d128 = Math.round(delta * 1.00 * midAtten);
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
	// Step 1: add chroma in Lab safely by shifting a/b channels (relative move from current values).
	applyChroma(tone.chromaScale);

	doc.activeChannels = savedChannels;

	// Step 2: apply the Lightness curve after chroma.
	// Endpoint mapping is baked into the Lightness curve points above.
	applyLightness(tone.curvePoints);

	// Convert back to RGB for the remaining pipeline stages.
	doc.changeMode(ChangeMode.RGB);

	// Step 3: manipulate endpoints with Levels (input/output/gamma) after RGB conversion.
	applyEndpointLevels(tone.p128);

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
var runtimesettings = getSettings();
if (runtimesettings) {
	processSettings(runtimesettings);
} else {
	executeScript = false;
}

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

		// Preflash
		applyPreflash(wholeMaskCoverage, paperResponseCoverage);

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

		// Desaturation stage disabled; preflash color amount now controls chroma intensity directly.
		
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