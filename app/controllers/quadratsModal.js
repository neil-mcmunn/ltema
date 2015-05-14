/*
 *  A screen to view and edit quadrat details 
 * 
 * expected args: quadratID, title, siteID, quadratName
 */

var args = arguments[0];
var quadratID = args.quadratID;
var quadratTitle = args.title;
var siteID = args.siteID;
var quadratName = args.quadratName;
var protocolName = 'Mobile organisms';

//initialize variables
var photo;

//Set the title of the modal to the quadrat name
var titleLabel = Titanium.UI.createLabel({
    height:34,
    //width:350,  //long park names may need this set
    top:10,
    text:quadratTitle,
    textAlign:'center',
    font:{fontSize:20,fontWeight:'bold'}
});
// associate label to title
$.modalWin.setTitleControl(titleLabel);

// Query database quadrat table for all required data
try{
    var db = Ti.Database.open('ltemaDB');

    var results = db.execute('SELECT quadrat_name, quadrat_zone, random_drop, q.transect_id, q.media_id AS media_id, q.comments AS comments, s.year AS year \
	 						 FROM quadrat \
	 						 WHERE quadrat_id = ?', quadratID);


    var quadratName = results.fieldByName('quadrat_name');
    var quadratZone = results.fieldByName('quadrat_zone');
    var randomDrop = results.fieldByName('random_drop');
    var transectID = results.fieldByName('transect_id');
    var mediaID = results.fieldByName('media_id');
    var comments = results.fieldByName('comments');
    var year = results.fieldByName('year');

    //if media does not exist
    if(mediaID == null){
        //enable the take photo button
        $.editBtn.fireEvent('click');
        $.photoBtn.visible = true;
        $.photoBtn.enabled = true;

        //make instructions visible
        $.footerLine.visible = true;
        $.info.visible = true;

        $.info.text = ('Revisiting a Quadrat: \n\nPlease confirm all of the information above. \n\nYou will be required to take a new photo of each existing quadrat.');

        //inform user that photo is required
        $.photoError.text = '* Photo Required';
        $.photoError.visible = true;

    }else{
        //get the media name
        var mediaRow = db.execute('SELECT media_name \
							FROM media \
							WHERE media_id = ?', mediaID);

        var mediaName = mediaRow.fieldByName('media_name');

        //GET FOLDER NAME - Retrieve site survey, year, park
        var rows = db.execute('SELECT year,, park_name \
							FROM site_survey s, park prk \
							WHERE s.park_id = prk.park_id \
							AND site_id = ?', siteID);

        //get the name of the directory	
        var year = rows.fieldByName('year');
        var parkName = rows.fieldByName('park_name');

        var folderName = year + ' - ' + protocolName + ' - ' + parkName;

        var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, folderName);



        if (imageDir.exists()) {
            // .resolve() provides the resolved native path for the directory.
            var imageFile = Ti.Filesystem.getFile(imageDir.resolve(), mediaName);
            if (imageFile.exists()) {
                //Set thumbnail
                $.quadratThumbnail.visible = true;
                $.quadratThumbnail.image = imageFile;
                $.thumbnailHintText.visible = true;

                //Save Photo for preview (temporary photo)
                var temp = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
                temp.write(imageFile);
            }
        }
    }
}catch(e){
    var errorMessage = e.message;
    Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
}finally{
    if(mediaID != null){
        mediaRow.close();
        rows.close();
    }
    results.close();
    db.close();
}

//Set Quadrat Name
$.nameLbl.text = quadratName;

//year the quadrat was most recently recorded
$.dateRecorded.text = year;

//Assign Values to editable fields
$.comments.value = comments;

//Disable editing text fields
$.comments.editable = false;

// BACK BUTTON - navigate back to quadrat list screen
function backBtn(){
    //remove the temp photo - used for photo preview 
    var tempPhoto = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
    if(tempPhoto.exists){
        tempPhoto.deleteFile();
    }
    Ti.App.fireEvent("app:refreshQuadrats");
    $.modalNav.close();
}

// EDIT BUTTON
function editBtn(e){

    //enable or disable edit mode
    if (e.source.title == "Edit") {
        errorOnPage = false;
        $.modalWin.editing = true;
        e.source.title = "Done";

        //disable the button button during edit mode
        $.backBtn.enabled = false;
        $.photoBtn.enabled = true;

    } else { //if the title says "Done"
        var errorOnPage = false;

        if(errorOnPage){
            return;
        }else{
            $.modalWin.editing = false;
            e.source.title = "Edit";
            $.backBtn.enabled = true;
            $.comments.editable = false;
            $.photoBtn.enabled = false;

            saveEdit(e);
        }
    }
}

// SAVE EDIT - check for errors & save when done btn selected
function saveEdit(e){

    //disable button for 1 second to prevent double entry
    e.source.enabled = false;
    setTimeout(function(){ e.source.enabled = true; },1000);

    //Get the value of the comments field
    comments = $.comments.value;

    try{
        //Connect to database
        var db = Ti.Database.open('ltemaDB');
        //Save Photo
        if(photo != null){
            var photoName = savePhoto(photo);

            //add photo name to media table
            db.execute( 'INSERT INTO media (media_name) VALUES (?)', photoName);

            //get the id of the last row inserted into the database - *not sure if this is acceptable sql code to use?
            var results = db.execute('SELECT last_insert_rowid() as mediaID');
            var mediaID = results.fieldByName('mediaID');

            //Insert Query - update row in quadrat table
            db.execute(	'UPDATE OR FAIL quadrat SET media_id = ?, comments = ? WHERE quadrat_id = ?',
						mediaID, comments, quadratID);
        }else{
            //Insert Query - update row in quadrat table
            db.execute(	'UPDATE OR FAIL quadrat SET comments = ? WHERE quadrat_id = ?',
						comments, quadratID);
        }
    }catch(e){
        Ti.API.error(e.toString());
    }finally{
        //Close the database
        db.close();
        //close the window when user hits done button if a photo has been taken.
        if(photo != null){
            //remove the temp photo - used for photo preview 
            var tempPhoto = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
            if(tempPhoto.exists){
                tempPhoto.deleteFile();
            }
            Ti.App.fireEvent("app:refreshQuadrats");
            $.modalNav.close();
        }
        $.photoError.visible = true;
    }
}

function takePhoto() {
    //remove photo error msg
    $.photoError.visible = false;

    //call camera module and set thumbnail
    var pic = require('camera');
    pic.getPhoto(function(myPhoto) {
        //Set thumbnail
        $.quadratThumbnail.visible = true;
        $.quadratThumbnail.image = myPhoto;
        //show hint text for thumbnail
        $.thumbnailHintText.visible = true;

        //Save Photo for preview (temporary photo)
        var temp = Ti.Filesystem.getFile(Titanium.Filesystem.tempDirectory,'temp.png');
        temp.write(myPhoto);

        //set variables with values
        photo = myPhoto;
    });
}

//Name and save photo to filesystem - do this when done btn is pressed
function savePhoto(photo){
    //get the name of the current site survery, year, park
    try{
        //Connect to database
        var db = Ti.Database.open('ltemaDB');

        //Query - Retrieve site survery, year, park
        var rows = db.execute('SELECT s.year, p.protocol_name, prk.park_name \
						FROM site_survey s, protocol p, park prk \
						WHERE s.protocol_id = p.protocol_id \
						AND s.park_id = prk.park_id \
						AND site_id = ?', siteID);

        //Get requested data from each row in table

        var year = rows.fieldByName('year');
        var protocolName = rows.fieldByName('protocol_name');
        var parkName = rows.fieldByName('park_name');
    } catch(e) {
        var errorMessage = e.message;
        Ti.App.fireEvent("app:dataBaseError", {error: errorMessage});
    } finally {
        rows.close();
        db.close();
    }

    //Name the directory
    var dir = year + ' - ' + protocolName + ' - ' + parkName;
    //get the photo
    var img = photo;

    //name the photo  (timestamp - utc in ms)
    var timestamp = new Date().getTime();
    var filename = "P" + timestamp;

    try {
        // Create image Directory for site
        var imageDir = Ti.Filesystem.getFile(Ti.Filesystem.applicationDataDirectory, dir);
        if (! imageDir.exists()) {
            imageDir.createDirectory();
        }

        // .resolve() provides the resolved native path for the directory.
        var imageFile = Ti.Filesystem.getFile(imageDir.resolve(), filename + '.png');
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

/* Event Listeners */
