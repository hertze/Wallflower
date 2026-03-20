// W A L L F L O W E R
//
// Version 2 beta
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Default settings ------------------------------------------------------------

var pre_flash_r = 235;
var pre_flash_g = 232;
var pre_flash_b = 225;
var pre_flash_strength = 30;
var blur_radius = 3;
var auto_adjust_preflash = true;
var preserve_whitepoint = true;
var whitepoint_restore_strength = 20; // 1–100: percentage to restore the original white point
var preserve_blackpoint = true;
var blackpoint_restore_strength = 50; // 1–100: percentage to restore the original black point
var preflash_color_amount_setting = 30; // 0-200: preflash chroma amount (100 = current baseline)
var whole_mask_reach = 255; // how far the whole mask extends (lower = more localized to shadows)
var whole_mask_gamma = 0.9; // gamma to bias whole mask when building (lower = more midtone coverage)

// Hard coded settings for the algorithm (not exposed in the UI)
var lightness_channel_name = "Lightness"; // name of the lightness channel in Lab mode
var microSmooth_strength = 50; // opacity percentage for the micro-smoothing layer (0..100)
var preflash_shadow_threshold = 64; // luminance threshold considered 'shadow'
var highlight_mask_gamma = 0.9; // gamma to bias highlight mask when building (lower = more midtone coverage)
var paper_response_mask_gamma = 0.65; // stronger toe weighting for print-response smoothing
var paper_response_mask_range_end = 192; // extend into lower mids but keep upper mids/highlights cleaner


// Preflash color presets (name + RGB). Selecting a preset will populate the RGB fields below.
var _presets = [
	{ name: "Cream", rgb: [235,232,225] },
	{ name: "Yellow", rgb: [235,220,170] },
	{ name: "Tan", rgb: [220,205,160] },
	{ name: "Amber", rgb: [225,170,95] },
	{ name: "Peach", rgb: [235,185,165] },
	{ name: "Magenta", rgb: [220,150,160] },
	{ name: "Maroon", rgb: [170,70,70] },
	{ name: "Beige", rgb: [205,190,170] },
	{ name: "Gray", rgb: [210,215,225] },
	{ name: "Cyan", rgb: [150,170,200] },
	{ name: "Teal", rgb: [155,185,185] },
	{ name: "Aqua", rgb: [170,200,200] },
	{ name: "Indigo", rgb: [130,150,180] }
];

var save = false;
		

// ---------------------------------------------------------------------


// DO NOT EDIT BELOW THIS LINE -----------------------------------------

/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource>
<name>Wallflower 2</name>
<menu>automate</menu>
<enableinfo>true</enableinfo>
<eventid>1f4b8c3a-6d7e-4f2b-9c8a-2e3d4f5a6b7c</eventid>
<terminology><![CDATA[<< /Version 1
	/Events <<
	/1f4b8c3a-6d7e-4f2b-9c8a-2e3d4f5a6b7c [(Wallflower 2) <<
	/preflashr [(PreflashR) /integer]
	/preflashg [(PreflashG) /integer]
	/preflashb [(PreflashB) /integer]
	/preflashstrength [(PreflashStrength) /integer]
	/blurradius [(BlurRadius) /integer]
	/savestatus [(Save) /boolean]
	/savewhitepoint [(SaveWhitePoint) /boolean]
	/saveblackpoint [(SaveBlackPoint) /boolean]
	/preflashcoloramt [(PreflashColorAmt) /integer]
	/wholemaskgamma [(WholeMaskGamma) /string]
	/wholemaskreach [(WholeMaskReach) /integer]
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
	dialog.text = "Wallflower 2";
	dialog.orientation = "column";
	dialog.alignChildren = ["fill", "top"];
	dialog.spacing = 14;
	dialog.margins = 30;

	settings = settings || {};
	runmode = runmode || "normal";

	// Baseline L for Lab conversions (derived from initial/preexisting RGB)
	var _initR = (settings.preflashr !== undefined ? settings.preflashr : pre_flash_r);
	var _initG = (settings.preflashg !== undefined ? settings.preflashg : pre_flash_g);
	var _initB = (settings.preflashb !== undefined ? settings.preflashb : pre_flash_b);
	var _baselineColor = new SolidColor();
	_baselineColor.rgb.red = _initR;
	_baselineColor.rgb.green = _initG;
	_baselineColor.rgb.blue = _initB;
	var baselineL = _baselineColor.lab.l;

	// Helper: update the small color swatch in the UI
	function setSwatchRGB(r, g, b) {
		try {
			var rr = Math.max(0, Math.min(255, Math.round(r || 0)));
			var gg = Math.max(0, Math.min(255, Math.round(g || 0)));
			var bb = Math.max(0, Math.min(255, Math.round(b || 0)));
			if (dialog && dialog.colorSwatch && dialog.colorSwatch.graphics) {
				dialog.colorSwatch.graphics.backgroundColor = dialog.colorSwatch.graphics.newBrush(dialog.colorSwatch.graphics.BrushType.SOLID_COLOR, [rr/255, gg/255, bb/255]);
			}
		} catch (e) {}
	}

	// Helper: update swatch and RGB fields from brightness percent (0-200)
	function updateSwatchFromBrightness(brightPct) {
		try {
			// Simply refresh the preview using current angle/chroma but taking brightness into account
			var ang = parseInt(dialog.preflashAngle && dialog.preflashAngle.text ? dialog.preflashAngle.text : 0, 10) || 0;
			try { updateColorFromAngle(ang); } catch(e) {}
		} catch (e) {}
	}

	// Helper: when user types RGB manually, compute Lab and update angle/chroma/brightness sliders
	function syncRGBtoSliders(r, g, b) {
		try {
			var tmp = new SolidColor(); tmp.rgb.red = r; tmp.rgb.green = g; tmp.rgb.blue = b;
			var a = tmp.lab.a; var bb = tmp.lab.b; var L = tmp.lab.l;
			var ang = Math.atan2(bb, a) * 180.0 / Math.PI; if (isNaN(ang)) ang = 0; ang = Math.round((ang + 360) % 360);
			var chroma = Math.sqrt(a*a + bb*bb);
			var baseTargetChroma = 80;
			var pct = Math.round((chroma / baseTargetChroma) * 100);
			if (isNaN(pct)) pct = 0; if (pct < 0) pct = 0; if (pct > 200) pct = 200;
			var defaultStrength = (settings.preflashstrength !== undefined ? settings.preflashstrength : pre_flash_strength);
			var brightPct = defaultStrength;
			if (baselineL && baselineL > 0) brightPct = Math.round(defaultStrength * (L / baselineL));
			if (isNaN(brightPct)) brightPct = defaultStrength;
			if (brightPct < 0) brightPct = 0; if (brightPct > 200) brightPct = 200;
			// Suspend handlers to avoid recursive updates
			var a1,s1,s1c,a2,s2,s2c,a3,s3,s3c;
			try {
				a1 = dialog.preflashAngle.onChange; s1 = dialog.preflashAngleSlider.onChange; s1c = dialog.preflashAngleSlider.onChanging;
				a2 = dialog.preflashColorAmount.onChange; s2 = dialog.preflashColorAmountSlider.onChange; s2c = dialog.preflashColorAmountSlider.onChanging;
				a3 = dialog.preflashStrength.onChange; s3 = dialog.preflashStrengthSlider.onChange; s3c = dialog.preflashStrengthSlider.onChanging;
				try { dialog.preflashAngle.onChange = null; } catch(e) {}
				try { dialog.preflashAngleSlider.onChange = null; dialog.preflashAngleSlider.onChanging = null; } catch(e) {}
				try { dialog.preflashColorAmount.onChange = null; } catch(e) {}
				try { dialog.preflashColorAmountSlider.onChange = null; dialog.preflashColorAmountSlider.onChanging = null; } catch(e) {}
				try { dialog.preflashStrength.onChange = null; } catch(e) {}
				try { dialog.preflashStrengthSlider.onChange = null; dialog.preflashStrengthSlider.onChanging = null; } catch(e) {}
			} catch(e) {}
			// Apply values
			try { dialog.preflashAngleSlider.value = ang; } catch(e) {}
			try { dialog.preflashAngle.text = String(ang); } catch(e) {}
			try { dialog.preflashColorAmountSlider.value = pct; } catch(e) {}
			try { dialog.preflashColorAmount.text = String(pct); } catch(e) {}
			try { dialog.preflashStrengthSlider.value = brightPct; } catch(e) {}
			try { dialog.preflashStrength.text = String(brightPct); } catch(e) {}
			// Restore handlers
			try { dialog.preflashAngle.onChange = a1; dialog.preflashAngleSlider.onChange = s1; dialog.preflashAngleSlider.onChanging = s1c; } catch(e) {}
			try { dialog.preflashColorAmount.onChange = a2; dialog.preflashColorAmountSlider.onChange = s2; dialog.preflashColorAmountSlider.onChanging = s2c; } catch(e) {}
			try { dialog.preflashStrength.onChange = a3; dialog.preflashStrengthSlider.onChange = s3; dialog.preflashStrengthSlider.onChanging = s3c; } catch(e) {}
		} catch(e) {}
		return ang;
	}

 	var preflashPanel = dialog.add("panel", undefined, "Preflash Color");
 	preflashPanel.orientation = "column";
 	preflashPanel.alignChildren = ["fill", "top"];
	preflashPanel.margins = 14;
	preflashPanel.spacing = 10;



	// Build preset dropdown list (with placeholder)
	var presetNames = [];
	presetNames.push("--Color Presets"); // placeholder at index 0
	for (var pi = 0; pi < _presets.length; pi++) presetNames.push(_presets[pi].name);
	var presetDropdown = preflashPanel.add("dropdownlist", undefined, presetNames);
	try {
		presetDropdown.preferredSize = [260, 30];
		presetDropdown.margins = [8,6,8,6];
		// Use a slightly larger font so items render with increased row height
		try { presetDropdown.graphics.font = ScriptUI.newFont(presetDropdown.graphics.font.name, presetDropdown.graphics.font.style, 13); } catch(e) {}
	} catch(e) {}
	presetDropdown.selection = 0; // keep placeholder selected by default

// Hue angle control (0-360°) — placed after the preset dropdown
var angleGroup = preflashPanel.add("group");
angleGroup.orientation = "row";
angleGroup.spacing = 6;
angleGroup.alignment = ["fill", "top"];
angleGroup.add("statictext", undefined, "Hue Angle");
dialog.preflashAngle = angleGroup.add("edittext", undefined, "0");
dialog.preflashAngle.characters = 4;
try { dialog.preflashAngle.margins = [0,0,0,0]; } catch(e) {}
dialog.preflashAngleSlider = angleGroup.add("slider", undefined, 0, 0, 360);
try { dialog.preflashAngleSlider.preferredSize = [220, 18]; } catch(e) {}
angleGroup.add("statictext", undefined, "°");

// Preflash Chroma (moved to follow Hue Angle)
var chromaGroup = preflashPanel.add("group");
chromaGroup.orientation = "row";
chromaGroup.spacing = 6;
chromaGroup.alignment = ["fill", "top"];
chromaGroup.add("statictext", undefined, "Preflash Chroma");
dialog.preflashColorAmount = chromaGroup.add("edittext", undefined, (settings.preflashcoloramt !== undefined ? settings.preflashcoloramt : preflash_color_amount_setting).toString());
dialog.preflashColorAmount.characters = 4;
try { dialog.preflashColorAmount.margins = [0,0,0,0]; } catch(e) {}
// Slider for Preflash Chroma (0-200)
dialog.preflashColorAmountSlider = chromaGroup.add("slider", undefined, (settings.preflashcoloramt !== undefined ? settings.preflashcoloramt : preflash_color_amount_setting), 0.0, 100.0);
try { dialog.preflashColorAmountSlider.preferredSize = [220, 18]; } catch(e) {}
chromaGroup.add("statictext", undefined, "%");

// Sync slider <-> edittext
dialog.preflashColorAmountSlider.onChanging = dialog.preflashColorAmountSlider.onChange = function() {
	var v = Math.round(this.value * 100) / 100;
	dialog.preflashColorAmount.text = String(Math.round(v));
	// Update RGB preview from current angle when chroma changes
	try { updateColorFromAngle(parseInt(dialog.preflashAngle.text, 10) || 0); } catch(e) {}
};
dialog.preflashColorAmount.onChange = function() {
	var n = parseFloat(this.text);
	if (isNaN(n)) n = preflash_color_amount_setting;
	if (n < 0) n = 0;
	if (n > 200) n = 200;
	dialog.preflashColorAmountSlider.value = n;
	this.text = String(Math.round(n));
	try { updateColorFromAngle(parseInt(dialog.preflashAngle.text, 10) || 0); } catch(e) {}
};

	// Preflash Brightness (placed below Chroma)
	var strengthGroup = preflashPanel.add("group");
	strengthGroup.orientation = "row";
	strengthGroup.spacing = 6;
	strengthGroup.alignment = ["fill", "top"];
	strengthGroup.add("statictext", undefined, "Preflash Brightness");
	dialog.preflashStrength = strengthGroup.add("edittext", undefined, (settings.preflashstrength !== undefined ? settings.preflashstrength : pre_flash_strength).toString());
	dialog.preflashStrength.characters = 4;
	try { dialog.preflashStrength.margins = [0,0,0,0]; } catch(e) {}
	// Slider for Preflash Brightness (0-200)
	dialog.preflashStrengthSlider = strengthGroup.add("slider", undefined, (settings.preflashstrength !== undefined ? settings.preflashstrength : pre_flash_strength), 0.0, 100.0);
	try { dialog.preflashStrengthSlider.preferredSize = [220, 18]; } catch(e) {}
	strengthGroup.add("statictext", undefined, "%");

	// Sync slider <-> edittext
	dialog.preflashStrengthSlider.onChanging = dialog.preflashStrengthSlider.onChange = function() {
		var v = Math.round(this.value * 100) / 100;
		dialog.preflashStrength.text = String(Math.round(v));
		// Update preview using unified logic
		try { updateSwatchFromBrightness(v); } catch(e) {}
	};
	dialog.preflashStrength.onChange = function() {
		var n = parseFloat(this.text);
		if (isNaN(n)) n = pre_flash_strength;
		if (n < 0) n = 0;
		if (n > 200) n = 200;
		dialog.preflashStrengthSlider.value = n;
		this.text = String(Math.round(n));
		try { updateSwatchFromBrightness(n); } catch(e) {}
	};

// Helper: update RGB fields from an angle and current chroma setting
function updateColorFromAngle(angleDeg) {
	try {
		var aRad = (angleDeg % 360) * Math.PI / 180.0;
		var colorAmountVal = preflash_color_amount_setting;
		try { colorAmountVal = parseFloat(dialog.preflashColorAmount.text); } catch(e) {}
		if (isNaN(colorAmountVal)) colorAmountVal = preflash_color_amount_setting;
		var colorAmountNorm = Math.max(0, Math.min(2, colorAmountVal / 100));
		var baseTargetChroma = 80;
		var targetChroma = baseTargetChroma * colorAmountNorm;

	        // Determine target Lab L from current brightness setting so brightness and chroma combine
	        var brightPct = pre_flash_strength;
	        try { brightPct = parseFloat(dialog.preflashStrength.text); } catch(e) {}
	        if (isNaN(brightPct)) brightPct = pre_flash_strength;
	        var defaultStrength = (settings.preflashstrength !== undefined ? settings.preflashstrength : pre_flash_strength);
	        if (!defaultStrength || defaultStrength <= 0) defaultStrength = pre_flash_strength;
	        var Ltarget = baselineL * (brightPct / defaultStrength);
	        if (isNaN(Ltarget)) Ltarget = baselineL;
	        if (Ltarget < 0) Ltarget = 0;
	        if (Ltarget > 100) Ltarget = 100;

			// Compute a/b from angle and targetChroma, but reduce chroma if Lab->RGB is out-of-gamut
			var targetChromaAdj = targetChroma;
			var tmpCol = new SolidColor();
			var a = 0, b = 0;
			var attempts = 0;
			var maxAttempts = 30;
			while (attempts < maxAttempts) {
				a = Math.round(Math.cos(aRad) * targetChromaAdj);
				b = Math.round(Math.sin(aRad) * targetChromaAdj);
				tmpCol.lab.l = Ltarget;
				tmpCol.lab.a = a;
				tmpCol.lab.b = b;
				// Check if RGB is inside gamut
				try {
					var rr = Math.round(tmpCol.rgb.red);
					var gg = Math.round(tmpCol.rgb.green);
					var bb = Math.round(tmpCol.rgb.blue);
					if (rr >= 0 && rr <= 255 && gg >= 0 && gg <= 255 && bb >= 0 && bb <= 255) {
						break;
					}
				} catch (e) {
					// conversion may throw; fall back to reducing chroma
				}
				// reduce chroma and retry
				targetChromaAdj *= 0.92;
				attempts++;
			}
		// Populate RGB fields (clamped/rounded)
		dialog.preflashR.text = String(Math.round(tmpCol.rgb.red));
		dialog.preflashG.text = String(Math.round(tmpCol.rgb.green));
		dialog.preflashB.text = String(Math.round(tmpCol.rgb.blue));
		// Update swatch
		setSwatchRGB(tmpCol.rgb.red, tmpCol.rgb.green, tmpCol.rgb.blue);
	} catch (e) {}
}

// Angle slider ↔ edittext
dialog.preflashAngleSlider.onChanging = dialog.preflashAngleSlider.onChange = function() {
	var v = Math.round(this.value);
	dialog.preflashAngle.text = v.toString();
	updateColorFromAngle(v);
};
dialog.preflashAngle.onChange = function() {
	var n = parseInt(this.text, 10);
	if (isNaN(n)) n = 0;
	if (n < 0) n = 0;
	if (n > 360) n = 360;
	dialog.preflashAngleSlider.value = n;
	updateColorFromAngle(n);
};

	// Row containing the swatch and the RGB fields side-by-side, vertically centered
	var swatchRow = preflashPanel.add("group");
	swatchRow.orientation = "row";
	swatchRow.spacing = 10;
	swatchRow.alignment = ["fill", "top"];
	// Swatch container (left)
	var swatchContainer = swatchRow.add("group");
	swatchContainer.orientation = "column";
	try { swatchContainer.alignment = ["left", "center"]; } catch(e) {}
	try { swatchContainer.margins = [0,0,0,0]; } catch(e) {}
	try {
		dialog.colorSwatch = swatchContainer.add("panel", undefined, "");
		dialog.colorSwatch.preferredSize = [50, 50];
		try { dialog.colorSwatch.minimumSize = [50,50]; } catch(e) {}
		try { dialog.colorSwatch.alignment = ["left", "center"]; } catch(e) {}
		try {
			dialog.colorSwatch.graphics.backgroundColor = dialog.colorSwatch.graphics.newBrush(dialog.colorSwatch.graphics.BrushType.SOLID_COLOR, [(settings.preflashr !== undefined ? settings.preflashr : pre_flash_r)/255, (settings.preflashg !== undefined ? settings.preflashg : pre_flash_g)/255, (settings.preflashb !== undefined ? settings.preflashb : pre_flash_b)/255]);
		} catch(e) {}
	} catch(e) {}
	// RGB fields container (right) — stacked vertically, centered
	var rgbContainer = swatchRow.add("group");
	rgbContainer.orientation = "column";
	rgbContainer.spacing = 6;
	try { rgbContainer.alignment = ["left", "center"]; } catch(e) {}
	try { rgbContainer.margins = [0,0,0,0]; } catch(e) {}
	
	var rgbFieldsRow = rgbContainer.add("group");
	rgbFieldsRow.orientation = "row";
	rgbFieldsRow.spacing = 6;
	rgbFieldsRow.alignment = ["left", "center"];
	rgbFieldsRow.add("statictext", undefined, "R:");
	dialog.preflashR = rgbFieldsRow.add("edittext", undefined, (settings.preflashr !== undefined ? settings.preflashr : pre_flash_r).toString());
	dialog.preflashR.characters = 3;
	try { dialog.preflashR.margins = [0,0,0,0]; } catch(e) {}
	rgbFieldsRow.add("statictext", undefined, "G:");
	dialog.preflashG = rgbFieldsRow.add("edittext", undefined, (settings.preflashg !== undefined ? settings.preflashg : pre_flash_g).toString());
	dialog.preflashG.characters = 3;
	try { dialog.preflashG.margins = [0,0,0,0]; } catch(e) {}
	rgbFieldsRow.add("statictext", undefined, "B:");
	dialog.preflashB = rgbFieldsRow.add("edittext", undefined, (settings.preflashb !== undefined ? settings.preflashb : pre_flash_b).toString());
	dialog.preflashB.characters = 3;
	try { dialog.preflashB.margins = [0,0,0,0]; } catch(e) {}

	// Update swatch when user edits RGB fields manually
	dialog.preflashR.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = pre_flash_r;
		n = Math.max(0, Math.min(255, n));
		this.text = String(n);
		try { setSwatchRGB(n, parseInt(dialog.preflashG.text,10) || 0, parseInt(dialog.preflashB.text,10) || 0); } catch(e) {}
		// Update sliders to match manual RGB
		try { syncRGBtoSliders(n, parseInt(dialog.preflashG.text,10) || 0, parseInt(dialog.preflashB.text,10) || 0); } catch(e) {}
	};
	dialog.preflashG.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = pre_flash_g;
		n = Math.max(0, Math.min(255, n));
		this.text = String(n);
		try { setSwatchRGB(parseInt(dialog.preflashR.text,10) || 0, n, parseInt(dialog.preflashB.text,10) || 0); } catch(e) {}
		try { syncRGBtoSliders(parseInt(dialog.preflashR.text,10) || 0, n, parseInt(dialog.preflashB.text,10) || 0); } catch(e) {}
	};
	dialog.preflashB.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = pre_flash_b;
		n = Math.max(0, Math.min(255, n));
		this.text = String(n);
		try { setSwatchRGB(parseInt(dialog.preflashR.text,10) || 0, parseInt(dialog.preflashG.text,10) || 0, n); } catch(e) {}
		try { syncRGBtoSliders(parseInt(dialog.preflashR.text,10) || 0, parseInt(dialog.preflashG.text,10) || 0, n); } catch(e) {}
	};

	// Color preview swatch (placeholder removed here — created inline in `rgbGroup`)

	// After RGB fields exist, try to initialize the preset dropdown to match the current RGB.
	(function initPresetSelection() {
		var curR = coerceInteger(settings.preflashr !== undefined ? settings.preflashr : pre_flash_r, pre_flash_r, 0, 255);
		var curG = coerceInteger(settings.preflashg !== undefined ? settings.preflashg : pre_flash_g, pre_flash_g, 0, 255);
		var curB = coerceInteger(settings.preflashb !== undefined ? settings.preflashb : pre_flash_b, pre_flash_b, 0, 255);
		for (var i = 0; i < _presets.length; i++) {
			var p = _presets[i].rgb;
			if (p[0] === curR && p[1] === curG && p[2] === curB) {
				// presets start at dropdown index 1 (index 0 is the placeholder)
				presetDropdown.selection = i + 1;
				return;
			}
		}
		// leave placeholder selected if no match
	})();
	// Ensure placeholder is shown by default (do not auto-select a preset on launch)
	try { presetDropdown.selection = 0; } catch(e) {}

	// Wire preset selection to populate the RGB edit fields when the user changes it.
	presetDropdown.onChange = function() {
		try {
			var sel = presetDropdown.selection.index;
			if (sel <= 0) return; // placeholder selected — do nothing
			var rgb = _presets[sel - 1].rgb; // presets are offset by 1
			dialog.preflashR.text = String(rgb[0]);
			dialog.preflashG.text = String(rgb[1]);
			dialog.preflashB.text = String(rgb[2]);
			// Update swatch when a preset is chosen
			try { setSwatchRGB(rgb[0], rgb[1], rgb[2]); } catch(e) {}
			// Sync the preset RGB into the sliders (angle, chroma, brightness)
			try {
				var ang = syncRGBtoSliders(rgb[0], rgb[1], rgb[2]);
				try { updateColorFromAngle(ang); } catch(e) {}
			} catch(e) {}
		} catch(e) {}
	};

	// Initialize swatch and sliders from the current RGB fields (keep defaults/settings)
	try {
		var r0 = parseInt(dialog.preflashR.text, 10);
		var g0 = parseInt(dialog.preflashG.text, 10);
		var b0 = parseInt(dialog.preflashB.text, 10);
		if (isNaN(r0)) r0 = pre_flash_r;
		if (isNaN(g0)) g0 = pre_flash_g;
		if (isNaN(b0)) b0 = pre_flash_b;
		try { setSwatchRGB(r0, g0, b0); } catch (e) {}
		try { syncRGBtoSliders(r0, g0, b0); } catch (e) {}
	} catch (e) {}

	// (Preflash Brightness controls will be placed below Chroma)


	// Whole Mask Range (0 - 255)
	// Masking panel (contains Range and Gamma controls)
	var maskingPanel = dialog.add("panel", undefined, "Preflash Masking");
	maskingPanel.orientation = "column";
	maskingPanel.alignChildren = ["fill", "top"];
	maskingPanel.margins = 14;

	var rangeGroup = maskingPanel.add("group");
	rangeGroup.orientation = "row";
	rangeGroup.spacing = 6;
	rangeGroup.alignment = ["fill", "top"];
	rangeGroup.add("statictext", undefined, "Mask Range");
	var initialReach = (settings.wholemaskreach !== undefined ? coerceInteger(settings.wholemaskreach, whole_mask_reach, 0, 255) : whole_mask_reach);
	if (isNaN(initialReach)) initialReach = whole_mask_reach;
	dialog.wholeMaskReachText = rangeGroup.add("edittext", undefined, String(initialReach));
	dialog.wholeMaskReachText.characters = 4;
	try { dialog.wholeMaskReachText.margins = [0,0,0,0]; } catch(e) {}
	dialog.wholeMaskReach = rangeGroup.add("slider", undefined, initialReach, 0, 255);
	try { dialog.wholeMaskReach.preferredSize = [220, 18]; } catch(e) {}

	// Sync slider <-> edittext (integer)
	dialog.wholeMaskReach.onChanging = dialog.wholeMaskReach.onChange = function() {
		var v = Math.round(this.value);
		dialog.wholeMaskReachText.text = String(v);
	};
	dialog.wholeMaskReachText.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = whole_mask_reach;
		if (n < 0) n = 0;
		if (n > 255) n = 255;
		dialog.wholeMaskReach.value = n;
		this.text = String(n);
	};

	// Whole Mask Gamma slider (0.0 - 2.0)
	var gammaGroup = maskingPanel.add("group");
	gammaGroup.orientation = "row";
	gammaGroup.spacing = 6;
	gammaGroup.alignment = ["fill", "top"];
	gammaGroup.add("statictext", undefined, "Mask Gamma");
	var initialGamma = (settings.wholemaskgamma !== undefined ? parseFloat(settings.wholemaskgamma) : whole_mask_gamma);
	if (isNaN(initialGamma)) initialGamma = whole_mask_gamma;
	dialog.wholeMaskGammaText = gammaGroup.add("edittext", undefined, initialGamma.toFixed(2));
	dialog.wholeMaskGammaText.characters = 5;
	try { dialog.wholeMaskGammaText.margins = [0,0,0,0]; } catch(e) {}
	dialog.wholeMaskGamma = gammaGroup.add("slider", undefined, initialGamma, 0.5, 1.5);
	try { dialog.wholeMaskGamma.preferredSize = [220, 18]; } catch(e) {}

	// Sync slider <-> edittext
	dialog.wholeMaskGamma.onChanging = dialog.wholeMaskGamma.onChange = function() {
		var v = Math.round(this.value * 100) / 100;
		dialog.wholeMaskGammaText.text = v.toFixed(2);
	};
	dialog.wholeMaskGammaText.onChange = function() {
		var n = parseFloat(this.text);
		if (isNaN(n)) n = whole_mask_gamma;
		if (n < 0) n = 0;
		if (n > 2.0) n = 2.0;
		dialog.wholeMaskGamma.value = n;
		this.text = (Math.round(n * 100) / 100).toFixed(2);
	};

 	var histogramBlurPanel = dialog.add("panel", undefined, "Overall Histogram and Softening");
 	histogramBlurPanel.orientation = "column";
 	histogramBlurPanel.alignChildren = ["fill", "top"];
	histogramBlurPanel.margins = 14;
	histogramBlurPanel.spacing = 10;

	// Keep White Point checkbox + restore strength field
	var savewhiteGroup = histogramBlurPanel.add("group");
	savewhiteGroup.orientation = "row";
	savewhiteGroup.spacing = 6;
	savewhiteGroup.alignment = ["fill", "top"];
	dialog.savewhite = savewhiteGroup.add("checkbox", undefined, "Preserve White Point");
	dialog.whiteRestoreAmount = savewhiteGroup.add("edittext", undefined, undefined, { name: "whiteRestoreAmount" });
	dialog.whiteRestoreAmount.characters = 4;
	try { dialog.whiteRestoreAmount.margins = [0,0,0,0]; } catch(e) {}
	try { dialog.whiteRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	// Slider for Preserve White Point restore strength (0-100)
	dialog.whiteRestoreSlider = savewhiteGroup.add("slider", undefined, (settings.whiterestoreamt !== undefined ? settings.whiterestoreamt : whitepoint_restore_strength), 0.0, 100.0);
	try { dialog.whiteRestoreSlider.preferredSize = [220, 18]; } catch(e) {}

	// Sync slider <-> edittext
	dialog.whiteRestoreSlider.onChanging = dialog.whiteRestoreSlider.onChange = function() {
		var v = Math.round(this.value);
		dialog.whiteRestoreAmount.text = v.toString();
	};
	dialog.whiteRestoreAmount.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = whitepoint_restore_strength;
		if (n < 0) n = 0;
		if (n > 100) n = 100;
		dialog.whiteRestoreSlider.value = n;
		this.text = n.toString();
	};
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
	dialog.saveblack = saveblackGroup.add("checkbox", undefined, "Preserve Black Point");
	dialog.blackRestoreAmount = saveblackGroup.add("edittext", undefined, undefined, { name: "blackRestoreAmount" });
	dialog.blackRestoreAmount.characters = 4;
	try { dialog.blackRestoreAmount.margins = [0,0,0,0]; } catch(e) {}
	try { dialog.blackRestoreAmount.margins = [0, 0, 0, 0]; } catch(e) {}
	// Slider for Preserve Black Point restore strength (0-100)
	dialog.blackRestoreSlider = saveblackGroup.add("slider", undefined, (settings.blackrestoreamt !== undefined ? settings.blackrestoreamt : blackpoint_restore_strength), 0.0, 100.0);
	try { dialog.blackRestoreSlider.preferredSize = [220, 18]; } catch(e) {}
	var blackPctLabel = saveblackGroup.add("statictext", undefined, "%");

	// Sync slider <-> edittext
	dialog.blackRestoreSlider.onChanging = dialog.blackRestoreSlider.onChange = function() {
		var v = Math.round(this.value);
		dialog.blackRestoreAmount.text = v.toString();
	};
	dialog.blackRestoreAmount.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = blackpoint_restore_strength;
		if (n < 0) n = 0;
		if (n > 100) n = 100;
		dialog.blackRestoreSlider.value = n;
		this.text = n.toString();
	};
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
	blurGroup.add("statictext", undefined, "Softening amount");
	dialog.blurRadius = blurGroup.add("edittext", undefined, (settings.blurradius !== undefined ? settings.blurradius : blur_radius).toString());
	dialog.blurRadius.characters = 4;
	try { dialog.blurRadius.margins = [0,0,0,0]; } catch(e) {}
	// Slider for Softening amount (0-10) — integer steps
	var initialBlur = (settings.blurradius !== undefined ? parseInt(settings.blurradius, 10) : blur_radius);
	if (isNaN(initialBlur)) initialBlur = blur_radius;
	dialog.blurRadiusSlider = blurGroup.add("slider", undefined, initialBlur, 0, 10);
	try { dialog.blurRadiusSlider.preferredSize = [220, 18]; } catch(e) {}

	// Sync slider <-> edittext (integer)
	dialog.blurRadiusSlider.onChanging = dialog.blurRadiusSlider.onChange = function() {
		var v = Math.round(this.value);
		dialog.blurRadius.text = String(v);
	};
	dialog.blurRadius.onChange = function() {
		var n = parseInt(this.text, 10);
		if (isNaN(n)) n = blur_radius;
		if (n < 0) n = 0;
		if (n > 10) n = 10;
		dialog.blurRadiusSlider.value = n;
		this.text = String(n);
	};

	dialog.savestatus = dialog.add("checkbox", undefined, "Save and Close When Done");
	dialog.savestatus.value = coerceBoolean(settings.savestatus, save);

	var buttonSpacer = dialog.add("statictext", undefined, "");
	buttonSpacer.preferredSize = [1, 10];

	var dialogSubmitted = false;

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
		applyBtn.text = "Run with These Settings";
		applyBtn.onClick = function () {
			dialogSubmitted = true;
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
	if (runmode !== "edit" && !dialogSubmitted) return null;

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
		"wholemaskreach": coerceInteger(dialog.wholeMaskReachText.text, whole_mask_reach, 0, 255),
		"wholemaskgamma": parseFloat(dialog.wholeMaskGammaText.text),
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
			d.putInteger(stringIDToTypeID('wholemaskreach'), result.wholemaskreach);
			// Store wholemaskgamma as a string to preserve float precision
			d.putString(stringIDToTypeID('wholemaskgamma'), String((result.wholemaskgamma !== undefined ? result.wholemaskgamma : whole_mask_gamma)));
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
		// Read wholemaskreach (stored as integer)
		var wholemaskreach = undefined;
		try { wholemaskreach = app.playbackParameters.getInteger(stringIDToTypeID('wholemaskreach')); } catch(e) {
			try { wholemaskreach = app.playbackParameters.getString(stringIDToTypeID('wholemaskreach')); } catch(ee) { wholemaskreach = undefined; }
		}
		wholemaskreach = normalizePercent(wholemaskreach, whole_mask_reach, 0, 255);
		// Read wholemaskgamma (stored as integer*100 when saved from dialog)
		var wholemaskgamma = undefined;
		try { wholemaskgamma = app.playbackParameters.getInteger(stringIDToTypeID('wholemaskgamma')); } catch(e) {
			try { wholemaskgamma = app.playbackParameters.getString(stringIDToTypeID('wholemaskgamma')); } catch(ee) { wholemaskgamma = undefined; }
		}
		var wholemaskgammaFloat = undefined;
		if (wholemaskgamma !== undefined && wholemaskgamma !== null) {
			var _wm = parseFloat(wholemaskgamma);
			if (!isNaN(_wm)) {
				// If stored as integer (e.g. 100 for 1.00), scale down
				if (_wm > 4.0) _wm = _wm / 100.0;
				wholemaskgammaFloat = Math.max(0.0, Math.min(4.0, _wm));
			}
		}
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
					wholemaskreach: (wholemaskreach !== undefined ? wholemaskreach : whole_mask_reach),
					wholemaskgamma: (wholemaskgammaFloat !== undefined ? wholemaskgammaFloat : whole_mask_gamma),
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
				d.putInteger(stringIDToTypeID('wholemaskreach'), result.wholemaskreach);
				// Store wholemaskgamma as a string to preserve float precision
				d.putString(stringIDToTypeID('wholemaskgamma'), String((result.wholemaskgamma !== undefined ? result.wholemaskgamma : whole_mask_gamma)));
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
					"wholemaskreach": (wholemaskreach !== undefined ? wholemaskreach : undefined),
					"blackrestoreamt": blackrestoreamt,
				"whiterestoreamt": whiterestoreamt,
				"wholemaskgamma": (wholemaskgammaFloat !== undefined ? wholemaskgammaFloat : undefined)
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

				// Apply whole mask gamma if provided (float, expected 0.0 - 4.0; clamp to safe range)
				if (runtimesettings.wholemaskgamma !== undefined && runtimesettings.wholemaskgamma !== null) {
					var _wg = parseFloat(runtimesettings.wholemaskgamma);
					if (!isNaN(_wg)) whole_mask_gamma = Math.max(0.25, Math.min(4.0, _wg));
				}

						// Apply whole mask reach if provided (integer 0-255)
						if (runtimesettings.wholemaskreach !== undefined && runtimesettings.wholemaskreach !== null) {
							whole_mask_reach = coerceInteger(runtimesettings.wholemaskreach, whole_mask_reach, 0, 255);
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
function estimateShadowRatio(threshold) {
// Use channel histograms to estimate the fraction of dark pixels.
// We approximate dark pixels as those with channel values below `threshold`
// across R/G/B by averaging per-channel cumulative counts.
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
	var ratio = estimateShadowRatio(preflash_shadow_threshold);
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
		// Decouple chroma from preflash strength: use preflash_color_amount_setting
		var colorAmountNorm = Math.max(0, Math.min(2, (preflash_color_amount_setting || 0) / 100));
		var chromaScale = chromaScaleMax * colorAmountNorm;
		var chromaNorm = chromaScale / chromaScaleMax;

		// Endpoints: preserve mode keeps anchors fixed at 0/255.
		// In non-preserve mode, endpoints follow the same delta as nearby anchors.
		var p0 = 0;
		var p255 = 255;

		// Exposure lift centered around mids with compensation to keep average brightness stable.
		var exposureLift = 24 * strengthNorm * (0.9 + 0.2 * wholeMaskCoverage) * (1 + 0.5 * strengthNorm);
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

		// Normalize Lab a/b so preflash color mostly controls hue direction,
		// while preflash_color_amount_setting controls chroma intensity.
		var sourceA = preflashColor.lab.a;
		var sourceB = preflashColor.lab.b;
		var sourceChroma = Math.sqrt(sourceA * sourceA + sourceB * sourceB);
		var colorAmountNorm = Math.max(0, Math.min(2, (preflash_color_amount_setting || 0) / 100));
		var baseTargetChroma = 80;
		var targetChroma = baseTargetChroma * colorAmountNorm;
		var targetA = 0;
		var targetB = 0;
		if (sourceChroma > 0.0001) {
			targetA = (sourceA / sourceChroma) * targetChroma;
			targetB = (sourceB / sourceChroma) * targetChroma;
		}
		// Chroma magnitude is controlled solely by the provided chromaScale
		// (driven by `preflash_color_amount_setting`). Do not roll off based on strength.
		var deltaFactor = chromaScale;
		var deltaA = Math.round(targetA * deltaFactor);
		var deltaB = Math.round(targetB * deltaFactor);

		// Mild safeguard: cap absolute a/b channel moves to prevent harsh shifts.
		var maxDeltaAB = 96;
		deltaA = Math.max(-maxDeltaAB, Math.min(maxDeltaAB, deltaA));
		deltaB = Math.max(-maxDeltaAB, Math.min(maxDeltaAB, deltaB));

		function shiftedCurve(delta) {
			// Paper-like chroma response: strongest in lower mids/mids,
			// reduced in deep shadows and especially near highlights.
			// Stronger high-strength behavior: progressively desaturate shadows.
			// Use fixed paper-response attenuations so chroma behavior is independent
			// of preflash strength; these values give a sensible rolloff across tones.
			var shadowAtten = 0.60;
			var lowerMidAtten = 0.90;
			var midAtten = 1.00;
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

	//doc.activeChannels = savedChannels;

	// Step 2: apply the Lightness curve after chroma.
	// Endpoint mapping is baked into the Lightness curve points above.
	applyLightness(tone.curvePoints);
	
	// Step 3: manipulate endpoints with Levels (input/output/gamma) after RGB conversion.
	applyEndpointLevels(tone.p128);

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
		createLuminanceMasks(0, whole_mask_reach, whole_mask_gamma, "Whole Mask", doc_scale * blur_radius);
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