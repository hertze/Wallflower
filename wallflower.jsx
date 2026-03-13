	// W A L L F L O W E R
	//
	// Version 2 beta
	//
	// by Joakim Hertze (www.hertze.se)
	//
	// ---------------------------------------------------------------------

	#target photoshop


	// Default settings ------------------------------------------------------------

	// Channel name for Lightness (change based on Photoshop language)
	// English: "Lightness", German: "Helligkeit", Swedish: "Ljushet"
	var lightness_channel_name = "Lightness";

	var pre_flash_r = 255;
	var pre_flash_g = 105;
	var pre_flash_b = 40;
	var pre_flash_strength = 10;
	var foglayer_opacity = 0;
	var adjust_blackpoint = 0;
	var adjust_shadows = 0;	
	var adjust_midtones = 0;
	var adjust_highlights = 0;
	var adjust_whitepoint = 0;

	var shadow_sat_reduction = 0;
	var highlight_sat_reduction = 0;
	var shadow_tint = 0;
	var shadow_warmth = 0;
	var highlight_tint = 0;
	var highlight_warmth = 0;

	var save = false;

	// These settings are not used in the recipe

	var blur_lightness = 0;
	var blur_a = 10;
	var blur_b = 15;
	var blur_ab_noise = 10;
	var blur_radius = 3;
	// Auto-adjust preflash based on image shadow content
	var auto_adjust_preflash = true; // enable to let script compute a recommended strength
	var preflash_auto_samples = 5; // grid samples per axis (5x5)
	var preflash_shadow_threshold = 64; // luminance threshold considered 'shadow'

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
						>>]
							>>
						>> ]]></terminology>
	</javascriptresource>
	// END__HARVEST_EXCEPTION_ZSTRING
	*/


	function displayDialog(thisRecipe, saveStatus, runmode) {
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
		
		dialog.savestatus = dialog.add("checkbox", undefined, "Save and close when done");
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
			"savestatus": saveStatus
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
				app.playbackParameters = d;		
				return result;
			}
		}
		else {
			var recipe = app.playbackParameters.getString(stringIDToTypeID('recipe'));
			var savestatus = app.playbackParameters.getString(stringIDToTypeID('savestatus'));
			
			if (app.playbackDisplayDialogs == DialogModes.ALL) {
				// user run action in dialog mode (edit action step)
				var result = displayDialog(recipe, savestatus, "edit");
				if (!result.recipe || result.recipe == "") { isCancelled = true; return } else {
					var d = new ActionDescriptor;
					d.putString(stringIDToTypeID('recipe'), result.recipe);
					d.putString(stringIDToTypeID('savestatus'), result.savestatus);
					app.playbackParameters = d;
				}
				executeScript = false;
				return result;
			}
			if (app.playbackDisplayDialogs != DialogModes.ALL) {
				// user run script without recording
				return {
					"recipe": recipe,
					"savestatus": savestatus
				};
			}
		}
	}

	function processRecipe(runtimesettings) {
		// Process the recipe and change settings
		var thisRecipe = runtimesettings.recipe;
		var saveStatus = runtimesettings.savestatus;
		save = (saveStatus.toLowerCase() === "true");
		thisRecipe = thisRecipe.replace(/\s+/g, ""); // Removes spaces
		thisRecipe = thisRecipe.replace(/;+$/, ""); // Removes trailing ;
		
		// Check recipe against syntax
		const regex = new RegExp('^(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5]|0);(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5]|0);(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5]|0);(?:[1-9][0-9]?|100|0);(?:[1-9][0-9]?|100|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:[1-9][0-9]?|1[01][0-9]|12[0-8]|0);(?:[1-9][0-9]?|1[01][0-9]|12[0-8]|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0);(?:-?[1-9]|-?[1-4][0-9]|-?50|0)$', 'gm');
		
		if (regex.exec(thisRecipe) !== null) {
			thisRecipe = thisRecipe.split(";"); // Splits into array at ;
			pre_flash_r = parseInt(thisRecipe[0]);
			pre_flash_g = parseInt(thisRecipe[1]);
			pre_flash_b = parseInt(thisRecipe[2]);
			pre_flash_strength = parseInt(thisRecipe[3]);
			foglayer_opacity = parseInt(thisRecipe[4]);
			adjust_blackpoint = parseInt(thisRecipe[5]);
			adjust_shadows = parseInt(thisRecipe[6]);
			adjust_midtones = parseInt(thisRecipe[7]);
			adjust_highlights = parseInt(thisRecipe[8]);
			adjust_whitepoint = parseInt(thisRecipe[9]);
			shadow_sat_reduction = parseInt(thisRecipe[10]);
			highlight_sat_reduction = parseInt(thisRecipe[11]);
			shadow_tint = parseInt(thisRecipe[12]);
			shadow_warmth = parseInt(thisRecipe[13]);
			highlight_tint = parseInt(thisRecipe[14]);
			highlight_warmth = parseInt(thisRecipe[15]);
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

	function abCurves(adjustment, this_shadow_tint, this_shadow_warmth, this_highlight_tint, this_highlight_warmth) {
		doc.activeChannels = [doc.channels.getByName("a")];
		doc.activeLayer.adjustCurves([
			[0, adjustment],
			[128, 128 + this_shadow_tint + this_highlight_tint],
			[255, 255 - adjustment]
		]);

		doc.activeChannels = [doc.channels.getByName("b")];
		doc.activeLayer.adjustCurves([
			[0, adjustment],
			[128, 128 + this_shadow_warmth + this_highlight_warmth],
			[255, 255 - adjustment]
		]);
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
				alert("Recommended preflash strength based on image analysis: " + pre_flash_strength);
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
				var damp = Math.min(0.6, (pre_flash_strength / 100) * 0.6); // overall strength
				var blackComp = Math.round((pre_flash_strength / 100) * 40); // max ~40 levels of extra shadow pull
				function clamp255(v) { return Math.max(0, Math.min(255, Math.round(v))); }
				function damped(v) {
					var t = v / 255.0; // 0..1
					// Use t^2 so highlights (t~1) are barely affected, shadows (t~0) affected more
					var factor = 1 - damp * (1 - t * t);
					factor = Math.max(0.35, factor); // avoid total crush
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
				var midBlend = 0.7; // 0..1 where 1 = fully damped (less change), 0 = fully comp (more change)
				var p0 = comp(0);
				var p32 = comp(32);
				var p64 = Math.round(comp(64) * (1 - midBlend) + damped(64) * midBlend);
				var p128 = Math.round(comp(128) * (1 - midBlend) + damped(128) * midBlend);
				var p192 = comp(192);
				var p255 = comp(255);
				// Optionally force a small input range to map to 0 to restore true blacks
				var blackShiftInput = Math.round((pre_flash_strength / 100) * 12); // 0..12
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
				imagelayer.adjustCurves(curvePoints);
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
			halationLayer.opacity = 20;

			doc.activeLayer = halationLayer;

			doc.selection.load(doc.channels.getByName("Highlight Mask"));
			doc.selection.invert();
			doc.selection.clear();

			halationLayer.applyGaussianBlur(doc_scale * blur_radius * 3);
			doc.selection.load(doc.channels.getByName("Highlight Mask"), SelectionType.REPLACE);
			doc.selection.clear();

			halationLayer.merge();

			// Convert to Lab Color
			doc.changeMode(ChangeMode.LAB);

			doc.activeChannels = [doc.channels.getByName(lightness_channel_name)];
			doc.activeLayer.adjustCurves([
				[0, Math.max(0, adjust_blackpoint)],
				[64, 64 + adjust_shadows],
				[128, 128 + adjust_midtones],
				[192, 192 + adjust_highlights], 
				[255, Math.min(255, 255 + adjust_whitepoint)]
			]);

			// Shadow curve
			doc.selection.load(doc.channels.getByName("Shadow Mask"));
			abCurves(shadow_sat_reduction, shadow_tint, shadow_warmth, 0, 0);
			
			// Highlight curve
			doc.selection.load(doc.channels.getByName("Highlight Mask"));
			abCurves(highlight_sat_reduction, 0, 0, highlight_tint, highlight_warmth);

			doc.selection.deselect();

			doc.changeMode(ChangeMode.RGB);

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