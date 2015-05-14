/*
 * Quadrat observations creation screen with validation
 * 
 * expected args: quadratID
 */

var args = arguments[0];
var quadratID = args.quadratID;
var protocolName = 'Mobile organisms';

// Get the siteID
var siteID;
try{
    var db = Ti.Database.open('ltemaDB');

    var rows = db.execute('SELECT tct.site_id FROM transect tct, quadrat plt \
							WHERE tct.transect_id = plt.transect_id \
							AND plt.quadrat_id = ?', quadratID);

    siteID = rows.fieldByName('site_id');
} catch(e) {
    var errorMessage = e.message;
    Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
} finally {
    rows.close();
    db.close();
}

// Set Common Other label and flag
//$.observationOtherQuickPick.labels = [{title:"Bare Soil"}, {title:"Rock"}, {title:"Litter"}, {title:"Biocrust"}, {title:"Scat"}, {title:"(other)"}];
//var observationOtherFlag = false;

// Nav Bar Title
var labelText = 'New Quadrat Observation';
var titleLabel = Titanium.UI.createLabel({
    text: labelText,
    font:{fontSize:20,fontWeight:'bold'},
});
$.addQuadratObservationWin.setTitleControl(titleLabel);

// User instructions
var instructions =
    "Please select the observation type. If this is a plant observation, you can search for the Phylum, Class, Order, Family, English Name, or Scientific Name.\n\n" +
    "Allowed Coverage percentages: 0.1%, 0.2%, 0.5%, or any integer between 0 and 100.\n\n" +
    "A reference photo may be taken, but is not required. If an observation requires further identification, and has not been previously photographed in this transect, this photo will help to later identify an unknown species. Please add any info to the comments section that may be useful in later identification.\n\n\n";
$.info.text = instructions;

// Initialize Variables
var photo = null;

function doneBtn(e){
    //disable button to prevent double entry
    e.source.enabled = false;

    // Close the search window
    win.close();

    // Check for errors on page
    var errorOnPage = false;

    if (errorOnPage) {
        e.source.enabled = true;
        $.observationSearch.blur();
        $.observation.blur();
        $.comments.blur();
        return;
    }

    // Check observation and set count and observation
    var count;
    var observation;
    var comments;
    var speciesCode;
    var speciesOther = ''; //default empty

    comments = $.comments.value;
    observation = $.observationSearch.value;
    // Check if observation is a scientific name or english
    try {
        var db = Ti.Database.open('taxonomy');
        var rsScientific = db.execute('SELECT non_sessile_code, scientific_name \
                            FROM non_sessile \
                            WHERE UPPER(scientific_name) = UPPER(?) \
                            LIMIT 1', observation);

        var rsCommon = db.execute('SELECT non_sessile_code, common_name \
                                    FROM non_sessile \
                                    WHERE UPPER(common_name) = UPPER(?) \
                                    LIMIT 1', observation);

        if (rsScientific.isValidRow()) {
            scientificName = rsScientific.fieldByName('scientific_name');

            if (scientificName != null) {
                speciesCode = rsScientific.fieldByName('non_sessile_code');
            }
            rsScientific.close();
        } else if (rsCommon.isValidRow()) {
            commonName = rsCommon.fieldByName('common_name');
            if (commonName != null) {
                speciesCode = rsCommon.fieldByName('non_sessile_code');
            }
            rsCommon.close();
        } else {
            // species not found, use 'other' field
            speciesCode = $.observationSearch.value;
            speciesOther = $.observationSearch.value;
        }

    } catch(e) {
        var errorMessage = e.message;
        Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
    } finally {
        db.close();
    }


    // Name and save photo if taken
    var mediaID = null;
    if (photo != null) {

        var photoName = savePhoto(photo);

        try{
            //Connect to database
            var db = Ti.Database.open('ltemaDB');

            //add photo name to media table
            db.execute( 'INSERT INTO media (media_name) VALUES (?)', photoName);

            //get the id of the last row inserted into the database - *not sure if this is acceptable sql code to use?
            var results = db.execute('SELECT last_insert_rowid() as mediaID');
            mediaID = results.fieldByName('mediaID');
        }catch(e){
            var errorMessage = e.message;
            Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
        }finally{
            //close the result set
            results.close();
            //Close the database
            db.close();
        }
    }

    // Insert Query - add row to quadrat observation table
    try{
        //Connect to database
        var db = Ti.Database.open('ltemaDB');

        db.execute('INSERT INTO quadrat_observation (observation, count, comments, quadrat_id, media_id, non_sessile_code, non_sessile_other) \
				VALUES (?,?,?,?,?,?,?)', observation, count, comments, quadratID, mediaID, speciesCode, speciesOther);

    }catch(e){
        var errorMessage = e.message;
        Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
    }finally{
        //Close the database
        db.close();
        //refresh and close
        Ti.App.fireEvent("app:refreshQuadratObservations");
        $.addQuadratObservationWin.close();
    }
}

function takePhoto(){
    //call camera module and set thumbnail
    var pic = require('camera');
    pic.getPhoto(function(myPhoto, QZone) {
        //Set thumbnail
        $.photoHint.visible = false;
        $.quadratThumbnail.visible = true;
        $.quadratThumbnail.image = myPhoto;
        $.thumbnailHintText.visible = true;

        //Save Photo for preview (temporary photo)
        var temp = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
        temp.write(myPhoto);

        //set variables with values
        photo = myPhoto;
        quadratZone = QZone;
    });
}

//Name and save photo to filesystem - do this when done btn is pressed
function savePhoto(photo){
    try {
        //Connect to database
        var db = Ti.Database.open('ltemaDB');

        //Query - Retrieve site survery, year, park
        var rows = db.execute('SELECT year, park_name \
							FROM site_survey s, park prk \
							WHERE s.park_id = prk.park_id \
							AND site_id = ?', siteID);

        //Name the directory	
        var year = rows.fieldByName('year');
        var parkName = rows.fieldByName('park_name');
        var dir = year + ' - ' + protocolName + ' - ' + parkName;
    } catch(e) {
        var errorMessage = e.message;
        Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
    } finally {
        rows.close();
        db.close();
    }

    //get the photo
    var img = photo;

    //name the photo  (timestamp - utc in ms)
    var timestamp = new Date().getTime();
    var filename = "O" + timestamp;

    try {
        // Create image Directory for site
        var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
        if (! imageDir.exists()) {
            imageDir.createDirectory();
        }

        // .resolve() provides the resolved native path for the directory.
        var imageFile  = Ti.Filesystem.getFile(imageDir.resolve(), filename + '.png');
        imageFile.write(img);

        var path = filename + '.png';
    } catch(e) {
        var errorMessage = e.message;
        Ti.App.fireEvent("app:fileSystemError", {error: errorMessage});
    } finally {
        imageDir = null;
        imageFile = null;
        return path;
    }
}

//THUMBNAIL BUTTON - preview photo
function previewPhoto(){
    var modal = Alloy.createController("photoPreviewModal", {}).getView();
    modal.open({
        modal : true,
        modalTransitionStyle : Ti.UI.iPhone.MODAL_TRANSITION_STYLE_COVER_VERTICAL,
        modalStyle : Ti.UI.iPhone.MODAL_PRESENTATION_PAGESHEET,
        navBarHidden : false
    });
}

// Event listeners


$.observationOtherQuickPick.addEventListener('click', function(e) {
    $.observationError.visible = false;
    if (e.index === 5) {  //other other selected
        $.observation.value = "";
        $.observationLbl.top += 60;
        $.observation.top += 60;
        $.observationError.top += 60;
        $.commentLbl.top += 60;
        $.comments.top += 60;
        $.photoBtn.top += 60;
        $.photoHint.top += 60;
        $.quadratThumbnail.top += 60;
        $.thumbnailHintText.top += 60;
        $.footerLine.top += 60;
        $.info.top += 60;
        $.observationLbl.visible = true;
        $.observation.visible = true;
        observationOtherFlag = true;
    } else {  //common other selected
        var quickPick = e.source.labels[e.index].title;
        $.observation.value = quickPick;

        if (observationOtherFlag === true) {
            $.observationLbl.visible = false;
            $.observation.visible = false;
            $.observationLbl.top -= 60;
            $.observation.top -= 60;
            $.observationError.top -= 60;
            $.commentLbl.top -= 60;
            $.comments.top -= 60;
            $.photoBtn.top -= 60;
            $.photoHint.top -= 60;
            $.quadratThumbnail.top -= 60;
            $.thumbnailHintText.top -= 60;
            $.footerLine.top -= 60;
            $.info.top -= 60;
            observationOtherFlag = false;
        }
    }
});

$.observationSearch.addEventListener('change', function(e) {
    if ($.observationSearch.value == ""){
        $.observationError.visible = true;
    } else {
        $.observationError.visible = false;
    }
});

$.observation.addEventListener('change', function(e) {
    if ($.observation.value == "") {
        $.observationError.visible = true;
    } else {
        $.observationError.visible = false;
    }
});

// related to issue #28
$.addQuadratObservationWin.addEventListener('close', function(e) {
    Ti.App.fireEvent("app:refreshQuadratObservations");
});

// Closes the popup result window if user click outside of the table
$.formView.addEventListener('click', function(e) {
    if (e.source != win) {
        win.close();
    }
});
// Closes the popup result window if user navigates away from this screen 
$.observationSearch.addEventListener('blur', function(e) {
    win.close();
});

// SEARCH BAR ACTIONS

//var last_search = null;
var timers = [];

//create the popup window to show search results
var win = Ti.UI.createWindow({
    borderColor : "#C0C0C0",
    scrollable : true,
    height: 318,
    left : 220,
    right : 40,
    top : 198,
    borderRadius : 0,
    borderWidth: 3,
    title : 'park names',
    //orientationModes : [Ti.UI.PORTRAIT, Ti.UI.UPSIDE_PORTRAIT]
});


//AUTOCOMPLETE TABLE - list of results from search
var table_data = [];
var autocomplete_table = Titanium.UI.createTableView({
    search : $.observationSearch.value,
    top : 0,
    height: Ti.UI.FILL
});
win.add(autocomplete_table);

//Auto-complete search
function auto_complete(search_term) {
    if (search_term.length >= 1) {
        //clear the table view results
        autocomplete_table.setData([]);
        autocomplete_table.setData(table_data);

        //open database
        try {
            var totalRowCount = 0;
            var db = Ti.Database.open('taxonomy');

            //Retrieve matching taxonomy information from database the database

            var rsCommon = db.execute('SELECT DISTINCT common_name, \
                                        FROM non_sessile \
                                        WHERE UPPER(common_name) LIKE UPPER(?)', search_term + '%');

            var rsScientific = db.execute('SELECT DISTINCT scientific_name \
                                        FROM non_sessile \
                                        WHERE UPPER(scientific_name) LIKE UPPER(?)', search_term + '%');
            totalRowCount += rsCommon.getRowCount();
            totalRowCount += rsScientific.getRowCount();

            //check if any results are returned
            if (totalRowCount <= 0) {
                win.close();
            } else {
                win.open();

                // Add english name to results
                if (rsCommon.getRowCount() > 0) {
                    var commonSection = Ti.UI.createTableViewSection({
                        headerTitle: "Common Name"
                    });

                    autocomplete_table.appendSection(commonSection);

                    while (rsCommon.isValidRow()) {
                        var commonName = rsCommon.fieldByName('common_name');

                        //create a new row
                        var enRow = Ti.UI.createTableViewRow({
                            title : commonName,
                            indentionLevel: 1
                        });

                        //Add row to the table view
                        autocomplete_table.appendRow(enRow);
                        rsCommon.next();
                    }
                    rsCommon.close();
                }

                // Add scientific name to results
                if (rsScientific.getRowCount() > 0) {
                    var snSection = Ti.UI.createTableViewSection({
                        headerTitle: "Scientific Name"
                    });

                    autocomplete_table.appendSection(snSection);

                    while (rsScientific.isValidRow()) {
                        var scientificName = rsScientific.fieldByName('scientific_name');

                        //create a new row
                        var snRow = Ti.UI.createTableViewRow({
                            title : scientificName,
                            indentionLevel: 1
                        });

                        //Add row to the table view
                        autocomplete_table.appendRow(snRow);
                        rsScientific.next();
                    }
                    rsScientific.close();
                }
            }
        } catch (e) {
            var errorMessage = e.message;
            Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
        } finally {
            db.close();
        }
    }
}

//Event Listener - when user types in the search bar
$.observationSearch.addEventListener('change', function(e) {
    var match = /^[A-Za-z]/;  //sanitize search input by requiring a letter
    if ((e.source.value.length < 2) || (!e.source.value.match(match))) {
        //clear the table view results
        autocomplete_table.setData([]);
        autocomplete_table.setData(table_data);
        win.close();
    } else {
        clearTimeout(timers['autocomplete']);
        timers['autocomplete'] = setTimeout(function() {
            auto_complete(e.source.value);
        }, 500);

    }
});

//Event Listener - search results selected by user
autocomplete_table.addEventListener('click', function(e) {
    //add selected park name to the search bar value
    $.observationSearch.value = e.source.title;
    $.observationError.visible = false;
    win.close();
    $.observationSearch.blur();
});

// Fire when addTransect Window is closed
$.addQuadratObservationWin.addEventListener('close', function(e) {
    //remove the temp photo - used for photo preview
    var tempPhoto = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
    if(tempPhoto.exists){
        tempPhoto.deleteFile();
    }
});

// scroll view to fit search window on screen
win.addEventListener('open', function(e) {
    if ( (win.orientation === 4) || (win.orientation === 3) ) {  //LANDSCAPE_LEFT and LANDSCAPE_RIGHT
        $.formView.scrollTo(0,95);
        win.top = 98;
    } else {
        $.formView.scrollTo(0,0);
        win.top = 198;  //reset in case user rotates the device between result window opens
    }
});
// reset view on close
win.addEventListener('close', function(e) {
    $.formView.scrollTo(0,0);
});