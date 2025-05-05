// W A L L F L O W E R
//
// Version 1
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Settings ------------------------------------------------------------

var pre_flash_r = 255;
var pre_flash_g = 200;
var pre_flash_b = 150;
var pre_flash_strength = 0;
var foglayer_opacity = 0;
var adjust_blackpoint = 4;
var adjust_shadows = 3;	
var adjust_midtones = 0;
var adjust_highlights = 2;
var adjust_whitepoint = 4;

var shadow_sat_reduction = 128;
var highlight_sat_reduction = 16;
var shadow_tint = -5;
var shadow_warmth = 0;
var highlight_tint = 0;
var highlight_warmth = 0;

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

function createLuminanceMasks(rangeStart, rangeEnd, maskName) {
    
	// Duplicate the image layer
	var shadowLayer = imagelayer.duplicate();
	shadowLayer.name = "Shadow Layer";

	// Desaturate the duplicated layer
	shadowLayer.desaturate();

	doc.activeLayer = shadowLayer;

	doc.activeChannels = [doc.channels.getByName("Lightness")];

	doc.activeLayer.adjustLevels(rangeStart, rangeEnd, 1.0, 0, 255);

	if (rangeStart < 128) {
		shadowLayer.invert(); // Invert the layer if the range is in the shadow area
	}

	var lightnessChannel = doc.channels.getByName("Lightness");
	
	// Duplicate the lightness channel into a new channel
	doc.activeChannels = [lightnessChannel];
	doc.selection.selectAll();
	doc.selection.copy();
	var newChannel = doc.channels.add();
	newChannel.name = maskName;
	doc.activeChannels = [newChannel];
	doc.paste();
	doc.selection.deselect();

	shadowLayer.remove(); // Remove the shadow layer

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

		// Convert to Lab Color
		doc.changeMode(ChangeMode.LAB);

		// Create luminance masks
		createLuminanceMasks(0,64, "Shadow Mask");
		createLuminanceMasks(192,255, "Highlight Mask");

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

		doc.activeChannels = [doc.channels.getByName("Lightness")];
		doc.activeLayer.adjustCurves([
			[0, Math.max(0, adjust_blackpoint)],
			[64, 64 + adjust_shadows],
			[128, 128 + adjust_midtones],
			[192, 192 + adjust_highlights], 
			[255, Math.min(255, 255 + adjust_whitepoint)]
		]);

			
		// Mask shadows
		doc.selection.load(doc.channels.getByName("Shadow Mask"));
		abCurves(shadow_sat_reduction, shadow_tint, shadow_warmth, 0, 0);
		// Tint shadows green
		doc.activeChannels = [doc.channels.getByName("a")];
		
		// Mask highlights
		doc.selection.load(doc.channels.getByName("Highlight Mask"));
		abCurves(highlight_sat_reduction, 0, 0, highlight_tint, highlight_warmth);

		doc.selection.deselect();

		// Microscopic smoothing
		microSmooth("a", doc_scale*2, doc_scale); // blur a-channel some
		microSmooth("b", doc_scale*3, doc_scale); // blur b-channel some more

		// Reduce microcontrast
		var highpassLayer = imagelayer.duplicate();
		highpassLayer.name = "Highpass Layer";
		highpassLayer.applyHighPass(doc_scale*1);
		highpassLayer.invert();
		highpassLayer.blendMode = BlendMode.SOFTLIGHT;
		highpassLayer.merge();

		// Paper fog
		var fogLayer = doc.artLayers.add();
		fogLayer.name = "Paper Fog";

		doc.selection.selectAll();
		doc.selection.fill(fogColor);
		doc.selection.deselect();

		fogLayer.applyAddNoise(doc_scale*2, NoiseDistribution.GAUSSIAN, false); // Add noise to the fog layer
		fogLayer.applyGaussianBlur(doc_scale); // Apply Gaussian blur to the fog layer

		fogLayer.blendMode = BlendMode.MULTIPLY;
		fogLayer.opacity = 2;

		// Preflash
		var preflashLayer = doc.artLayers.add();
		preflashLayer.name = "Preflash"; // Name the new layer
		preflashLayer.blendMode = BlendMode.SOFTLIGHT;
		preflashLayer.opacity = pre_flash_strength;

		doc.selection.selectAll();
		doc.selection.fill(preflashColor);
		doc.selection.deselect();
		
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
		doc.changeMode(ChangeMode.RGB);

        if (save == true) { saveClose(); }
    }
    
} catch (e) { alert(e); }