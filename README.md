W A L L F L O W E R

Version 1.0

By Joakim Hertze

A script plugin for Photoshop that emulates the look of RA-4 processed and scanned photos.

## Install and get started

1. Click the button below to download the software bundle.

2. Copy the file `wallflower.jsx` to Photoshop’s scripts folder. On Mac it&#8217;s in `/Applications/Photoshop 202x/Presets/Scripts` and on Windows 10 it&#8217;s in `C:\Program Files\Adobe\Adobe Photoshop 202x\Presets\Scripts`.

3. Restart Photoshop and make sure **Wallflower** shows up in the menu **File/Automate**.

4. Install the actions by clicking on the hamburger icon (≡) in the actions palette in Photoshop, choose **Load Actions&#8230;** and then select all action files (ending in `.atn`) and click on **Open**.

5. Start experimenting by running one of the installed Photoshop actions with an image open.

## Using and editing the ready-made actions

Wallflower actions are built from recipes (script settings), that determine the resulting look. By default, the images won’t be saved after the script runs, leaving them intact. Because of this, the actions won’t work for automation (such as droplets) just yet. If you make a droplet at this stage you’ll be prompted to save the image on every droplet run.

When you’re ready to have an action save the resulting image, or when you want to edit the recipe of an action, expand the action (click on the right bracket) to show the recorded script name, **Wallflowe**. When you double-click on this, a dialog will open where you can edit the saved recipe. Click the button labeled **Use this recipe** to save your changes.

If you check **Save and close when done** the script will start saving and closing the image after it runs, so leave this unchecked while you’re still trying out different recipes.

## Making your own actions

Make your own recipe actions by duplicating an existing action (click on the small hamburger menu in the upper right corner of the Actions palette and choose **Duplicate**) and change the name (by double-clicking on it) and edit the recipe as outlined above.

You can also record your own actions from scratch by having an image open and then click on the plus icon in the Actions palette, name the action and start recording. Choose **Wallflower** from the **File/Automate** menu, paste the recipe you want, make sure **Save and close when done** isn’t checked (otherwise the image will close and you can’t stop the recording) and click **Use this recipe** to run the script. When it’s finished, open the recipe again as outlined above, check **Save and close when done** and save the recipe, if you’re ready for the script to start saving your images.

You can make as many actions with different settings as you like.

## Recipe settings

A recipe is a text string with script settings that follows a specific syntax. It contains a number of settings, separated by a `;` (semicolon) and an optional blank space for readability. All settings must always be specified and in the following order:


1. Pre-flash filter RGB R-value [0--255]
2. Pre-flash filter RGB G-value [0--255]
3. Pre-flash filter RGB B-value [0--255]
4. Opacity of pre-flash layer [0--100]
5. Fog layer (paper base) opacity [0--100]
6. Black point adjustment [0--50]
7. Shadow point adjustment [-50--50; positive number moves up, negative down]
8. Midpoint adjustment [-50--50; positive number moves up, negative down]
9. Highlights point adjustment [-50--50; positive number moves up, negative down]
10. White point adjustment [-50--0; negative number moves down]
11. Shadow saturation reduction [0-128]
12. Highlight saturation reduction. [0-128]
13. Shadow tint adjustment [-50--50; negative value adds green, positive adds magenta)
14. Shadow warmth adjustment [-50--50; negative values adds blue, positive adds yellow)
15. Highlights tint adjustment (negative value adds green, positive magenta)
16. Highlights warmth adjustment (negative values adds blue, positive yellow)

## Controlling contrast

![Neutral curve](https://github.com/hertze/Wallflower/tree/main/curve-neutral.jpg)