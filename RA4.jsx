// R A 4
//
// Version 1
//
// by Joakim Hertze (www.hertze.se)
//
// ---------------------------------------------------------------------

#target photoshop


// Settings ------------------------------------------------------------

var filter_hue = 35;
var pre_flash_strength = 3;
var foglayer_opacity = 2;
var adjust_blackpoint = 2;
var adjust_whitepoint = 5;
var blur_strength = 5;

var shadow_r = 0;
var shadow_g = 0;
var shadow_b = 0;
var midtone_r = 0;
var midtone_g = 0;
var midtone_b = 0;
var highlight_r = 0;
var highlight_g = 0;
var highlight_b = 0;

var save = false;

// ---------------------------------------------------------------------


// DO NOT EDIT BELOW THIS LINE -----------------------------------------

/*
// BEGIN__HARVEST_EXCEPTION_ZSTRING
<javascriptresource> 
<name>RA4</name> 
<menu>automate</menu>
<enableinfo>true</enableinfo>
<eventid>f3c2a1d9-8b7e-4c1f-9238-52e9d7f8b5b4</eventid>
<terminology><![CDATA[<< /Version 1
					   /Events <<
					   /f3c2a1d9-8b7e-4c1f-9238-52e9d7f8b5b4 [(RA4) <<
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
	dialog.text = "Print";
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
	const regex = new RegExp('^(?:[1-9][0-9]?|1[0-9][0-9]|2[0-4][0-9]|25[0-5]);(?:[1-9][0-9]?|100|0);(?:[1-9][0-9]?|100|0);(?:[1-9]|[1-4][0-9]|50|0);(?:[1-9]|[1-4][0-9]|50|0);(?:[1-9]|10|0);(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0));(-?(100|[1-9][0-9]?|0))$', 'gm');
	
	if (regex.exec(thisRecipe) !== null) {
		thisRecipe = thisRecipe.split(";"); // Splits into array at ;
		filter_hue = parseInt(thisRecipe[0]);
		pre_flash_strength = parseInt(thisRecipe[1]);
		foglayer_opacity = parseInt(thisRecipe[2]);
		adjust_blackpoint = parseInt(thisRecipe[3]);
		adjust_whitepoint = parseInt(thisRecipe[4]);
		blur_strength = parseInt(thisRecipe[5]);
		shadow_r = parseInt(thisRecipe[6]);
		shadow_g = parseInt(thisRecipe[7]);
		shadow_b = parseInt(thisRecipe[8]);
		midtone_r = parseInt(thisRecipe[9]);
		midtone_g = parseInt(thisRecipe[10]);
		midtone_b = parseInt(thisRecipe[11]);
		highlight_r = parseInt(thisRecipe[12]);
		highlight_g = parseInt(thisRecipe[13]);
		highlight_b = parseInt(thisRecipe[14]);
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

function microSmooth(channelName, blurradius) {
	// Apply a Gaussian blur to the specified channel
	var channel = doc.channels.getByName(channelName);
	doc.activeChannels = [channel];
	doc.activeLayer.applyGaussianBlur(doc_scale * blurradius);
}

function colorBalance(shadow_r, shadow_g, shadow_b, midtone_r, midtone_g, midtone_b, highlight_r, highlight_g, highlight_b) {
    // Apply color balance to the image in RGB mode
    doc.activeLayer.adjustColorBalance(
            [shadow_r, shadow_g, shadow_b],       // Shadows (red, green, blue)
            [midtone_r, midtone_g, midtone_b],   // Midtones (red, green, blue)
            [highlight_r, highlight_g, highlight_b],
		true // Highlights (red, green, blue)
    );
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

		// Colors
		var preflashColor = new SolidColor();
		preflashColor.hsb.hue = filter_hue; // Use the preflash_hue value
		preflashColor.hsb.saturation = 100; // Set saturation to 100%
		preflashColor.hsb.brightness = 100; // Set brightness to 100%

		var fogColor = new SolidColor();
		fogColor.rgb.red = 253;
		fogColor.rgb.green = 246;
		fogColor.rgb.blue = 227;
        
		var greyColor = new SolidColor();
		greyColor.rgb.red = 128;
		greyColor.rgb.green = 128;
		greyColor.rgb.blue = 128;

		var blackColor = new SolidColor();
		blackColor.rgb.red = 0;
		blackColor.rgb.green = 0;
		blackColor.rgb.blue = 0;

		doc.activeChannels = [doc.channels.getByName("Lightness")];
		doc.activeLayer.adjustCurves([
			[0, adjust_blackpoint],
			[64, 66],   // Lift blacks a little
			[128, 128],
			[192, 190], 
			[255, 255 - adjust_whitepoint] // Lower whites slightly
		]);
		
		doc.activeChannels = [doc.channels.getByName("a")];
		doc.activeLayer.adjustCurves([
			[0, 50],
			[128, 128],
			[148, 148], // Keep midtones the same
			[255, 245]  // Slightly adjust highlights
		]);

		doc.activeChannels = [doc.channels.getByName("b")];
		doc.activeLayer.adjustCurves([
			[0, 50],
			[128, 128],
			[148, 148], // Keep midtones the same
			[255, 245]  // Slightly adjust highlights
		]);

		microSmooth("a", doc_scale);
		microSmooth("b", doc_scale);

        // Create a new layer
        var preflashLayer = doc.artLayers.add();
        preflashLayer.name = "Preflash"; // Name the new layer
        preflashLayer.blendMode = BlendMode.SCREEN;
        preflashLayer.opacity = pre_flash_strength;

        // Fill the Preflash layer with the color
        doc.selection.selectAll();
        doc.selection.fill(preflashColor);
        doc.selection.deselect();

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

		imagelayer.applyGaussianBlur(blur_strength/5*doc_scale); // Apply Gaussian blur to the image layer

        // Flatten document and save if needed
        doc.flatten();
		doc.changeMode(ChangeMode.RGB);

		colorBalance(shadow_r, shadow_g, shadow_b, midtone_r, midtone_g, midtone_b, highlight_r, highlight_g, highlight_b); // Example values

        if (save == true) { saveClose(); }
    }
    
} catch (e) { alert(e); }